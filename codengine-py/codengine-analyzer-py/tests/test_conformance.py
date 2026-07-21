"""Analyzer conformance: analyze each codengine-spec case's source.py and assert
the definitions deep-equal the shared expected.json.
"""

import json
import os
import unittest

from codengine_analyzer import analyze_source

HERE = os.path.dirname(os.path.abspath(__file__))
# tests -> codengine-analyzer-py -> codengine-py -> repo root -> codengine-spec
REPO = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
CASES = os.path.join(REPO, "codengine-spec", "conformance", "analyzer")


class AnalyzerConformanceTest(unittest.TestCase):
    """Test methods are generated below, one per case."""


def _generate():
    for name in sorted(os.listdir(CASES)):
        source = os.path.join(CASES, name, "source.py")
        expected_path = os.path.join(CASES, name, "expected.json")
        if not os.path.isfile(source):
            continue
        with open(expected_path, encoding="utf-8") as f:
            expected = json.load(f)

        def test(self, source=source, expected=expected):
            document = analyze_source(source)
            self.assertEqual(document["version"], "1")
            self.assertEqual(document["language"], "py")
            self.assertEqual(document["definitions"], expected)

        setattr(AnalyzerConformanceTest, f"test_{name}".replace("-", "_"), test)


_generate()


if __name__ == "__main__":
    unittest.main()
