import * as path from "path"

export interface Path {
  path: string
}

export function join(args: {
  path: string,
  path1: string,
  path2: string,
  path3: string,
  path4: string,
  path5: string,
}) {
  const paths = [args.path, args.path1, args.path2, args.path3, args.path4, args.path5]
    .filter(path => path)
  return { path: path.join(...paths) } as Path
}

export function format(args: Path & { ext?: string, dir?: string }) {
  const parsedPath = path.parse(args.path)
  const dir = args.dir ?? parsedPath.dir
  const ext = args.ext ?? parsedPath.ext
  const base = parsedPath.name + ext
  return { path: path.join(dir, base) } as Path
}