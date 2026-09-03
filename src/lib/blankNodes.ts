/** The notation that marks a value as a blank node, matching `rdf_service._resolve_value_term`. */
export const BLANK_NODE_PREFIX = "_:";

const LABEL_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";
const LABEL_LENGTH = 6;

function randomLabel(): string {
  const bytes = new Uint8Array(LABEL_LENGTH);
  crypto.getRandomValues(bytes);
  // Start with a letter so the label stays a valid NCName for RDF/XML output.
  let label = "n";
  for (const byte of bytes) {
    label += LABEL_CHARS[byte % LABEL_CHARS.length];
  }
  return label;
}

/** Suggest a blank node id (e.g. "_:n4f2a9c") that isn't already in the graph. */
export function generateBlankNodeId(taken: Iterable<string> = []): string {
  const used = new Set(taken);
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = `${BLANK_NODE_PREFIX}${randomLabel()}`;
    if (!used.has(candidate)) return candidate;
  }
  return `${BLANK_NODE_PREFIX}n${Date.now().toString(36)}`;
}
