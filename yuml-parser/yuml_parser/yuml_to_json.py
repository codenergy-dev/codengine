import json
from pathlib import Path
from yuml_parser.parse_yuml import parse_yuml

def yuml_to_json(yuml_file: Path):
  try:
    pipelines = parse_yuml(str(yuml_file))
    pipelines_json = [pipeline.__dict__ for pipeline in pipelines]

    output_file = yuml_file.with_suffix('.json')
    with open(output_file, 'w', encoding='utf-8') as f:
      json.dump(pipelines_json, f, indent=2, ensure_ascii=False)

    print(f"✅ {yuml_file}: {output_file}")
  except Exception as e:
    print(f"❌ {yuml_file}: {e}")