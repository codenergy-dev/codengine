"""Entrypoint: `python -m codengine_worker` — the persistent worker the orchestrator
spawns for a Python module in a cross-language run."""

from .worker import serve

if __name__ == "__main__":
    serve()
