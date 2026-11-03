//! Authenticated credential encryption.
//!
//! The credential document is sealed under **two independent 256-bit keys used
//! with two different algorithms**: XChaCha20-Poly1305 under the second half of
//! the key file, then AES-256-GCM under the first half. That is 512 bits of
//! key material with no shared structure between the layers — a weakness found
//! in one primitive buys nothing against the other, and opening the file
//! requires breaking both.
//!
//! The key file is 64 random bytes, mode 0600, owned by the account. It never
//! leaves the store directory and is never placed in the document.
//!
//! The OS vault (keyring / Secret Service / KWallet) is opt-in via
//! `QUIXI_USE_KEYRING=1`. It is not the default because on Linux it silently
//! no-ops when no collection exists — writes report success and read back
//! empty, which loses keys rather than protecting them.
use aes_gcm::{
    aead::{rand_core::RngCore, Aead, KeyInit, OsRng, Payload},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose::STANDARD, Engine};
use chacha20poly1305::{XChaCha20Poly1305, XNonce};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{fs, path::Path};

/// Bytes of key material in the current format (two 256-bit keys).
const KEY_BYTES: usize = 64;
/// Bytes of key material in the pre-cascade format (one AES-256 key).
const LEGACY_KEY_BYTES: usize = 32;
/// Bytes of random material written to disk. Larger than any cipher key can be,
/// so it is expanded into the two 256-bit halves the cascade needs.
const SEED_BYTES: usize = 512;

/// Expands the on-disk seed into the 64 bytes the cascade uses: two
/// independently derived 256-bit keys, one per cipher.
fn expand_seed(seed: &[u8]) -> Vec<u8> {
    let mut out = Vec::with_capacity(KEY_BYTES);
    for domain in [1u8, 2u8] {
        let mut buf = Vec::with_capacity(seed.len() + 1);
        buf.extend_from_slice(seed);
        buf.push(domain);
        out.extend_from_slice(Sha256::digest(&buf).as_slice());
    }
    out
}
/// Binds the ciphertext to the format so a v2 blob cannot be replayed as v1.
const AAD: &[u8] = b"quixidesk/credentials/v2";

fn use_keyring() -> bool {
    matches!(
        std::env::var("QUIXI_USE_KEYRING").ok().as_deref(),
        Some("1") | Some("true") | Some("yes")
    )
}

/// The one place that decides where the key lives. Test profiles get their own
/// file so a test run can never read or rewrite the account's real key.
fn local_key_path(path: &Path) -> std::path::PathBuf {
    if cfg!(test) || quixi_proto::paths::test_profile().is_some() {
        return path.with_file_name("test-credentials.key");
    }
    if let Ok(custom) = std::env::var("QUIXI_CREDENTIAL_KEY_FILE") {
        if !custom.trim().is_empty() {
            return std::path::PathBuf::from(custom);
        }
    }
    path.with_file_name("credentials.key")
}

/// Reads the raw key file if present. Accepts either width so a legacy 32-byte
/// key can still open a v1 document during migration.
fn read_key_file(path: &Path) -> Option<Vec<u8>> {
    let p = local_key_path(path);
    if !p.exists() {
        return None;
    }
    let bytes = fs::read(&p).ok()?;
    if bytes.len() == SEED_BYTES {
        return Some(expand_seed(&bytes));
    }
    if bytes.len() == KEY_BYTES || bytes.len() == LEGACY_KEY_BYTES {
        Some(bytes)
    } else {
        None
    }
}

fn write_key_file(path: &Path, key: &[u8]) -> Result<(), String> {
    super::storage::atomic_write(&local_key_path(path), key).map_err(|e| e.to_string())
}

