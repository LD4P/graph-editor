export interface RdfProperty {
  predicate: string;
  value: string;
  datatype: string | null;
  language: string | null;
}

export interface RdfNode {
  id: string;
  label: string;
  types: string[];
  properties: RdfProperty[];
}

export interface RdfEdge {
  id: string;
  source: string;
  target: string;
  predicate: string;
}

export interface RdfProjection {
  nodes: RdfNode[];
  edges: RdfEdge[];
}
