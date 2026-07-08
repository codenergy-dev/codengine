import * as fs from "fs"
import * as path from "path"
import * as vscode from "vscode"

export const YumlImportCompletionProvider = vscode.languages.registerCompletionItemProvider(
  { language: "yuml", scheme: "file" }, {
  provideCompletionItems(document, position) {
    const line = document.lineAt(position).text
    const regex = /\/\/\s*\{import:([^}]*)\}?$/
    const match = line.match(regex)
    if (!match) return

    const typedPath = match[1].trim()
    const workspaceFolders = vscode.workspace.workspaceFolders
    if (!workspaceFolders) return

    const root = workspaceFolders[0].uri.fsPath
    const basePath = path.resolve(root, typedPath || ".")

    const dir = fs.existsSync(basePath) && fs.statSync(basePath).isDirectory()
      ? basePath
      : path.dirname(basePath)

    if (!fs.existsSync(dir)) return

    const items: vscode.CompletionItem[] = []
    for (const entry of fs.readdirSync(dir)) {
      // if (!entry.startsWith(path.basename(typedPath))) continue

      const fullPath = path.join(dir, entry)
      const isDir = fs.statSync(fullPath).isDirectory()

      const item = new vscode.CompletionItem(
        isDir ? entry + "/" : entry,
        isDir
          ? vscode.CompletionItemKind.Folder
          : vscode.CompletionItemKind.File
      )

      item.insertText = isDir ? entry + "/" : entry

      items.push(item)
    }

    return items
  }
}, ":", "/")