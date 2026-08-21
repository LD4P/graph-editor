# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Browser-only RDF graph editor (no backend/server): a React + React Flow canvas on top of an
in-browser Python RDF engine. All RDF parsing, SHACL validation, and graph mutation happens in
Python (rdflib/pyshacl), running client-side via PyScript/Pyodide — the two toolchains are
connected through a JS↔Python bridge, not parallel/unconnected.

Hosted at https://ld4p.github.io/graph-editor/, deployed via `.github/workflows/deploy-pages.yml`.

## Architecture

- `public/py/rdf_service.py` — the RDF engine. Holds the single in-memory `rdflib.Graph`,
  undo/redo history, and all mutation functions (add/delete/rename node, add/delete edge,
  add/update/delete property, SHACL validation, namespace management). Every mutating function
  snapshots history first, then returns `_project(graph)`: a plain-dict `{nodes, edges}`
  projection of the graph for the UI. When run under PyScript, functions are registered on
  `sync.*` so JS can call them directly.
- `src/lib/pyBridge.ts` — lazily boots the Pyodide worker (via PyScript's `PyWorker`, loaded
  from `public/py/pyscript.toml`) and exposes typed async wrappers around each `sync.*` function.
- `src/model/rdfGraphModel.ts` — TS types mirroring the Python projection shapes
  (`RdfProjection`, `RdfNode`, `RdfEdge`, SHACL/namespace result types).
- `src/state/graphStore.ts` (zustand) — holds the current projection, node positions, selection,
  and undo/redo status; `setProjection` also fires autosave to `localStorage`.
- `src/lib/layout.ts` — runs dagre over the projection to lay out React Flow nodes/edges,
  respecting any manually-dragged position overrides from the store.
- `src/components/` — `GraphCanvas.tsx` (React Flow canvas), `ResourceNode.tsx` /
  `ResourcePredicateEdge.tsx` (custom node/edge renderers with inline editing), `Inspector.tsx`,
  `NamespacePanel.tsx`, `ValidationPanel.tsx`, `Toolbar.tsx`, `Dialog.tsx`, `AutosaveBanner.tsx`.

Python and TypeScript are edited in lockstep: a new mutation exposed from `rdf_service.py` needs
a matching `sync.*` registration, a `pyBridge.ts` wrapper, and (if the projection shape changes) a
`rdfGraphModel.ts` update.

## Setup

- **Python**: managed with [uv](https://docs.astral.sh/uv/), Python >=3.10 (pinned in
  `.python-version`). Deps (`rdflib`, `pyshacl`, `pytest` dev dep) are declared in `pyproject.toml`.
- **Node**: Vite + React 19 + TypeScript + `@xyflow/react` (React Flow) + `@dagrejs/dagre` +
  zustand. Deps in `package.json`.

## Common commands

```bash
# Frontend dev server
npm run dev

# Type-check + production build
npm run build

# Python tests (exercise rdf_service.py directly, no browser/Pyodide needed)
uv run pytest
```

`tests/test_rdf_service.py` imports `rdf_service` directly (pytest's `pythonpath` is set to
`public/py` in `pyproject.toml`) and is the fast way to verify RDF-logic changes without spinning
up the browser/Pyodide runtime. There is no Node test suite configured (`npm test` is unused).
