"""CLI: `python -m codengine_analyzer <file.py>` prints the task definitions."""

import json
import sys

from .analyze import analyze_source


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: python -m codengine_analyzer <file.py>", file=sys.stderr)
        return 1
    json.dump(analyze_source(sys.argv[1]), sys.stdout, indent=2)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
