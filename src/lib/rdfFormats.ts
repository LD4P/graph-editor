export const FORMATS = [
  { value: "turtle", label: "Turtle (.ttl)" },
  { value: "xml", label: "RDF/XML (.rdf, .xml)" },
  { value: "json-ld", label: "JSON-LD (.jsonld, .json)" },
  { value: "nt", label: "N-Triples (.nt)" },
];

export const FILE_EXTENSIONS: Record<string, string> = {
  turtle: "ttl",
  xml: "rdf",
  "json-ld": "jsonld",
  nt: "nt",
};
