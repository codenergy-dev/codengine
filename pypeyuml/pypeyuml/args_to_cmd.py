from typing import Any, Dict

def args_to_cmd(args: Dict[str, Any]) -> list:
  cmd = []
  for k, v in args.items():
    cmd.append(f"--{k}")
    cmd.append(str(v))
  return cmd