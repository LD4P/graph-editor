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
    history_status,
    list_namespaces,
    list_predicates,
    load_rdf,
    ping,
    redo,
    rename_node,
    serialize_rdf,
    set_namespace,
    undo,
    update_property,
    validate_shacl,
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


def test_update_property_replaces_value_in_a_single_undoable_step():
    load_rdf(f"<{ALICE}> <{KNOWS}> <{BOB}> .", format="nt")
    add_property(ALICE, NAME, "Alice", None, None)

    projection = update_property(ALICE, NAME, "Alice", None, None, "Alicia", None, None)
    alice = next(n for n in projection["nodes"] if n["id"] == ALICE)
    assert len(alice["properties"]) == 1
    assert alice["properties"][0]["value"] == "Alicia"

    # A single undo must restore the old value, not leave the property gone
    # (which is what would happen if update_property were delete+add as two
    # separately snapshotted mutations).
    projection = undo()
    alice = next(n for n in projection["nodes"] if n["id"] == ALICE)
    assert len(alice["properties"]) == 1
    assert alice["properties"][0]["value"] == "Alice"


def test_serialize_rdf_round_trips_through_a_different_format():
    load_rdf(
        """
        @prefix ex: <http://example.org/> .
        ex:alice ex:knows ex:bob .
        """
    )
    nt_text = serialize_rdf("nt")
    assert f"<{ALICE}>" in nt_text and f"<{KNOWS}>" in nt_text and f"<{BOB}>" in nt_text

    reloaded = load_rdf(nt_text, format="nt")
    assert {n["id"] for n in reloaded["nodes"]} == {ALICE, BOB}


SHAPES = """
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix ex: <http://example.org/> .

ex:PersonShape
    a sh:NodeShape ;
    sh:targetClass ex:Person ;
    sh:property [
        sh:path ex:name ;
        sh:minCount 1 ;
        sh:message "A person must have a name." ;
    ] .
"""


def test_validate_shacl_reports_no_violations_when_conformant():
    load_rdf(
        f"""
        @prefix ex: <http://example.org/> .
        ex:alice a ex:Person ;
            ex:name "Alice" .
        """
    )
    result = validate_shacl(SHAPES)
    assert result["conforms"] is True
    assert result["violations"] == []


def test_validate_shacl_reports_violation_with_focus_node_and_message():
    load_rdf(
        f"""
        @prefix ex: <http://example.org/> .
        ex:bob a ex:Person .
        """
    )
    result = validate_shacl(SHAPES)
    assert result["conforms"] is False
    (violation,) = result["violations"]
    assert violation["focusNode"] == BOB
    assert violation["message"] == "A person must have a name."
    assert violation["severity"] == "Violation"


def test_list_namespaces_includes_bound_prefix():
    load_rdf(
        """
        @prefix ex: <http://example.org/> .
        ex:alice ex:knows ex:bob .
        """
    )
    namespaces = {entry["prefix"]: entry["uri"] for entry in list_namespaces()}
    assert namespaces["ex"] == "http://example.org/"


def test_set_namespace_changes_compaction_of_new_terms():
    load_rdf(f"<{ALICE}> <{KNOWS}> <{BOB}> .", format="nt")
    result = set_namespace("ex", "http://example.org/")
    namespaces = {entry["prefix"]: entry["uri"] for entry in result["namespaces"]}
    assert namespaces["ex"] == "http://example.org/"

    assert result["projection"]["edges"][0]["predicate"] == "ex:knows"


def test_undo_reverts_last_mutation():
    load_rdf(f"<{ALICE}> <{KNOWS}> <{BOB}> .", format="nt")
    add_node(ALICE, PERSON)
    assert history_status()["canUndo"] is True

    projection = undo()
    ids = {n["id"] for n in projection["nodes"]}
    assert ids == {ALICE, BOB}
    (edge,) = projection["edges"]
    assert edge["source"] == ALICE
    assert edge["target"] == BOB
    assert edge["predicateIri"] == KNOWS


def test_redo_reapplies_undone_mutation():
    load_rdf("", format="nt")
    add_node(ALICE, PERSON)
    undo()
    assert history_status()["canRedo"] is True

    projection = redo()
    (node,) = projection["nodes"]
    assert node["id"] == ALICE
    assert [t["typeIri"] for t in node["types"]] == [PERSON]
    assert history_status()["canRedo"] is False


def test_new_mutation_after_undo_clears_redo_stack():
    load_rdf("", format="nt")
    add_node(ALICE, PERSON)
    undo()
    assert history_status()["canRedo"] is True

    add_node(BOB, PERSON)
    assert history_status()["canRedo"] is False


def test_undo_and_redo_are_no_ops_when_history_is_empty():
    load_rdf("", format="nt")
    while history_status()["canUndo"]:
        undo()
    projection_before = undo()
    assert projection_before == current_projection()

    while history_status()["canRedo"]:
        redo()
    projection_after = redo()
    assert projection_after == current_projection()


def test_history_is_capped_at_fifty_entries():
    load_rdf("", format="nt")
    for i in range(60):
        add_node(f"http://example.org/n{i}", PERSON)

    undo_count = 0
    while history_status()["canUndo"]:
        undo()
        undo_count += 1
    assert undo_count == 50


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
