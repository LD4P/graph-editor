from rdf_service import current_projection, load_rdf


def test_ping():
    from rdf_service import ping

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
    assert set(nodes_by_id) == {"http://example.org/alice", "http://example.org/bob"}

    alice = nodes_by_id["http://example.org/alice"]
    assert alice["types"] == ["ex:Person"]
    assert alice["properties"] == [
        {
            "predicate": "ex:name",
            "value": "Alice",
            "datatype": None,
            "language": None,
        }
    ]

    assert projection["edges"] == [
        {
            "id": "http://example.org/alice|ex:knows|http://example.org/bob",
            "source": "http://example.org/alice",
            "target": "http://example.org/bob",
            "predicate": "ex:knows",
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
    assert blank_nodes[0]["properties"] == [
        {
            "predicate": "ex:city",
            "value": "Palo Alto",
            "datatype": None,
            "language": None,
        }
    ]


def test_current_projection_reflects_last_loaded_graph():
    load_rdf(
        """
        @prefix ex: <http://example.org/> .
        ex:alice ex:knows ex:bob .
        """
    )
    assert current_projection()["edges"]
