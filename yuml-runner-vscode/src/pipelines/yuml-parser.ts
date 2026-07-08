import * as os from "os"
import * as path from "path"
import * as vscode from "vscode"
import { Path } from "./path"

export interface YumlParserFile {
  name: string
  path: string
  url: string
}

export function download(args: Path) {
  const platform = os.platform()
  const arch = os.arch()
  let assetName: string

  switch (platform) {
    case "win32":
      assetName = "yuml-parser-windows.exe"
      break
    case "darwin":
      if (arch === "arm64") {
        assetName = "yuml-parser-macos" // Apple Silicon
      } else if (arch === "x64") {
        assetName = "yuml-parser-macos-intel" // Intel
      } else {
        vscode.window.showErrorMessage(`Unsupported macOS architecture: ${arch}.`)
        return
      }
      break
    case "linux":
      assetName = "yuml-parser-linux"
      break
    default:
      vscode.window.showErrorMessage(`Platform '${platform}' is not supported.`)
      return
  }

  return {
    name: assetName,
    path: path.join(args.path, assetName),
    url: `https://github.com/codenergy-dev/yuml-parser/releases/latest/download/${assetName}`,
  } as YumlParserFile
}

export interface YumlParserArgs {
  cwd: string
  yuml: string
}

export function run(args: YumlParserArgs & YumlParserFile) {
  const { spawn } = require("child_process")
  const proc = spawn(args.path, [args.yuml], { cwd: args.cwd })

  proc.stdout.on("data", (data: Buffer) => {
    vscode.window.showInformationMessage(data.toString())
  })

  proc.stderr.on("data", (data: Buffer) => {
    vscode.window.showErrorMessage(data.toString())
  })
}