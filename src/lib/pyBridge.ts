import type { RdfProjection } from "../model/rdfGraphModel";

const PYSCRIPT_CORE_URL = "https://pyscript.net/releases/2026.7.3/core.js";

interface PyWorkerHandle {
  sync: Record<string, (...args: unknown[]) => Promise<unknown>>;
}

type PyWorkerFactory = (
  path: string,
  options: { type: "pyodide" | "micropython"; config?: string },
) => Promise<PyWorkerHandle>;

let workerPromise: Promise<PyWorkerHandle> | null = null;

function getWorker(): Promise<PyWorkerHandle> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const core = (await import(/* @vite-ignore */ PYSCRIPT_CORE_URL)) as {
        PyWorker: PyWorkerFactory;
      };
      return core.PyWorker("/py/rdf_service.py", {
        type: "pyodide",
        config: "/py/pyscript.toml",
      });
    })();
  }
  return workerPromise;
}

export async function ping(): Promise<string> {
  const worker = await getWorker();
  return (await worker.sync.ping()) as string;
}

export async function loadRdf(
  text: string,
  format: string,
): Promise<RdfProjection> {
  const worker = await getWorker();
  return (await worker.sync.load_rdf(text, format)) as RdfProjection;
}

export async function currentProjection(): Promise<RdfProjection> {
  const worker = await getWorker();
  return (await worker.sync.current_projection()) as RdfProjection;
}
