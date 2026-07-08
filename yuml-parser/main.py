import sys
from pathlib import Path
from yuml_parser.yuml_to_json import yuml_to_json

if __name__ == "__main__":
  if len(sys.argv) != 2:
    print("Usage: python main.py <workflow.yuml|dir>")
    sys.exit(1)

  input_path = Path(sys.argv[1])

  if input_path.is_file() and input_path.suffix == '.yuml':
    yuml_to_json(input_path)

  elif input_path.is_dir():
    yuml_files = list(input_path.rglob("*.yuml"))
    if not yuml_files:
      print(f"No .yuml files found: {input_path}")
    for yuml_file in yuml_files:
      yuml_to_json(yuml_file)

  else:
    print("The path '{input_path}' needs to be a .yuml file or a valid directory.")
    sys.exit(1)
