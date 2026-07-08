import json
import os
from pathlib import Path
import subprocess

def run_pipeline_venv(venv_path, script_path, args) -> dict:
  result_path = os.path.join("output", "result.json")
  args_path = os.path.join("output", "args.json")

  with open(args_path, "w") as f:
    json.dump(args, f)

  if os.path.exists(result_path):
    os.remove(result_path)
  
  pypeyuml_root = Path(__file__).resolve().parent
  run_venv_path = os.path.join(pypeyuml_root, "run_venv.py")

  func_name = os.path.splitext(os.path.basename(script_path))[0]
  venv_python = os.path.join(os.path.abspath(venv_path), "bin", "python")

  subprocess.run([
    venv_python,
    run_venv_path,
    script_path,
    func_name,
    args_path
  ], check=True)

  if os.path.exists(result_path):
    with open(result_path) as f:
      return json.load(f)
  else:
    raise RuntimeError(f"Pipeline in venv '{venv_path}' did not return result.json.")