from rdf_service import (
    add_edge,
    add_node,
    add_property,
    add_type,
    current_projection,
    delete_edge,
    delete_node,
    delete_property,
    delete_type,
    list_predicates,
    load_rdf,
    ping,
    rename_node,
)

ALICE = "http://example.org/alice"
BOB = "http://example.org/bob"
KNOWS = "http://example.org/knows"
NAME = "http://example.org/name"
PERSON = "http://example.org/Person"


def test_ping():
    assert ping() == "pong"


def test_load_rdf_projects_resource_nodes_and_edges():
    projection = load_rdf(
        """
        @prefix ex: <http://example.org/> .
        ex:alice a ex:Person ;
            ex:name "Alice" ;
            ex:knows ex:bob .
        """
    )

    nodes_by_id = {node["id"]: node for node in projection["nodes"]}
    assert set(nodes_by_id) == {ALICE, BOB}

    alice = nodes_by_id[ALICE]
    assert alice["types"] == [{"type": "ex:Person", "typeIri": PERSON}]
    assert alice["properties"] == [
        {
            "predicate": "ex:name",
            "predicateIri": NAME,
            "value": "Alice",
            "datatype": None,
            "language": None,
        }
    ]

    assert projection["edges"] == [
        {
            "id": f"{ALICE}|{KNOWS}|{BOB}",
            "source": ALICE,
            "target": BOB,
            "predicate": "ex:knows",
            "predicateIri": KNOWS,
        }
    ]


def test_load_rdf_uses_rdfs_label_when_present():
    projection = load_rdf(
        """
        @prefix ex: <http://example.org/> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        ex:alice rdfs:label "Alice Smith" .
        """
    )
    (node,) = projection["nodes"]
    assert node["label"] == "Alice Smith"


def test_load_rdf_assigns_stable_ids_to_blank_nodes():
    projection = load_rdf(
        """
        @prefix ex: <http://example.org/> .
        ex:alice ex:address [ ex:city "Palo Alto" ] .
        """
    )
    blank_nodes = [n for n in projection["nodes"] if n["id"].startswith("_:")]
    assert len(blank_nodes) == 1
    assert blank_nodes[0]["properties"][0]["value"] == "Palo Alto"


def test_current_projection_reflects_last_loaded_graph():
    load_rdf(f"<{ALICE}> <{KNOWS}> <{BOB}> .", format="nt")
    assert current_projection()["edges"]


def test_add_node_creates_a_typed_resource():
    load_rdf("", format="nt")
    projection = add_node(ALICE, PERSON)
    (node,) = projection["nodes"]
    assert node["id"] == ALICE
    assert [t["typeIri"] for t in node["types"]] == [PERSON]


def test_rename_node_rewrites_subject_and_object_triples():
    load_rdf(f"<{ALICE}> <{KNOWS}> <{BOB}> .", format="nt")
    renamed = "http://example.org/alicia"
    projection = rename_node(ALICE, renamed)
    ids = {n["id"] for n in projection["nodes"]}
    assert ids == {renamed, BOB}
    assert projection["edges"][0]["source"] == renamed


def test_delete_node_removes_triples_as_subject_and_object():
    load_rdf(
        f"""
        <{ALICE}> <{KNOWS}> <{BOB}> .
        <{BOB}> <{NAME}> "Bob" .
        """,
        format="nt",
    )
    projection = delete_node(BOB)
    assert projection["nodes"] == []
    assert projection["edges"] == []


def test_add_and_delete_type():
    load_rdf(f'<{ALICE}> <{NAME}> "Alice" .', format="nt")
    projection = add_type(ALICE, PERSON)
    assert [t["typeIri"] for t in projection["nodes"][0]["types"]] == [PERSON]

    projection = delete_type(ALICE, PERSON)
    assert projection["nodes"][0]["types"] == []


def test_add_and_delete_edge():
    load_rdf(f'<{ALICE}> <{NAME}> "Alice" .\n<{BOB}> <{NAME}> "Bob" .', format="nt")
    projection = add_edge(ALICE, KNOWS, BOB)
    edge = projection["edges"][0]
    assert edge["id"] == f"{ALICE}|{KNOWS}|{BOB}"
    assert edge["source"] == ALICE
    assert edge["target"] == BOB
    assert edge["predicateIri"] == KNOWS

    projection = delete_edge(ALICE, KNOWS, BOB)
    assert projection["edges"] == []


def test_add_and_delete_property():
    load_rdf(f"<{ALICE}> <{KNOWS}> <{BOB}> .", format="nt")
    projection = add_property(ALICE, NAME, "Alice", None, None)
    alice = next(n for n in projection["nodes"] if n["id"] == ALICE)
    assert len(alice["properties"]) == 1
    assert alice["properties"][0]["predicateIri"] == NAME
    assert alice["properties"][0]["value"] == "Alice"

    projection = delete_property(ALICE, NAME, "Alice", None, None)
    alice = next(n for n in projection["nodes"] if n["id"] == ALICE)
    assert alice["properties"] == []


def test_list_predicates_returns_unique_full_iris():
    load_rdf(
        f"""
        <{ALICE}> <{KNOWS}> <{BOB}> .
        <{ALICE}> <{NAME}> "Alice" .
        <{BOB}> <{NAME}> "Bob" .
        """,
        format="nt",
    )
    assert list_predicates() == sorted([KNOWS, NAME])
