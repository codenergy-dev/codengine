import importlib.util
import inspect
import sys

def load_module(file):
    spec = importlib.util.spec_from_file_location('spec', file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

def list_functions(module):
    functions = []
    for key, value in inspect.getmembers(module, inspect.isfunction):
        if value.__module__ == module.__name__:
            functions.append(value)
    return functions

def inspect_function(function):
    signature = inspect.signature(function)
    print(f"Function: {function.__name__}")
    for name, param in signature.parameters.items():
        annotation = param.annotation if param.annotation != inspect._empty else "undefined"
        default = param.default if param.default != inspect._empty else "undefined"
        print(f" - {name}: type = {annotation}, default = {default}")
    return_annotation = signature.return_annotation if signature.return_annotation != inspect._empty else "undefined"
    print(f" → Returns: {return_annotation}\n")

file = sys.argv[1]
module = load_module(file)

for func in list_functions(module):
    inspect_function(func)
    break
