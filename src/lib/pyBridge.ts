import type {
  HistoryStatus,
  RdfNamespace,
  RdfProjection,
  SetNamespaceResult,
  ShaclValidationResult,
} from "../model/rdfGraphModel";

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
      return core.PyWorker(`${import.meta.env.BASE_URL}py/rdf_service.py`, {
        type: "pyodide",
        config: `${import.meta.env.BASE_URL}py/pyscript.toml`,
      });
    })();
  }
  return workerPromise;
}

async function call<T>(name: string, ...args: unknown[]): Promise<T> {
  const worker = await getWorker();
  return (await worker.sync[name](...args)) as T;
}

export const ping = () => call<string>("ping");

export const loadRdf = (text: string, format: string) =>
  call<RdfProjection>("load_rdf", text, format);

export const currentProjection = () =>
  call<RdfProjection>("current_projection");

export const serializeRdf = (format: string) => call<string>("serialize_rdf", format);

export const listPredicates = () => call<string[]>("list_predicates");

export const validateShacl = (shapesText: string, shapesFormat: string) =>
  call<ShaclValidationResult>("validate_shacl", shapesText, shapesFormat);

export const listNamespaces = () => call<RdfNamespace[]>("list_namespaces");

export const setNamespace = (prefix: string, uri: string) =>
  call<SetNamespaceResult>("set_namespace", prefix, uri);

export const historyStatus = () => call<HistoryStatus>("history_status");

export const undo = () => call<RdfProjection>("undo");

export const redo = () => call<RdfProjection>("redo");

export const addNode = (iri: string, typeIri: string) =>
  call<RdfProjection>("add_node", iri, typeIri);

export const renameNode = (oldId: string, newIri: string) =>
  call<RdfProjection>("rename_node", oldId, newIri);

export const deleteNode = (nodeId: string) =>
  call<RdfProjection>("delete_node", nodeId);

export const addType = (nodeId: string, typeIri: string) =>
  call<RdfProjection>("add_type", nodeId, typeIri);

export const deleteType = (nodeId: string, typeIri: string) =>
  call<RdfProjection>("delete_type", nodeId, typeIri);

export const addEdge = (sourceId: string, predicateIri: string, targetId: string) =>
  call<RdfProjection>("add_edge", sourceId, predicateIri, targetId);

export const deleteEdge = (sourceId: string, predicateIri: string, targetId: string) =>
  call<RdfProjection>("delete_edge", sourceId, predicateIri, targetId);

export const addProperty = (
  nodeId: string,
  predicateIri: string,
  value: string,
  datatype: string | null,
  language: string | null,
) => call<RdfProjection>("add_property", nodeId, predicateIri, value, datatype, language);

export const deleteProperty = (
  nodeId: string,
  predicateIri: string,
  value: string,
  datatype: string | null,
  language: string | null,
) =>
  call<RdfProjection>(
    "delete_property",
    nodeId,
    predicateIri,
    value,
    datatype,
    language,
  );

export const updateProperty = (
  nodeId: string,
  predicateIri: string,
  oldValue: string,
  oldDatatype: string | null,
  oldLanguage: string | null,
  newValue: string,
  newDatatype: string | null,
  newLanguage: string | null,
) =>
  call<RdfProjection>(
    "update_property",
    nodeId,
    predicateIri,
    oldValue,
    oldDatatype,
    oldLanguage,
    newValue,
    newDatatype,
    newLanguage,
  );
