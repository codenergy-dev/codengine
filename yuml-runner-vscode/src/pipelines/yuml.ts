import * as vscode from "vscode"
import { workflows } from "../workflows"
import { FileData } from "./fs"
import { Path } from "./path"

export type YumlJson = {
  pipelines: string
  workflows: string
}

export function json(args: FileData) {
  try {
    const json = JSON.parse(args.data) as YumlJson
    return json
  } catch (err: any) {
    vscode.window.showErrorMessage(`Unable to read yuml.json: ${err.message}`)
    return
  }
}

export function watch(args: Path) {
  const watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(args.path, "**/*.yuml")
  )
  watcher.onDidChange(uri => workflows.run('yuml-parser', 'run', { args: { yuml: uri.fsPath } }))
  watcher.onDidCreate(uri => workflows.run('yuml-parser', 'run', { args: { yuml: uri.fsPath } }))
}

export function dir(args: Path) {
  return args
}