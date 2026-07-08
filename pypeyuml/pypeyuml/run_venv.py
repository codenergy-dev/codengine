import importlib.util
import sys
import json

def load_function(path: str, function_name: str):
  spec = importlib.util.spec_from_file_location("worker_module", path)
  module = importlib.util.module_from_spec(spec)
  spec.loader.exec_module(module)
  return getattr(module, function_name)

if __name__ == "__main__":
  if len(sys.argv) < 4:
    print("Usage: python run_venv.py <pipeline_path> <function_name> <args_json_path>")
    sys.exit(1)

  pipeline_path = sys.argv[1]
  function_name = sys.argv[2]
  args_path = sys.argv[3]

  with open(args_path) as f:
    args = json.load(f)

  func = load_function(pipeline_path, function_name)
  result = func(**args)

  with open("output/result.json", "w") as f:
    json.dump(result, f)