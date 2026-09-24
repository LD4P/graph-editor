import { afterEach, describe, expect, it, vi } from "vitest";
import { generateBlankNodeId } from "./blankNodes";

describe("generateBlankNodeId", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a _: id whose label starts with a letter", () => {
    expect(generateBlankNodeId()).toMatch(/^_:n[a-z0-9]{6}$/);
  });

  it("skips ids already in the graph", () => {
    // The first draw is all zero bytes ("_:naaaaaa"), the second all ones ("_:nbbbbbb").
    let draw = 0;
    vi.spyOn(crypto, "getRandomValues").mockImplementation((array) => {
      (array as Uint8Array).fill(draw++);
      return array;
    });
    expect(generateBlankNodeId(["_:naaaaaa"])).toBe("_:nbbbbbb");
  });
});
