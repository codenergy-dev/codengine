"""Drive the persistent worker as a subprocess over stdio."""

import json
import os
import subprocess
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
FIXTURES = os.path.join(HERE, "fixtures")
TASKS = os.path.join(FIXTURES, "tasks.py")


def roundtrip(requests):
    proc = subprocess.Popen(
        [sys.executable, "-m", "codengine_worker"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        text=True,
    )
    payload = "".join(json.dumps(r) + "\n" for r in requests)
    out, _ = proc.communicate(payload, timeout=30)
    return [json.loads(line) for line in out.splitlines() if line.strip()]


class WorkerTest(unittest.TestCase):
    def test_load_then_call(self):
        responses = roundtrip(
            [
                {"op": "load", "module": "", "files": [TASKS], "root": FIXTURES},
                {"op": "call", "module": "", "function": "greet", "input": {"name": "Py"}},
            ]
        )
        self.assertEqual(responses[0], {"ok": True})
        self.assertEqual(responses[1], {"result": {"message": "Hello, Py!"}})

    def test_call_chain_feeds_forward(self):
        responses = roundtrip(
            [
                {"op": "load", "module": "", "files": [TASKS], "root": FIXTURES},
                {
                    "op": "callChain",
                    "module": "",
                    "functions": ["step_a", "step_b"],
                    "input": {"x": 1},
                },
            ]
        )
        # step_a({x:1}) -> {x:2}; step_b({x:2}) -> {x:4}; input fed to step_b was {x:2}
        self.assertEqual(responses[1], {"result": {"x": 4}, "consumed": 2, "input": {"x": 2}})

    def test_missing_function_reports_error(self):
        responses = roundtrip(
            [
                {"op": "load", "module": "", "files": [TASKS], "root": FIXTURES},
                {"op": "call", "module": "", "function": "nope", "input": {}},
            ]
        )
        self.assertIn("error", responses[1])


if __name__ == "__main__":
    unittest.main()
