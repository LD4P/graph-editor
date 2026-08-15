# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

This repository is a fresh scaffold with no commits yet and no implemented functionality. `main.py` is a placeholder ("Hello from 36-02-graph-editor!"). There is no architecture to document yet — when real code is added, update this file with the actual module layout and design.

## Setup

The project uses two parallel, currently-unconnected toolchains:

- **Python**: managed with [uv](https://docs.astral.sh/uv/), Python >=3.10 (pinned to 3.10 in `.python-version`). Dependencies are declared in `pyproject.toml` (currently none).
- **Node**: a bare `package.json` (CommonJS, `index.js` as main) with no dependencies and no real scripts yet.

## Common commands

```bash
# Run the Python entry point
uv run main.py

# Add a Python dependency
uv add <package>

# Sync/install Python dependencies
uv sync
```

The `npm test` script is the npm-init default and just errors out — there is no real Node test suite configured.
