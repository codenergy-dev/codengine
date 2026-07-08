import * as fs from "fs"
import { Path } from "./path"

export function existsSync(args: Path) {
  return fs.existsSync(args.path)
}

export function notExistsSync(args: Path) {
  return !fs.existsSync(args.path)
}

export function mkdirSync(args: Path) {
  if (notExistsSync(args)) {
    fs.mkdirSync(args.path)
  }
  return args
}

export interface FileData {
  path: string
  encoding: BufferEncoding
  data: string
}

export function readFileSync(args: Path & { encoding: BufferEncoding }) {
  const file: FileData = {
    path: args.path,
    encoding: args.encoding,
    data: fs.readFileSync(args.path, args.encoding),
  }
  return file
}

export function writeFileSync(args: Path & { buffer: Buffer, mode?: string }) {
  fs.writeFileSync(args.path, args.buffer, { mode: args.mode })
  return { path: args.path } as Path
}

export function copyFileSync(args: { src: string, dest: string }) {
  fs.copyFileSync(args.src, args.dest)
  return { path: args.dest }
}