import re
from pathlib import Path
from yuml_parser.parse_value import parse_value
from yuml_parser.pipeline import Pipeline

def parse_yuml(yuml: str):
  workflow = Path(yuml).name.split('.')[0]
  pipelines: dict[str, Pipeline] = {}

  with open(yuml, 'r') as f:
    lines = f.readlines()
    lines = [line for line in lines if line.strip().startswith('[')]
  
  for i in range(len(lines)):
    matches = match_pipelines(lines[i])
    if len(matches):
      set_pipelines(workflow, pipelines, matches[0], i, lines)
    if len(matches) > 1:
      set_pipelines(workflow, pipelines, matches[1], i, lines)

  for pipeline in pipelines.values():
    pipeline.fanIn = list(dict.fromkeys(pipeline.fanIn))
    pipeline.fanInNullable = list(dict.fromkeys(pipeline.fanInNullable))
    pipeline.fanOut = list(dict.fromkeys(pipeline.fanOut))
    
    if pipeline.entrypoint and pipeline.path and (len(pipeline.fanIn) > 0 or len(pipeline.fanOut) == 0):
      pipeline.entrypoint = False
    
  for pipeline in pipelines.values():
    pipeline.dependencies = list_pipeline_dependencies(pipelines, pipeline, [])
    pipeline.dependencies.reverse()
    pipeline.dependencies = list(dict.fromkeys(pipeline.dependencies))
  
  for pipeline in pipelines.values():
    pipeline.executionPlan = list_pipeline_execution_plan(pipelines, pipeline, [])
    pipeline.executionPlan = list(dict.fromkeys(pipeline.executionPlan))
  
  for pipeline in pipelines.values():
    if not pipeline.entrypoint:
      pipeline.executionPlan = pipeline.executionPlan[len(pipeline.dependencies):]
  
  return sorted(pipelines.values(), key=lambda pipeline: len(pipeline.fanIn))

def match_pipelines(line: str):
  return re.findall(r'\[([^\[\]]+)\]', line)

def set_pipelines(
  workflow: str,
  pipelines: dict[str, Pipeline],
  match: str,
  index: int,
  lines: list[str],
):
  if match.startswith('note:'):
    return
  
  pipeline, function, path, args = parse_pipeline(match)
  pipelines[pipeline] = pipelines[pipeline] if pipelines.get(pipeline) else Pipeline(pipeline, function, path, workflow)
  pipelines[pipeline].args.update(args)
  for j in range(index, len(lines)):
    matches = match_pipelines(lines[j])
    if len(matches) == 2:
      leftPipeline, _, _, _ = parse_pipeline(matches[0])
      rightPipeline, _, _, _ = parse_pipeline(matches[1])
      dependency = parse_pipeline_dependency(lines[j])
      if not dependency:
        return
      if dependency != 'reversal':
        if leftPipeline == pipeline:
          pipelines[pipeline].fanOut.append(rightPipeline)
        elif rightPipeline == pipeline and dependency == 'required':
          pipelines[pipeline].entrypoint = False
          pipelines[pipeline].fanIn.append(leftPipeline)
        elif rightPipeline == pipeline and dependency == 'nullable':
          pipelines[pipeline].entrypoint = False
          pipelines[pipeline].fanIn.append(leftPipeline)
          pipelines[pipeline].fanInNullable.append(leftPipeline)
      else:
        if leftPipeline == pipeline:
          pipelines[pipeline].fanIn.append(rightPipeline)

def parse_pipeline(match: str):
  parts = match.split('|')
  pipeline = parts[0].strip()
  function = pipeline.split(':')[0].split('.')[-1]
  path = '.'.join(pipeline.split(':')[0].split('.')[:-1]) if '.' in pipeline.split(':')[0] else None
  args = parse_pipeline_args(parts)
  return pipeline, function, path, args

def parse_pipeline_dependency(line: str):
  if len(re.findall(r'\]->\[', line)) > 0:
    return 'required'
  elif len(re.findall(r'\]\?->\[', line)) > 0:
    return 'nullable'
  elif len(re.findall(r'\]-\.->\[', line)) > 0:
    return 'optional'
  elif len(re.findall(r'\]\^\[', line)) > 0:
    return 'reversal'
  else:
    return None

def parse_pipeline_args(parts: list[str]):
  args = {}
  if len(parts) > 1:
    for arg in parts[1:]:
      if '=' in arg:
        key, value = map(str.strip, arg.split('='))
        if value:
          args[key] = parse_value(value)
  return args

def list_pipeline_dependencies(pipelines: dict[str, Pipeline], pipeline: Pipeline, dependencies: list[str]):
  for dependency in pipeline.fanIn:
    dependencies.append(dependency)
    list_pipeline_dependencies(pipelines, pipelines[dependency], dependencies)
  return dependencies

def list_pipeline_execution_plan(pipelines: dict[str, Pipeline], pipeline: Pipeline, executionPlan: list[str]):
  executionPlan.extend(pipeline.dependencies)
  executionPlan.append(pipeline.name)
  for nextPipeline in pipeline.fanOut:
    if nextPipeline not in executionPlan:
      list_pipeline_execution_plan(pipelines, pipelines[nextPipeline], executionPlan)
  return executionPlan