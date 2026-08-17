try:
    from pyscript import sync
except ImportError:
    sync = None

import rdflib
from rdflib import RDF, RDFS
from pyshacl import validate as _shacl_validate

SH = rdflib.Namespace("http://www.w3.org/ns/shacl#")

HISTORY_LIMIT = 50

_graph = rdflib.Graph()
_history = []
_future = []


def _snapshot():
    _history.append(_graph.serialize(format="turtle"))
    if len(_history) > HISTORY_LIMIT:
        _history.pop(0)
    _future.clear()


def history_status():
    return {"canUndo": bool(_history), "canRedo": bool(_future)}


def undo():
    global _graph
    if not _history:
        return _project(_graph)
    _future.append(_graph.serialize(format="turtle"))
    if len(_future) > HISTORY_LIMIT:
        _future.pop(0)
    graph = rdflib.Graph()
    graph.parse(data=_history.pop(), format="turtle")
    _graph = graph
    return _project(_graph)


def redo():
    global _graph
    if not _future:
        return _project(_graph)
    _history.append(_graph.serialize(format="turtle"))
    if len(_history) > HISTORY_LIMIT:
        _history.pop(0)
    graph = rdflib.Graph()
    graph.parse(data=_future.pop(), format="turtle")
    _graph = graph
    return _project(_graph)


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
    _snapshot()
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


def list_namespaces():
    return sorted(
        ({"prefix": prefix, "uri": str(uri)} for prefix, uri in _graph.namespaces()),
        key=lambda entry: entry["prefix"],
    )


def set_namespace(prefix, uri):
    _graph.bind(prefix, rdflib.Namespace(uri), override=True, replace=True)
    _graph.namespace_manager.reset()
    return {"projection": _project(_graph), "namespaces": list_namespaces()}


def _shacl_local_name(term):
    if term is None:
        return None
    text = str(term)
    return text.rsplit("#", 1)[-1].rsplit("/", 1)[-1]


def validate_shacl(shapes_text, shapes_format="turtle"):
    shapes_graph = rdflib.Graph()
    shapes_graph.parse(data=shapes_text, format=shapes_format)

    conforms, results_graph, results_text = _shacl_validate(
        _graph, shacl_graph=shapes_graph
    )

    violations = []
    for result in results_graph.subjects(RDF.type, SH.ValidationResult):
        focus_node = results_graph.value(result, SH.focusNode)
        path = results_graph.value(result, SH.resultPath)
        violations.append(
            {
                "focusNode": _term_id(focus_node) if focus_node is not None else None,
                "message": next(
                    (str(m) for m in results_graph.objects(result, SH.resultMessage)),
                    None,
                ),
                "severity": _shacl_local_name(
                    results_graph.value(result, SH.resultSeverity)
                ),
                "path": _compact(_graph, path)
                if isinstance(path, rdflib.URIRef)
                else None,
            }
        )

    return {
        "conforms": bool(conforms),
        "resultsText": str(results_text),
        "violations": violations,
    }


def add_node(iri, type_iri):
    _snapshot()
    _graph.add((rdflib.URIRef(iri), RDF.type, rdflib.URIRef(type_iri)))
    return _project(_graph)


def rename_node(old_id, new_iri):
    _snapshot()
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
    _snapshot()
    term = _term_from_id(node_id)
    _graph.remove((term, None, None))
    _graph.remove((None, None, term))
    return _project(_graph)


def add_type(node_id, type_iri):
    _snapshot()
    _graph.add((_term_from_id(node_id), RDF.type, rdflib.URIRef(type_iri)))
    return _project(_graph)


def delete_type(node_id, type_iri):
    _snapshot()
    _graph.remove((_term_from_id(node_id), RDF.type, rdflib.URIRef(type_iri)))
    return _project(_graph)


def add_edge(source_id, predicate_iri, target_id):
    _snapshot()
    _graph.add(
        (
            _term_from_id(source_id),
            rdflib.URIRef(predicate_iri),
            _term_from_id(target_id),
        )
    )
    return _project(_graph)


def delete_edge(source_id, predicate_iri, target_id):
    _snapshot()
    _graph.remove(
        (
            _term_from_id(source_id),
            rdflib.URIRef(predicate_iri),
            _term_from_id(target_id),
        )
    )
    return _project(_graph)


def add_property(node_id, predicate_iri, value, datatype=None, language=None):
    _snapshot()
    literal = rdflib.Literal(
        value,
        datatype=rdflib.URIRef(datatype) if datatype else None,
        lang=language or None,
    )
    _graph.add((_term_from_id(node_id), rdflib.URIRef(predicate_iri), literal))
    return _project(_graph)


def delete_property(node_id, predicate_iri, value, datatype=None, language=None):
    _snapshot()
    literal = rdflib.Literal(
        value,
        datatype=rdflib.URIRef(datatype) if datatype else None,
        lang=language or None,
    )
    _graph.remove((_term_from_id(node_id), rdflib.URIRef(predicate_iri), literal))
    return _project(_graph)


def update_property(
    node_id,
    predicate_iri,
    old_value,
    old_datatype,
    old_language,
    new_value,
    new_datatype=None,
    new_language=None,
):
    _snapshot()
    subject = _term_from_id(node_id)
    predicate = rdflib.URIRef(predicate_iri)
    old_literal = rdflib.Literal(
        old_value,
        datatype=rdflib.URIRef(old_datatype) if old_datatype else None,
        lang=old_language or None,
    )
    new_literal = rdflib.Literal(
        new_value,
        datatype=rdflib.URIRef(new_datatype) if new_datatype else None,
        lang=new_language or None,
    )
    _graph.remove((subject, predicate, old_literal))
    _graph.add((subject, predicate, new_literal))
    return _project(_graph)


if sync is not None:
    sync.ping = ping
    sync.load_rdf = load_rdf
    sync.current_projection = current_projection
    sync.serialize_rdf = serialize_rdf
    sync.list_predicates = list_predicates
    sync.list_namespaces = list_namespaces
    sync.set_namespace = set_namespace
    sync.validate_shacl = validate_shacl
    sync.add_node = add_node
    sync.rename_node = rename_node
    sync.delete_node = delete_node
    sync.add_type = add_type
    sync.delete_type = delete_type
    sync.add_edge = add_edge
    sync.delete_edge = delete_edge
    sync.add_property = add_property
    sync.delete_property = delete_property
    sync.update_property = update_property
    sync.history_status = history_status
    sync.undo = undo
    sync.redo = redo
