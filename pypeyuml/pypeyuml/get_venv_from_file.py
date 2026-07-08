import re

def get_venv_from_file(path):
  with open(path) as f:
    content = f.read()
  match = re.search(r"venv: str = '(.*?)'", content)
  return match.group(1) if match else None