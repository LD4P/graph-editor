import { useRef, useState } from "react";
import { addNode, loadRdf } from "../lib/pyBridge";
import { useGraphStore } from "../state/graphStore";
import { useDialogStore } from "../state/dialogStore";

const SAMPLE_TURTLE = `@prefix ex: <http://example.org/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

ex:alice a ex:Person ;
    rdfs:label "Alice" ;
    ex:knows ex:bob .

ex:bob a ex:Person ;
    ex:name "Bob" .
`;

const FORMATS = [
  { value: "turtle", label: "Turtle (.ttl)" },
  { value: "xml", label: "RDF/XML (.rdf, .xml)" },
  { value: "json-ld", label: "JSON-LD (.jsonld, .json)" },
  { value: "nt", label: "N-Triples (.nt)" },
];

export default function Toolbar() {
  const setProjection = useGraphStore((state) => state.setProjection);
  const resetPositions = useGraphStore((state) => state.resetPositions);
  const selectNode = useGraphStore((state) => state.selectNode);
  const openDialog = useDialogStore((state) => state.openDialog);

  const [text, setText] = useState(SAMPLE_TURTLE);
  const [format, setFormat] = useState("turtle");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function loadText(rdfText: string) {
    setLoading(true);
    setError(null);
    try {
      setText(rdfText);
      resetPositions();
      selectNode(null);
      setProjection(await loadRdf(rdfText, format));
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    await loadText(await file.text());
  }

  async function handleFetchUrl() {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      const rdfText = await response.text();
      setText(rdfText);
      resetPositions();
      selectNode(null);
      setProjection(await loadRdf(rdfText, format));
    } catch (err) {
      setError(
        `Could not fetch "${url}": ${String(err)}. If this is a CORS error, the server hosting that RDF document needs to allow cross-origin requests.`,
      );
    } finally {
      setLoading(false);
    }
  }

  function handleAddResource() {
    openDialog({
      title: "Add resource",
      fields: [
        { name: "iri", label: "Resource IRI", placeholder: "http://example.org/newThing" },
        { name: "typeIri", label: "Type IRI", placeholder: "http://example.org/Thing" },
      ],
      onSubmit: async (values) => {
        if (!values.iri || !values.typeIri) return;
        setProjection(await addNode(values.iri, values.typeIri));
      },
    });
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: "0.5rem 1rem",
        borderBottom: "1px solid #ddd",
      }}
    >
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <label>
          Format:{" "}
          <select value={format} onChange={(event) => setFormat(event.target.value)}>
            {FORMATS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <button onClick={() => fileInputRef.current?.click()} disabled={loading}>
          Load file...
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".ttl,.turtle,.rdf,.xml,.jsonld,.json,.nt"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />

        <input
          type="url"
          placeholder="https://example.org/data.ttl"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          style={{ width: 280 }}
        />
        <button onClick={handleFetchUrl} disabled={loading}>
          Load URL
        </button>

        <button onClick={handleAddResource} style={{ marginLeft: "auto" }}>
          Add resource
        </button>
      </div>

      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={6}
        style={{ fontFamily: "monospace", fontSize: 12 }}
      />
      <div>
        <button onClick={() => loadText(text)} disabled={loading}>
          {loading ? "loading..." : "Load"}
        </button>
        {error && <span style={{ marginLeft: "1rem", color: "crimson" }}>{error}</span>}
      </div>
    </div>
  );
}
