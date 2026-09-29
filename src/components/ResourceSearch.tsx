import { useMemo, useState } from "react";
import { findResources } from "../lib/findResources";
import { useGraphStore } from "../state/graphStore";
import type { RdfNode } from "../model/rdfGraphModel";

export default function ResourceSearch() {
  const nodes = useGraphStore((state) => state.projection.nodes);
  const focusNode = useGraphStore((state) => state.focusNode);

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const matches = useMemo(() => findResources(nodes, query), [nodes, query]);

  function choose(node: RdfNode) {
    focusNode(node.id);
    setQuery("");
    setOpen(false);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((index) => Math.min(index + 1, matches.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && matches[active]) {
      event.preventDefault();
      choose(matches[active]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  const showList = open && query.trim() !== "";

  return (
    <div style={{ position: "relative" }}>
      <input
        type="search"
        placeholder="Find resource..."
        aria-label="Find resource"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={handleKeyDown}
        style={{ width: 220 }}
      />
      {showList && (
        <ul
          role="listbox"
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            zIndex: 10,
            minWidth: 320,
            maxWidth: 480,
            margin: 0,
            padding: 0,
            listStyle: "none",
            background: "white",
            border: "1px solid #ccc",
            boxShadow: "0 2px 6px rgba(0, 0, 0, 0.15)",
          }}
        >
          {matches.length === 0 && (
            <li style={{ padding: "4px 8px", color: "#888" }}>No matching resources</li>
          )}
          {matches.map((node, index) => (
            <li
              key={node.id}
              role="option"
              aria-selected={index === active}
              // mousedown, not click, so the choice lands before the input's blur closes the list
              onMouseDown={(event) => {
                event.preventDefault();
                choose(node);
              }}
              onMouseEnter={() => setActive(index)}
              style={{
                padding: "4px 8px",
                cursor: "pointer",
                background: index === active ? "#e8f0fe" : undefined,
              }}
            >
              <div>{node.label}</div>
              <div
                style={{
                  fontSize: 11,
                  color: "#666",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {node.id}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
