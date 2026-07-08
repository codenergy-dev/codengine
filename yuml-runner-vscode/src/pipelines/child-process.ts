import * as cp from "child_process"

export interface SpawnArgs {
  command: string
  arg1?: string
  arg2?: string
  arg3?: string
  arg4?: string
  arg5?: string
}

export function spawnSync(args: SpawnArgs) {
  const process = cp.spawnSync(args.command, [
    args.arg1,
    args.arg2,
    args.arg3,
    args.arg4,
    args.arg5,
  ].filter(arg => !!arg) as string[], {
    stdio: "inherit",
  })
  return process.status === 0
}