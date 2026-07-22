# codengine-loader-py

Load a Python module's task functions into a function map, detecting name conflicts.
Depends on [`codengine-core`](../codengine-core-py/) for the contract types.

```python
from codengine_loader import load_functions

functions = load_functions(["tasks.py"], root=".")
# `root` goes on sys.path so the functions' own imports resolve.
# A name defined in two files raises: rename one, or split into separate modules.
```
