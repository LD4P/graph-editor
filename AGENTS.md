# AGENTS.md

This file provides guidance to AI agents when working with code in this repository.

## Project Overview

Browser-only RDF graph editor (no backend/server): a React + React Flow canvas on top of an in-browser Python RDF engine. All RDF parsing, SHACL validation, and graph mutation happens in Python (rdflib/pyshacl), running client-side via PyScript/Pyodide — the two toolchains are connected through a JS↔Python bridge, not parallel/unconnected.

Hosted at https://ld4p.github.io/graph-editor/, deployed via `.github/workflows/deploy-pages.yml`.

## Architecture

- `public/py/rdf_service.py` — the RDF engine. Holds the single in-memory `rdflib.Graph`, undo/redo history, and all mutation functions (add/delete/rename node, add/delete edge, add/update/delete property, SHACL validation, namespace management). Every mutating function snapshots history first, then returns `_project(graph)`: a plain-dict `{nodes, edges}` projection of the graph for the UI. When run under PyScript, functions are registered on `sync.*` so JS can call them directly.
- `src/lib/pyBridge.ts` — lazily boots the Pyodide worker (via PyScript's `PyWorker`, loaded from `public/py/pyscript.toml`) and exposes typed async wrappers around each `sync.*` function.
- `src/model/rdfGraphModel.ts` — TS types mirroring the Python projection shapes (`RdfProjection`, `RdfNode`, `RdfEdge`, SHACL/namespace result types).
- `src/state/graphStore.ts` (zustand) — holds the current projection, node positions, selection, and undo/redo status; `setProjection` also fires autosave to `localStorage`.
- `src/lib/layout.ts` — lays out the projection as React Flow nodes/edges, with either the force-directed layout (default) or dagre, chosen by `layoutMode` in the store. Manually-dragged positions from the store are always kept.
- `src/lib/forceLayout.ts` — Springy-style force simulation used by the default layout. CBD groups stay clustered, an overlap pass keeps cards and group boxes apart, dragged nodes stay pinned, and each run warm-starts from the previous `settled` positions (kept in `GraphCanvas`) so edits don't reshuffle the graph.
- `src/components/` — `GraphCanvas.tsx` (React Flow canvas), `ResourceNode.tsx` / `ResourcePredicateEdge.tsx` (custom node/edge renderers with inline editing), `CbdGroupNode.tsx` (CBD group boxes), `Inspector.tsx`, `NamespacePanel.tsx`, `ValidationPanel.tsx`, `Toolbar.tsx`, `Dialog.tsx`, `AutosaveBanner.tsx`.
- `src/lib/autosave.ts` — localStorage autosave logic.
- `src/lib/rdfFormats.ts` — RDF serialization format utilities.
- `src/lib/blankNodes.ts` — blank node ID generation and handling.
- `src/state/dialogStore.ts` — dialog state management (zustand).
- `src/state/panelStore.ts` — panel visibility state (zustand).

Python and TypeScript are edited in lockstep: a new mutation exposed from `rdf_service.py` needs a matching `sync.*` registration, a `pyBridge.ts` wrapper, and (if the projection shape changes) a `rdfGraphModel.ts` update.

## Setup

- **Python**: managed with [uv](https://docs.astral.sh/uv/), Python >=3.10 (pinned in `.python-version`). Deps (`rdflib`, `pyshacl`) and dev deps (`pytest`, `jupyterlab`) are declared in `pyproject.toml`.
- **Node**: Vite + React 19 + TypeScript + `@xyflow/react` (React Flow) + `@dagrejs/dagre` + zustand. Deps in `package.json`.

## Common Commands

```bash
# Frontend dev server
npm run dev

# Type-check + production build
npm run build

# Python tests (exercise rdf_service.py directly, no browser/Pyodide needed)
uv run pytest

# TypeScript tests (Vitest; *.test.ts files next to the code they test)
npm test
```

`tests/test_rdf_service.py` imports `rdf_service` directly (pytest's `pythonpath` is set to `public/py` in `pyproject.toml`) and is the fast way to verify RDF-logic changes without spinning up the browser/Pyodide runtime. Test fixtures live in `tests/fixtures/`. `npm test` runs the Vitest suite, which covers layout code (`forceLayout.test.ts`, `layout.test.ts`) and blank node handling (`blankNodes.test.ts`).

## Before You Finish

1. Run tests: `uv run pytest` for Python changes, `npm test` for TypeScript changes.
2. For any TypeScript change, also run `npm run build` to catch type errors.
3. Work on a feature branch and open a PR (see history: PRs #12–#14).
4. Never hand-edit `uv.lock` or `package-lock.json`; let the package managers handle them.
