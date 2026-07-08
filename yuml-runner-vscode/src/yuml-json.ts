import * as vscode from "vscode"
import * as fs from "fs"
import * as path from "path"

export type YumlJson = {
  pipelines: string
  workflows: string
}

export function getYumlJson(): YumlJson | undefined {
  const workspaceFolders = vscode.workspace.workspaceFolders
  if (!workspaceFolders) return

  const root = workspaceFolders[0].uri.fsPath
  const yumlJson = path.join(root, "yuml.json")
  if (!fs.existsSync(yumlJson)) return

  try {
    const raw = fs.readFileSync(yumlJson, "utf-8")
    const json = JSON.parse(raw) as YumlJson
    return json
  } catch (err: any) {
    vscode.window.showErrorMessage(`Unable to read yuml.json: ${err.message}`)
    return
  }
}
