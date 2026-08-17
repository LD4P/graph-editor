import { useState } from "react";
import type { RdfProjection } from "../model/rdfGraphModel";
import { loadRdf } from "../lib/pyBridge";

const SAMPLE_TURTLE = `@prefix ex: <http://example.org/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

ex:alice a ex:Person ;
    rdfs:label "Alice" ;
    ex:knows ex:bob .

ex:bob a ex:Person ;
    ex:name "Bob" .
`;

export default function Toolbar({
  onLoaded,
}: {
  onLoaded: (projection: RdfProjection) => void;
}) {
  const [text, setText] = useState(SAMPLE_TURTLE);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLoad() {
    setLoading(true);
    setError(null);
    try {
      onLoaded(await loadRdf(text, "turtle"));
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
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
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={6}
        style={{ fontFamily: "monospace", fontSize: 12 }}
      />
      <div>
        <button onClick={handleLoad} disabled={loading}>
          {loading ? "loading..." : "Load Turtle"}
        </button>
        {error && <span style={{ marginLeft: "1rem", color: "crimson" }}>{error}</span>}
      </div>
    </div>
  );
}
