import { describe, expect, it } from "vitest";
import { findResources } from "./findResources";
import type { RdfNode } from "../model/rdfGraphModel";

function node(id: string, label: string): RdfNode {
  return { id, label, types: [], properties: [] };
}

const nodes = [
  node("http://example.org/bob", "Bob"),
  node("http://example.org/alice", "Alice"),
  node("http://example.org/malice", "Malice"),
  node("http://example.org/person/42", "ex:person/42"),
];

describe("findResources", () => {
  it("returns nothing for a blank query", () => {
    expect(findResources(nodes, "   ")).toEqual([]);
  });

  it("matches labels case-insensitively, prefix matches first", () => {
    expect(findResources(nodes, "ALI").map((n) => n.label)).toEqual(["Alice", "Malice"]);
  });

  it("falls back to matching the IRI", () => {
    expect(findResources(nodes, "example.org/b").map((n) => n.id)).toEqual([
      "http://example.org/bob",
    ]);
  });

  it("ranks label matches above IRI-only matches", () => {
    const results = findResources(
      [node("http://example.org/x", "Unrelated"), node("http://example.org/y", "example")],
      "example",
    );
    expect(results.map((n) => n.label)).toEqual(["example", "Unrelated"]);
  });

  it("respects the limit", () => {
    expect(findResources(nodes, "example.org", 2)).toHaveLength(2);
  });
});
