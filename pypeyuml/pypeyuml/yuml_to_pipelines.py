import re
from pypeyuml.infer_type import infer_type
from pypeyuml.pipeline import Pipeline

def yuml_to_pipelines(yuml: str):
  pipelines: dict[str, Pipeline] = {}

  with open(yuml, 'r') as f:
    lines = f.readlines()
    lines = [line for line in lines if line.strip().startswith('[')]
  
  for i in range(len(lines)):
    matches = match_pipelines(lines[i])
    if len(matches):
      pipeline, function, args = parse_pipeline(matches[0])
      pipelines[pipeline] = pipelines[pipeline] if pipelines.get(pipeline) else Pipeline(pipeline, function)
      pipelines[pipeline].args.update(args)
      for j in range(i, len(lines)):
        matches = match_pipelines(lines[j])
        if len(matches) == 2:
          fromPipeline, _, _ = parse_pipeline(matches[0])
          toPipeline, _, _ = parse_pipeline(matches[1])
          if fromPipeline == pipeline:
            pipelines[pipeline].fanOut.append(toPipeline)
    
    matches = match_pipelines(lines[i])
    if len(matches) > 1:
      pipeline, function, args = parse_pipeline(matches[1])
      pipelines[pipeline] = pipelines[pipeline] if pipelines.get(pipeline) else Pipeline(pipeline, function)
      pipelines[pipeline].args.update(args)
      for j in range(i, len(lines)):
        matches = match_pipelines(lines[j])
        if len(matches) == 2:
          fromPipeline, _, _ = parse_pipeline(matches[0])
          toPipeline, _, _ = parse_pipeline(matches[1])
          if toPipeline == pipeline:
            pipelines[pipeline].fanIn.append(fromPipeline)

  return sorted(pipelines.values(), key=lambda pipeline: len(pipeline.fanIn))

def match_pipelines(line: str):
  return re.findall(r'\[([^\[\]]+)\]', line)

def parse_pipeline(match: str):
  parts = match.split('|')
  pipeline = parts[0].strip()
  function = pipeline.split(':')[0]
  args = parse_pipeline_args(parts)
  return pipeline, function, args

def parse_pipeline_args(parts: list[str]):
  args = {}
  if len(parts) > 1:
    for arg in parts[1:]:
      if '=' in arg:
        key, value = map(str.strip, arg.split('='))
        args[key] = infer_type(value)
  return args