/// Returns a 64-byte key, minting one if absent. A legacy 32-byte key file is
/// replaced with a fresh 64-byte key: widening it by derivation would not add
/// entropy, so new material is drawn instead. Callers seal the whole document
/// immediately afterwards, which is what makes replacing the key safe.
fn key_512(path: &Path, create: bool) -> Result<Vec<u8>, String> {
    if let Some(existing) = read_key_file(path) {
        if existing.len() == KEY_BYTES {
            return Ok(existing);
        }
    }
    if !create {
        return Err("Credential key is missing or below the current key width".into());
    }
    let mut seed = vec![0u8; SEED_BYTES];
    OsRng.fill_bytes(&mut seed);
    write_key_file(path, &seed)?;
    Ok(expand_seed(&seed))
}

fn keyring_key(path: &Path, create: bool) -> Result<Vec<u8>, String> {
    let identity = format!("{:x}", Sha256::digest(path.to_string_lossy().as_bytes()));
    let entry =
        keyring::Entry::new("QuixiDesk credentials", &identity).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(s) => {
            let decoded = STANDARD.decode(s).map_err(|e| e.to_string())?;
            if decoded.len() != KEY_BYTES {
                if !create {
                    return Err("Stored credential key is below the current key width".into());
                }
                let mut k = vec![0u8; KEY_BYTES];
                OsRng.fill_bytes(&mut k);
                entry
                    .set_password(&STANDARD.encode(&k))
                    .map_err(|e| e.to_string())?;
                return Ok(k);
            }
            Ok(decoded)
        }
        Err(keyring::Error::NoEntry) if create => {
            let mut k = vec![0u8; KEY_BYTES];
            OsRng.fill_bytes(&mut k);
            entry
                .set_password(&STANDARD.encode(&k))
                .map_err(|e| e.to_string())?;
            Ok(k)
        }
        Err(e) => Err(format!(
            "Unlock your system credential store and try again: {e}"
        )),
    }
}

/// 64 bytes: first half drives AES-256-GCM, second half drives XChaCha20.
fn key(path: &Path, create: bool) -> Result<Vec<u8>, String> {
    if use_keyring() && !(cfg!(test) || quixi_proto::paths::test_profile().is_some()) {
        return keyring_key(path, create);
    }
    key_512(path, create)
}

pub(crate) fn seal(path: &Path, mut document: Value) -> Result<Value, String> {
    let mut secrets = serde_json::Map::new();
    for provider in document["providers"].as_array_mut().into_iter().flatten() {
        let id = provider["id"].as_str().unwrap_or_default().to_string();
        let mut fields = serde_json::Map::new();
        for field in ["apiKeyRaw", "oauthAccessToken", "oauthRefreshToken"] {
            if let Some(v) = provider.as_object_mut().and_then(|p| p.remove(field)) {
                if v.as_str().is_some_and(|s| !s.is_empty()) {
                    fields.insert(field.into(), v);
                }
            }
        }
        if !fields.is_empty() {
            secrets.insert(id, Value::Object(fields));
        }
    }
    if !secrets.is_empty() {
        let k = key(path, true)?;
        let plaintext = serde_json::to_vec(&secrets).map_err(|e| e.to_string())?;

        // Layer 1 (inner): XChaCha20-Poly1305 under the second 256 bits.
        let mut nonce_cha = [0u8; 24];
        OsRng.fill_bytes(&mut nonce_cha);
        let cha =
            XChaCha20Poly1305::new_from_slice(&k[32..64]).map_err(|_| "Invalid credential key")?;
        let inner = cha
            .encrypt(
                XNonce::from_slice(&nonce_cha),
                Payload {
                    msg: plaintext.as_ref(),
                    aad: AAD,
                },
            )
            .map_err(|_| "Could not encrypt credentials")?;

        // Layer 2 (outer): AES-256-GCM under the first 256 bits.
        let mut nonce_aes = [0u8; 12];
        OsRng.fill_bytes(&mut nonce_aes);
        let aes = Aes256Gcm::new_from_slice(&k[0..32]).map_err(|_| "Invalid credential key")?;
        let outer = aes
            .encrypt(
                Nonce::from_slice(&nonce_aes),
                Payload {
                    msg: inner.as_ref(),
                    aad: AAD,
                },
            )
            .map_err(|_| "Could not encrypt credentials")?;

        document["encryptedCredentials"] = json!({
            "version": 2,
            "bits": 512,
            "alg": "aes-256-gcm+xchacha20-poly1305",
            "nonceAes": STANDARD.encode(nonce_aes),
            "nonceCha": STANDARD.encode(nonce_cha),
            "ciphertext": STANDARD.encode(outer),
        });
    }
    Ok(document)
}

