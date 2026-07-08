from pypeyuml.get_venv_from_file import get_venv_from_file
from pypeyuml.load_pipeline_info import load_pipeline_info
from pypeyuml.run_pipeline_local import run_pipeline_local
from pypeyuml.run_pipeline_venv import run_pipeline_venv

def execute_pipelines(pipelines_dir, pipeline_order, graph, nodes):
  def run_chain(input_args: dict, executed: set) -> dict:
    results = {}

    i = 0
    while i < len(pipeline_order):
      pipeline = pipeline_order[i]

      if pipeline in executed:
        i += 1
        continue

      temp_func, filename = load_pipeline_info(pipelines_dir, pipeline, venv_aware=True)
      venv_path = None if temp_func else get_venv_from_file(filename)

      args = nodes[pipeline].copy()
      for pred in [p for p in nodes if pipeline in graph[p]]:
        args.update(results.get(pred, {}))

      args.update(input_args)

      print(f"\n▶️  Running {pipeline}")

      if venv_path:
        print(f"▶️  venv: {venv_path}")
      if args:
        print(f"▶️  args: {args}")

      if venv_path:
        result = run_pipeline_venv(venv_path, filename, args)
      else:
        func, _ = load_pipeline_info(pipelines_dir, pipeline)
        result = run_pipeline_local(func, args)

      if result:
        print(f"✅ {result}")

      if isinstance(result, list) and all(isinstance(item, dict) for item in result):
        print(f"🔁 {pipeline} ({len(result)})")

        new_executed = executed | set(pipeline_order[:i + 1])
        remaining_order = pipeline_order[i + 1:]

        subresults = []
        for item in result:
          subresult = run_chain(item, executed=new_executed.copy())
          subresults.append(subresult)

        return subresults  # retorna aqui apenas após completar os forks
      else:
        results[pipeline] = result
        if isinstance(result, dict):
          input_args.update(result)
        executed.add(pipeline)
        i += 1

    return results

  return run_chain({}, executed=set())