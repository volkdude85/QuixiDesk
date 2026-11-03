// Dump every function's decompiled C to stdout, in address order.
// @category Quixi
// @runtime Java
import ghidra.app.decompiler.DecompInterface;
import ghidra.app.decompiler.DecompileResults;
import ghidra.app.script.GhidraScript;
import ghidra.program.model.listing.Function;
import ghidra.program.model.listing.FunctionIterator;

public class DumpDecomp extends GhidraScript {
    @Override
    public void run() throws Exception {
        int limit = 200;
        String envLimit = System.getenv("QUIXI_GHIDRA_MAX_FUNCTIONS");
        if (envLimit != null) {
            try {
                limit = Integer.parseInt(envLimit.trim());
            } catch (NumberFormatException ignored) {
                // keep the default rather than failing the whole run over a bad env var
            }
        }
        int timeout = 30;
        String envTimeout = System.getenv("QUIXI_GHIDRA_FN_TIMEOUT");
        if (envTimeout != null) {
            try {
                timeout = Integer.parseInt(envTimeout.trim());
            } catch (NumberFormatException ignored) {
                // as above
            }
        }

        DecompInterface ifc = new DecompInterface();
        ifc.openProgram(currentProgram);
        FunctionIterator fns = currentProgram.getFunctionManager().getFunctions(true);
        int printed = 0;
        while (fns.hasNext() && printed < limit) {
            Function f = fns.next();
            if (f.isThunk()) {
                continue;
            }
            println("// " + f.getEntryPoint() + "  " + f.getName());
            DecompileResults r = ifc.decompileFunction(f, timeout, monitor);
            if (r != null && r.decompileCompleted() && r.getDecompiledFunction() != null) {
                println(r.getDecompiledFunction().getC());
            } else {
                println("// (decompilation failed: " + (r == null ? "no result" : r.getErrorMessage()) + ")");
            }
            println("");
            printed++;
        }
        println("// " + printed + " function(s) printed" + (fns.hasNext() ? ", more remain — raise QUIXI_GHIDRA_MAX_FUNCTIONS" : ""));
        ifc.dispose();
    }
}
