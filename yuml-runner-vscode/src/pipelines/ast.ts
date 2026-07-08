import path from "path"
import { Path } from "./path"

export function load(args: Path) {
  if (!args.path) return
  return args
}

export function loadDart(args: Path) {
  if (path.extname(args.path) != '.dart') return
  return args
}

export function loadTypeScript(args: Path) {
  if (path.extname(args.path) != '.ts') return
  return args
}
