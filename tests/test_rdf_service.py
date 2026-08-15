from rdf_service import ping


def test_ping():
    assert ping() == "pong"
