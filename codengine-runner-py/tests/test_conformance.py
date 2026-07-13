"""Runner conformance: execute every codengine-spec runs/*.json fixture and assert
it matches expectedOutput. This is the SAME suite codengine-runner-ts runs, so a
green result here proves cross-language parity.
"""

import json
import os
import unittest

from codengine_runner import run

HERE = os.path.dirname(os.path.abspath(__file__))
# tests -> codengine-runner-py -> repo root -> codengine-spec
REPO = os.path.dirname(os.path.dirname(HERE))
CASES = os.path.join(REPO, "codengine-spec", "conformance", "cases")

# Natural signatures per the invocation contract: named binding drops extras,
# `**data` receives everything.
CATALOG = {
    "echo": lambda **data: data,
    "pass": lambda **data: True,
    "nil": lambda **data: None,
    "emit": lambda n: [{"i": i} for i in range(n)],
    "route": lambda route: route,
    "pick": lambda i: i,
    "output": lambda **data: data,
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
        ir = _load(os.path.join(CASES, name, "workflow.json"))
        for run_file in sorted(os.listdir(runs_dir)):
            if not run_file.endswith(".json"):
                continue
            spec = _load(os.path.join(runs_dir, run_file))

            def test(self, ir=ir, spec=spec):
                actual = run(ir, CATALOG, spec["entry"], spec["input"])
                self.assertEqual(actual, spec["expectedOutput"])

            method = f"test_{name}_{run_file[:-5]}".replace("-", "_")
            setattr(ConformanceTest, method, test)


_generate_tests()


if __name__ == "__main__":
    unittest.main()
