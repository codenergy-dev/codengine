from pypeyuml.load_pipeline_info import load_pipeline_info
from pypeyuml.pipeline import Pipeline, PipelineState
from pypeyuml.print_key_values import print_key_values

def run_pipelines(dir: str, pipelines: list[Pipeline]):
  for pipeline in pipelines:
    if not len(pipeline.fanIn) and pipeline.state is PipelineState.IDLE:
      run_next_pipeline(dir, pipelines, pipeline)

def run_next_pipeline(dir: str, pipelines: list[Pipeline], pipeline: Pipeline):
  if not pipeline:
    return
  elif set(pipeline.fanInCheck) == set(pipeline.fanIn):
    if pipeline.state in [PipelineState.IDLE, PipelineState.WAIT]:
      pipeline.state = PipelineState.EXEC
      pipeline.output = load_pipeline_info(dir, pipeline.function)({ **pipeline.input, **pipeline.args })

      pipeline.state = PipelineState.DONE
      pipeline.fanInCheck.clear()

      if pipeline.output is None:
        return
      elif isinstance(pipeline.output, dict):
        print(f"\n✅ {pipeline.name}")
        pipeline.output = [pipeline.output]
      elif isinstance(pipeline.output, list):
        print(f"\n🔁 {pipeline.name} ({len(pipeline.output)})")
      else:
        raise ValueError(f"Unexpected output ({pipeline.output}) for pipeline {pipeline.name}.")
      
      [print_key_values(output) for output in pipeline.output if isinstance(output, dict)]
  
    fanOutList = [pipeline.fanOutPending] if pipeline.fanOutPending else pipeline.fanOut
    pipeline.fanOutPending = None
    
    for output in pipeline.output:
      for fanOut in fanOutList:
        nextPipeline = next((
          nextPipeline for nextPipeline in pipelines if
          nextPipeline.name == fanOut
        ), None)
        nextPipeline.state = PipelineState.IDLE
        nextPipeline.fanInCheck.append(pipeline.name)
        nextPipeline.input.update(output)
      
      for fanOut in fanOutList:
        nextPipeline = next((
          nextPipeline for nextPipeline in pipelines if
          nextPipeline.name == fanOut and
          nextPipeline.state in [PipelineState.IDLE, PipelineState.WAIT]
        ), None)
        if nextPipeline:
          print(f"\nℹ️  [{pipeline.name}]->[{nextPipeline.name}]")
        run_next_pipeline(dir, pipelines, nextPipeline)
  else:
    pipeline.state = PipelineState.WAIT
    
    nextPipeline = next((
      nextPipeline for nextPipeline in pipelines if
      nextPipeline.name in pipeline.fanIn and
      nextPipeline.name not in pipeline.fanInCheck
    ), None)
    if nextPipeline:
      print(f"\nℹ️  [{nextPipeline.name}]<-[{pipeline.name}]")
      nextPipeline.fanOutPending = pipeline.name
    run_next_pipeline(dir, pipelines, nextPipeline)