import re

from pypeyuml.infer_type import infer_type

def parse_yuml(yuml_path):
  with open(yuml_path, 'r') as f:
    lines = f.readlines()

  nodes = {}
  edges = []

  for line in lines:
    if not line.strip().startswith('['):
      continue

    matches = re.findall(r'\[([^\[\]]+)\]', line)
    if len(matches) == 1:
      parts = matches[0].split('|')
      name = parts[0].strip()
      args = {}
      if len(parts) > 1:
        for arg in parts[1:]:
          if '=' in arg:
            k, v = map(str.strip, arg.split('='))
            args[k] = infer_type(v)
      nodes[name] = args
    elif len(matches) == 2:
      edges.append((matches[0].split('|')[0].strip(), matches[1].split('|')[0].strip()))

  return nodes, edges