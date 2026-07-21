"""Unit tests for the function invocation contract (named binding)."""

import unittest

from codengine_runner.runtime import MissingInputError, _invoke

TASK = {"name": "t"}


class InvocationTest(unittest.TestCase):
    def test_named_binding_drops_extras(self):
        def fn(a, b):
            return {"sum": a + b}

        self.assertEqual(_invoke(TASK, fn, {"a": 1, "b": 2, "c": 99}), {"sum": 3})

    def test_var_keyword_receives_everything(self):
        def fn(**data):
            return data

        self.assertEqual(_invoke(TASK, fn, {"a": 1, "b": 2}), {"a": 1, "b": 2})

    def test_optional_default_used_when_absent(self):
        def fn(a, b=10):
            return {"sum": a + b}

        self.assertEqual(_invoke(TASK, fn, {"a": 1}), {"sum": 11})

    def test_missing_required_raises_normalized_error(self):
        def fn(a, b):
            return a + b

        with self.assertRaises(MissingInputError) as ctx:
            _invoke(TASK, fn, {"a": 1})
        self.assertIn("missing required input(s): b", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