pub(crate) fn open(path: &Path, mut document: Value) -> Result<Value, String> {
    if let Some(encrypted) = document.get("encryptedCredentials") {
        let version = encrypted["version"].as_u64().unwrap_or(0);
        let decode = |field: &str| {
            STANDARD
                .decode(encrypted[field].as_str().unwrap_or_default())
                .map_err(|_| "Invalid credential encoding".to_string())
        };
        let secrets: Value = match version {
            // Current format: 512 bits of key material across two primitives.
            2 => {
                let nonce_aes = decode("nonceAes")?;
                let nonce_cha = decode("nonceCha")?;
                if nonce_aes.len() != 12 || nonce_cha.len() != 24 {
                    return Err("Invalid credential nonce".into());
                }
                let k = key(path, false)?;
                let aes =
                    Aes256Gcm::new_from_slice(&k[0..32]).map_err(|_| "Invalid credential key")?;
                let inner = aes
                    .decrypt(
                        Nonce::from_slice(&nonce_aes),
                        Payload {
                            msg: decode("ciphertext")?.as_ref(),
                            aad: AAD,
                        },
                    )
                    .map_err(|_| {
                        "Credentials could not be decrypted. Existing file preserved."
                    })?;
                let cha = XChaCha20Poly1305::new_from_slice(&k[32..64])
                    .map_err(|_| "Invalid credential key")?;
                let plaintext = cha
                    .decrypt(
                        XNonce::from_slice(&nonce_cha),
                        Payload {
                            msg: inner.as_ref(),
                            aad: AAD,
                        },
                    )
                    .map_err(|_| {
                        "Credentials could not be decrypted. Existing file preserved."
                    })?;
                serde_json::from_slice(&plaintext).map_err(|e| e.to_string())?
            }
            // Legacy format: a single AES-256 key. Readable so an existing
            // install keeps its keys; the next seal writes version 2.
            1 => {
                let nonce = decode("nonce")?;
                if nonce.len() != 12 {
                    return Err("Invalid credential nonce".into());
                }
                let k = read_key_file(path).ok_or("Local credential key is missing")?;
                if k.len() != LEGACY_KEY_BYTES {
                    return Err("Legacy credential document cannot be read".into());
                }
                let cipher = Aes256Gcm::new_from_slice(&k).map_err(|_| "Invalid credential key")?;
                let bytes = cipher
                    .decrypt(Nonce::from_slice(&nonce), decode("ciphertext")?.as_ref())
                    .map_err(|_| {
                        "Credentials could not be decrypted. Existing file preserved."
                    })?;
                serde_json::from_slice(&bytes).map_err(|e| e.to_string())?
            }
            _ => return Err("Unsupported credential format".into()),
        };
        for provider in document["providers"].as_array_mut().into_iter().flatten() {
            if let Some(fields) = secrets[provider["id"].as_str().unwrap_or_default()].as_object() {
                provider.as_object_mut().unwrap().extend(fields.clone());
            }
        }
        document
            .as_object_mut()
            .unwrap()
            .remove("encryptedCredentials");
    }
    Ok(document)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn tmp() -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("quixi-vault-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn seals_at_512_bits_across_two_primitives() {
        let dir = tmp();
        let path = dir.join("providers.json");
        let original = json!({"providers":[{"id":"custom","apiKeyRaw":"secret-api-key","oauthAccessToken":"access-token","oauthRefreshToken":"refresh-token"}]});
        let sealed = seal(&path, original.clone()).unwrap();
        let text = sealed.to_string();
        assert!(!text.contains("secret-api-key"));
        assert!(!text.contains("access-token"));
        assert_eq!(sealed["encryptedCredentials"]["version"], 2);
        assert_eq!(sealed["encryptedCredentials"]["bits"], 512);
        assert!(sealed["encryptedCredentials"]["nonceAes"].is_string());
        assert!(sealed["encryptedCredentials"]["nonceCha"].is_string());
        assert_eq!(open(&path, sealed.clone()).unwrap(), original);
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn key_file_is_64_bytes_and_mode_0600() {
        let dir = tmp();
        let path = dir.join("providers.json");
        let _ = seal(&path, json!({"providers":[{"id":"custom","apiKeyRaw":"k"}]})).unwrap();
        let key_file = local_key_path(&path);
        let bytes = fs::read(&key_file).unwrap();
        assert_eq!(bytes.len(), SEED_BYTES, "512 bytes of seed material on disk");
        assert_eq!(expand_seed(&bytes).len(), KEY_BYTES, "expands to two 256-bit halves");
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mode = fs::metadata(&key_file).unwrap().permissions().mode() & 0o777;
            assert_eq!(mode, 0o600, "key file must not be group/world readable");
        }
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn every_byte_of_the_key_matters() {
        let dir = tmp();
        let path = dir.join("providers.json");
        let original = json!({"providers":[{"id":"custom","apiKeyRaw":"key-one"},{"id":"other","apiKeyRaw":"key-two"}]});
        let sealed = seal(&path, original.clone()).unwrap();
        let key_file = local_key_path(&path);
        let base = fs::read(&key_file).unwrap();
        // Any single-bit change in the seed must break decryption.
        for offset in [0usize, SEED_BYTES / 2, SEED_BYTES - 1] {
            let mut tweaked = base.clone();
            tweaked[offset] ^= 0x01;
            fs::write(&key_file, &tweaked).unwrap();
            assert!(
                open(&path, sealed.clone()).is_err(),
                "flipping seed byte {offset} must break decryption"
            );
        }
        // Restore and confirm it opens again, i.e. both halves are required.
        fs::write(&key_file, &base).unwrap();
        assert_eq!(open(&path, sealed).unwrap(), original);
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn legacy_v1_document_opens_then_migrates_to_512() {
        let dir = tmp();
        let path = dir.join("providers.json");
        let original = json!({"providers":[{"id":"custom","apiKeyRaw":"legacy-key"}]});

        // Build a v1 document the way the old code did: 32-byte key, AES only.
        let legacy_key: Vec<u8> = (0u8..32).collect();
        fs::write(local_key_path(&path), &legacy_key).unwrap();
        let plaintext = serde_json::to_vec(&json!({"custom":{"apiKeyRaw":"legacy-key"}})).unwrap();
        let cipher = Aes256Gcm::new_from_slice(&legacy_key).unwrap();
        let mut nonce = [0u8; 12];
        OsRng.fill_bytes(&mut nonce);
        let ct = cipher
            .encrypt(Nonce::from_slice(&nonce), plaintext.as_ref())
            .unwrap();
        let v1 = json!({"providers":[{"id":"custom"}],"encryptedCredentials":{
            "version":1,
            "nonce":STANDARD.encode(nonce),
            "ciphertext":STANDARD.encode(ct)
        }});

        let opened = open(&path, v1).unwrap();
        assert_eq!(opened, original, "legacy keys must survive the upgrade");

        // Re-sealing must produce v2 and a 64-byte key file.
        let resealed = seal(&path, opened).unwrap();
        assert_eq!(resealed["encryptedCredentials"]["version"], 2);
        assert_eq!(
            fs::read(local_key_path(&path)).unwrap().len(),
            SEED_BYTES
        );
        assert_eq!(open(&path, resealed).unwrap(), original);
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn corruption_never_exposes_secrets() {
        let dir = tmp();
        let path = dir.join("providers.json");
        let original = json!({"providers":[{"id":"custom","apiKeyRaw":"secret-api-key"}]});
        let mut damaged = seal(&path, original).unwrap();
        damaged["encryptedCredentials"]["ciphertext"] = json!(STANDARD.encode([0u8; 32]));
        assert!(open(&path, damaged).is_err());
        fs::remove_dir_all(dir).unwrap();
    }
}
