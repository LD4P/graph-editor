# A Graph-based RDF Editor
Currently hosted at https://ld4p.github.io/graph-editor/

## Running Locally

The app runs entirely in the browser, so running it locally just means starting the Vite dev
server. There's no backend.

### 1. Install and start the frontend

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually http://localhost:5173/). The site is served from `/`
locally, and `BASE_PATH` is only set for the GitHub Pages deploy.

### 2. First load needs internet

The RDF engine (`public/py/rdf_service.py`) runs in [Pyodide](https://pyodide.org/) via
[PyScript](https://pyscript.net/). On the first load, the browser downloads Pyodide and the
`rdflib` and `pyshacl` packages listed in `public/py/pyscript.toml`. That first load takes a few
seconds and needs a network connection. Local Python isn't used for this part.

### 3. Optional: Python tests

These test the RDF logic directly, without a browser. You'll need
[uv](https://docs.astral.sh/uv/) installed:

```bash
uv run pytest
```

uv reads the Python version from `.python-version` and installs the dependencies in
`pyproject.toml` on the first run.

### Other commands

- `npm test`: run the TypeScript tests (Vitest)
- `npm run build`: type-check and build for production into `dist/`
- `npm run preview`: serve the production build locally
