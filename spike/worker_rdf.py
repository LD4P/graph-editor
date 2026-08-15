from pyscript import sync


def ping():
    return "pong"


def rdflib_check():
    import rdflib

    g = rdflib.Graph()
    g.parse(
        data="""
        @prefix ex: <http://example.org/> .
        ex:alice ex:knows ex:bob .
        ex:alice ex:name "Alice" .
        """,
        format="turtle",
    )
    return {"rdflib_version": rdflib.__version__, "triple_count": len(g)}


def pyshacl_check():
    import pyshacl
    import rdflib

    data = rdflib.Graph()
    data.parse(
        data="""
        @prefix ex: <http://example.org/> .
        ex:alice a ex:Person .
        """,
        format="turtle",
    )
    shapes = rdflib.Graph()
    shapes.parse(
        data="""
        @prefix ex: <http://example.org/> .
        @prefix sh: <http://www.w3.org/ns/shacl#> .
        ex:PersonShape a sh:NodeShape ;
            sh:targetClass ex:Person ;
            sh:property [ sh:path ex:name ; sh:minCount 1 ] .
        """,
        format="turtle",
    )
    conforms, results_graph, results_text = pyshacl.validate(data, shacl_graph=shapes)
    return {
        "pyshacl_version": getattr(pyshacl, "__version__", "unknown"),
        "conforms": conforms,
        "results_text": results_text,
    }


sync.ping = ping
sync.rdflib_check = rdflib_check
sync.pyshacl_check = pyshacl_check
