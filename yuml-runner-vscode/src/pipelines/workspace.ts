import * as vscode from "vscode"
import { Path } from "./path"

export interface WorkspaceFolderList {
  workspaceFolders: vscode.WorkspaceFolder[]
}

export function isNotEmpty() {
  const workspaceFolders = vscode.workspace.workspaceFolders
  if (!workspaceFolders) return
  return { workspaceFolders } as WorkspaceFolderList
}

export function root(args: WorkspaceFolderList) {
  const root: Path = {
    path: args.workspaceFolders[0].uri.fsPath,
  }
  return root
}