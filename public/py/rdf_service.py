try:
    from pyscript import sync
except ImportError:
    sync = None

import rdflib
from rdflib import RDF, RDFS
from pyshacl import validate as _shacl_validate

SH = rdflib.Namespace("http://www.w3.org/ns/shacl#")

HISTORY_LIMIT = 50

# LD4P/Sinopia vocabularies rdflib doesn't bind by default, kept available for
# compaction/autocomplete even before a loaded graph uses them.
_EXTRA_NAMESPACES = {
    "bf": "http://id.loc.gov/ontologies/bibframe/",
    "bflc": "http://id.loc.gov/ontologies/bflc/",
    "pmo": "http://performedmusicontology.org/ontology/",
    "sinopia": "http://sinopia.io/vocabulary/",
}


def _new_graph():
    graph = rdflib.Graph()
    for prefix, uri in _EXTRA_NAMESPACES.items():
        graph.bind(prefix, rdflib.Namespace(uri))
    return graph


_graph = _new_graph()
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
    graph = _new_graph()
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
    graph = _new_graph()
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


def _resolve_iri(value):
    """Expand a bound prefix (e.g. "rdf:type") to its full URI.

    Falls back to treating `value` as a literal URI whenever it isn't a
    "prefix:suffix" CURIE with a prefix currently bound on the graph --
    which is also what happens for a plain absolute URI like
    "http://example.org/name", since "http" is never a bound prefix.
    """
    try:
        return _graph.namespace_manager.expand_curie(value)
    except (ValueError, TypeError):
        return rdflib.URIRef(value)


def _resolve_value_term(value):
    """Interpret an Add-property Value input as a blank node, an IRI, or None.

    Recognizes "_:name" for a blank node (reusing an existing one if that
    id is already in the graph), "<...>" or a bound "prefix:local" CURIE
    or an absolute "scheme://..." URI for a resource reference. Returns
    None for anything else, meaning the caller should build a Literal --
    the historical behavior, and still what happens for the vast majority
    of property values.
    """
    if value.startswith("_:"):
        return rdflib.BNode(value[2:])
    if value.startswith("<") and value.endswith(">"):
        return rdflib.URIRef(value[1:-1])
    if "://" in value:
        return rdflib.URIRef(value)
    if ":" in value:
        prefix = value.split(":", 1)[0]
        if _graph.namespace_manager.store.namespace(prefix) is not None:
            return _resolve_iri(value)
    return None


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


def _cbd_groups(graph):
    """Give every typed, named resource a boundary around its full CBD.

    Only subjects that carry an rdf:type triple are considered as roots —
    every "real" resource in a Sinopia/BIBFRAME-style graph is typed. A
    subject's boundary is itself plus every term across its CBD's triples,
    with one heuristic: a URI object is folded into the boundary only if
    it has NO rdf:type triple of its own in the graph. A typed URI is an
    independently addressable resource and gets its own separate boundary
    instead (e.g. `ex:alice ex:knows ex:bob`, both typed, render as two
    boxes joined by the edge). An untyped URI is just a stub reference —
    common for externally-described agents/subjects in real BIBFRAME data
    — and folds in exactly like a blank node would, at any depth.

    Two boundaries can still share a member if two typed subjects both
    reference the same untyped resource or blank node; merge any that do
    so no two boxes ever overlap on screen.
    """
    raw_groups = []
    for subject in sorted(set(graph.subjects(predicate=RDF.type)), key=str):
        if not isinstance(subject, rdflib.URIRef):
            continue
        members = {_term_id(subject)}
        for triple_s, triple_p, triple_o in graph.cbd(subject):
            if triple_p == RDF.type:
                continue
            if isinstance(triple_s, rdflib.BNode):
                members.add(_term_id(triple_s))
            if isinstance(triple_o, rdflib.BNode):
                members.add(_term_id(triple_o))
            elif isinstance(triple_o, rdflib.URIRef) and (
                triple_o,
                RDF.type,
                None,
            ) not in graph:
                members.add(_term_id(triple_o))
        raw_groups.append({"roots": {_term_id(subject)}, "members": members})

    clusters = []
    for group in raw_groups:
        overlapping = [c for c in clusters if c["members"] & group["members"]]
        for other in overlapping:
            clusters.remove(other)
        merged_roots = set(group["roots"])
        merged_members = set(group["members"])
        for other in overlapping:
            merged_roots |= other["roots"]
            merged_members |= other["members"]
        clusters.append({"roots": merged_roots, "members": merged_members})

    groups = []
    for cluster in clusters:
        root = min(cluster["roots"], key=str)
        # The box label is the root's rdfs:label if it has one, otherwise
        # its own full URI -- never a compacted/prefixed qname (rdflib
        # auto-generates ns1:, ns2:, ... prefixes for unbound namespaces,
        # which is not an identifier a user can act on).
        root_label = graph.value(rdflib.URIRef(root), RDFS.label)
        label = str(root_label) if root_label is not None else root
        groups.append(
            {"root": root, "label": label, "members": sorted(cluster["members"])}
        )
    return groups


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

    return {"nodes": list(nodes.values()), "edges": edges, "groups": _cbd_groups(graph)}


def load_rdf(text, format="turtle"):
    global _graph
    _snapshot()
    graph = _new_graph()
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
    _graph.add((_term_from_id(node_id), RDF.type, _resolve_iri(type_iri)))
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
            _resolve_iri(predicate_iri),
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
    object_term = _resolve_value_term(value)
    if object_term is None:
        object_term = rdflib.Literal(
            value,
            datatype=_resolve_iri(datatype) if datatype else None,
            lang=language or None,
        )
    _graph.add((_term_from_id(node_id), _resolve_iri(predicate_iri), object_term))
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
        datatype=_resolve_iri(new_datatype) if new_datatype else None,
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
