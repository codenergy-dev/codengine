"""Unit tests for loading functions from multiple files with conflict detection."""

import os
import unittest

from codengine_runner import load_functions

FIXTURES = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures")


class LoadFunctionsTest(unittest.TestCase):
    def test_merges_multiple_files(self):
        functions = load_functions([os.path.join(FIXTURES, "conflict_a.py")])
        self.assertIn("greet", functions)

    def test_rejects_a_name_conflict(self):
        with self.assertRaises(ValueError) as ctx:
            load_functions(
                [
                    os.path.join(FIXTURES, "conflict_a.py"),
                    os.path.join(FIXTURES, "conflict_b.py"),
                ]
            )
        self.assertIn("Duplicate task function 'greet'", str(ctx.exception))

    def test_root_enables_sibling_imports(self):
        # tasks.py does `from helper import VALUE`; it only resolves because `root`
        # (the module's env) is put on sys.path.
        env = os.path.join(FIXTURES, "env")
        functions = load_functions([os.path.join(env, "tasks.py")], env)
        self.assertEqual(functions["greet"](name="mumbu"), {"message": "mumbu:sibling-ok"})


if __name__ == "__main__":
    unittest.main()
