try:
    from pyscript import sync
except ImportError:
    sync = None

import rdflib
from rdflib import RDF, RDFS

_graph = rdflib.Graph()


def ping():
    return "pong"


def _term_id(term):
    if isinstance(term, rdflib.BNode):
        return f"_:{term}"
    return str(term)


def _compact(graph, term):
    if isinstance(term, rdflib.BNode):
        return f"_:{term}"
    try:
        return graph.qname(term)
    except Exception:
        return str(term)


def _label_for(graph, subject):
    label = graph.value(subject, RDFS.label)
    if label is not None:
        return str(label)
    return _compact(graph, subject)


def _project(graph):
    nodes = {}
    edges = []

    def ensure_node(term):
        node_id = _term_id(term)
        if node_id not in nodes:
            nodes[node_id] = {
                "id": node_id,
                "label": _label_for(graph, term),
                "types": [],
                "properties": [],
            }
        return nodes[node_id]

    for s, p, o in graph:
        if p == RDF.type:
            ensure_node(s)["types"].append(_compact(graph, o))
            continue
        if isinstance(o, rdflib.Literal):
            ensure_node(s)["properties"].append(
                {
                    "predicate": _compact(graph, p),
                    "value": str(o),
                    "datatype": str(o.datatype) if o.datatype else None,
                    "language": o.language,
                }
            )
        else:
            ensure_node(s)
            ensure_node(o)
            edges.append(
                {
                    "id": f"{_term_id(s)}|{_compact(graph, p)}|{_term_id(o)}",
                    "source": _term_id(s),
                    "target": _term_id(o),
                    "predicate": _compact(graph, p),
                }
            )

    return {"nodes": list(nodes.values()), "edges": edges}


def load_rdf(text, format="turtle"):
    global _graph
    graph = rdflib.Graph()
    graph.parse(data=text, format=format)
    _graph = graph
    return _project(_graph)


def current_projection():
    return _project(_graph)


if sync is not None:
    sync.ping = ping
    sync.load_rdf = load_rdf
    sync.current_projection = current_projection
