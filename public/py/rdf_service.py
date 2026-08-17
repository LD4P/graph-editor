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


def _term_from_id(term_id):
    if term_id.startswith("_:"):
        return rdflib.BNode(term_id[2:])
    return rdflib.URIRef(term_id)


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
            ensure_node(s)["types"].append(
                {"type": _compact(graph, o), "typeIri": str(o)}
            )
            continue
        if isinstance(o, rdflib.Literal):
            ensure_node(s)["properties"].append(
                {
                    "predicate": _compact(graph, p),
                    "predicateIri": str(p),
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
                    "id": f"{_term_id(s)}|{p}|{_term_id(o)}",
                    "source": _term_id(s),
                    "target": _term_id(o),
                    "predicate": _compact(graph, p),
                    "predicateIri": str(p),
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


def serialize_rdf(format="turtle"):
    return _graph.serialize(format=format)


def list_predicates():
    return sorted({str(p) for p in _graph.predicates()})


def add_node(iri, type_iri):
    _graph.add((rdflib.URIRef(iri), RDF.type, rdflib.URIRef(type_iri)))
    return _project(_graph)


def rename_node(old_id, new_iri):
    old_term = _term_from_id(old_id)
    new_term = rdflib.URIRef(new_iri)
    for s, p, o in list(_graph.triples((old_term, None, None))):
        _graph.remove((s, p, o))
        _graph.add((new_term, p, o))
    for s, p, o in list(_graph.triples((None, None, old_term))):
        _graph.remove((s, p, o))
        _graph.add((s, p, new_term))
    return _project(_graph)


def delete_node(node_id):
    term = _term_from_id(node_id)
    _graph.remove((term, None, None))
    _graph.remove((None, None, term))
    return _project(_graph)


def add_type(node_id, type_iri):
    _graph.add((_term_from_id(node_id), RDF.type, rdflib.URIRef(type_iri)))
    return _project(_graph)


def delete_type(node_id, type_iri):
    _graph.remove((_term_from_id(node_id), RDF.type, rdflib.URIRef(type_iri)))
    return _project(_graph)


def add_edge(source_id, predicate_iri, target_id):
    _graph.add(
        (
            _term_from_id(source_id),
            rdflib.URIRef(predicate_iri),
            _term_from_id(target_id),
        )
    )
    return _project(_graph)


def delete_edge(source_id, predicate_iri, target_id):
    _graph.remove(
        (
            _term_from_id(source_id),
            rdflib.URIRef(predicate_iri),
            _term_from_id(target_id),
        )
    )
    return _project(_graph)


def add_property(node_id, predicate_iri, value, datatype=None, language=None):
    literal = rdflib.Literal(
        value,
        datatype=rdflib.URIRef(datatype) if datatype else None,
        lang=language or None,
    )
    _graph.add((_term_from_id(node_id), rdflib.URIRef(predicate_iri), literal))
    return _project(_graph)


def delete_property(node_id, predicate_iri, value, datatype=None, language=None):
    literal = rdflib.Literal(
        value,
        datatype=rdflib.URIRef(datatype) if datatype else None,
        lang=language or None,
    )
    _graph.remove((_term_from_id(node_id), rdflib.URIRef(predicate_iri), literal))
    return _project(_graph)


if sync is not None:
    sync.ping = ping
    sync.load_rdf = load_rdf
    sync.current_projection = current_projection
    sync.serialize_rdf = serialize_rdf
    sync.list_predicates = list_predicates
    sync.add_node = add_node
    sync.rename_node = rename_node
    sync.delete_node = delete_node
    sync.add_type = add_type
    sync.delete_type = delete_type
    sync.add_edge = add_edge
    sync.delete_edge = delete_edge
    sync.add_property = add_property
    sync.delete_property = delete_property
