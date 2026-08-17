export interface RdfProperty {
  predicate: string;
  predicateIri: string;
  value: string;
  datatype: string | null;
  language: string | null;
}

export interface RdfType {
  type: string;
  typeIri: string;
}

export interface RdfNode {
  id: string;
  label: string;
  types: RdfType[];
  properties: RdfProperty[];
}

export interface RdfEdge {
  id: string;
  source: string;
  target: string;
  predicate: string;
  predicateIri: string;
}

export interface RdfProjection {
  nodes: RdfNode[];
  edges: RdfEdge[];
}
