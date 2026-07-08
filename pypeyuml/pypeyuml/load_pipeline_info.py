import importlib.util
import os

from pypeyuml.get_venv_from_file import get_venv_from_file
from pypeyuml.print_key_values import print_key_values
from pypeyuml.run_pipeline_venv import run_pipeline_venv

def load_pipeline_info(pipelines_dir, pipeline_name):
  filename = os.path.join(pipelines_dir, f"{pipeline_name}.py")
  if not os.path.exists(filename):
    raise FileNotFoundError(f"File {filename} not found.")

  venv_path = get_venv_from_file(filename)
  if venv_path:
    return load_pipeline_function_venv(pipeline_name, filename, venv_path)
  else:
    return load_pipeline_function(pipeline_name, filename)

def load_pipeline_function(pipeline_name, filename):
  spec = importlib.util.spec_from_file_location(pipeline_name, filename)
  module = importlib.util.module_from_spec(spec)
  spec.loader.exec_module(module)
  func = getattr(module, pipeline_name)

  def run(args):
    print(f"\n▶️  {pipeline_name}")
    print_key_values(args)
    return func(**args)
  return run

def load_pipeline_function_venv(pipeline_name, filename, venv_path):
  def run(args):
    print(f"\n▶️  {pipeline_name}")
    print_key_values({ "venv": venv_path, **args })
    return run_pipeline_venv(venv_path, filename, args)
  return run