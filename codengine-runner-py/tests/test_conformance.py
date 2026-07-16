"""Runner conformance: for every codengine-spec case with runs/, load all of its
workflows as a registry and execute each run, asserting expectedOutput. This is the
SAME suite codengine-runner-ts runs, so a green result here proves cross-language
parity.
"""

import json
import os
import unittest

from codengine_runner import run

HERE = os.path.dirname(os.path.abspath(__file__))
# tests -> codengine-runner-py -> repo root -> codengine-spec
REPO = os.path.dirname(os.path.dirname(HERE))
CASES = os.path.join(REPO, "codengine-spec", "conformance", "cases")


def _trail(name):
    """Appends its own name to `trail`, so expectedOutput proves which tasks ran."""

    def fn(**data):
        return {"trail": [*data.get("trail", []), name]}

    return fn


# Natural signatures per the invocation contract: named binding drops extras,
# `**data` receives everything. Functions are bound per module.
CATALOG = {
    "": {
        "echo": lambda **data: data,
        "pass": lambda **data: True,
        "nil": lambda **data: None,
        "emit": lambda n: [{"i": i} for i in range(n)],
        "route": lambda route: route,
        "pick": lambda i: i,
        "output": lambda **data: data,
        "start": _trail("start"),
    },
    "chain": {
        "a": _trail("a"),
        "b": _trail("b"),
        "c": _trail("c"),
        "d": _trail("d"),
        "e": _trail("e"),
    },
}


class ConformanceTest(unittest.TestCase):
    """Test methods are generated below, one per run fixture."""


def _load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _generate_tests():
    for name in sorted(os.listdir(CASES)):
        runs_dir = os.path.join(CASES, name, "runs")
        if not os.path.isdir(runs_dir):
            continue

        workflows_dir = os.path.join(CASES, name, "workflows")
        workflows = [
            _load(os.path.join(workflows_dir, f))
            for f in sorted(os.listdir(workflows_dir))
            if f.endswith(".json")
        ]

        for run_file in sorted(os.listdir(runs_dir)):
            if not run_file.endswith(".json"):
                continue
            spec = _load(os.path.join(runs_dir, run_file))

            def test(self, workflows=workflows, spec=spec):
                actual = run(workflows, CATALOG, spec["entry"], spec["input"])
                self.assertEqual(actual, spec["expectedOutput"])

            method = f"test_{name}_{run_file[:-5]}".replace("-", "_")
            setattr(ConformanceTest, method, test)


_generate_tests()


if __name__ == "__main__":
    unittest.main()
