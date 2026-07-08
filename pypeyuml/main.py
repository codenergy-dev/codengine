from pypeyuml.run_pipelines import run_pipelines
from pypeyuml.yuml_to_pipelines import yuml_to_pipelines

if __name__ == "__main__":
  import sys
  if len(sys.argv) != 3:
    print("Usage: python main.py <pipelines.yuml> <pipelines_dir>")
    sys.exit(1)

  yuml_path = sys.argv[1]
  pipelines_dir = sys.argv[2]

  pipelines = yuml_to_pipelines(yuml_path)
  run_pipelines(pipelines_dir, pipelines)