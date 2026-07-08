import * as fs from "fs"
import * as path from "path"
import * as vscode from 'vscode'
import { getYumlFunctionArgs, getYumlFunctionArgsFromPipelines, YumlFunctionArgs } from "../yuml-function-args"

export const YumlFunctionCompletionProvider = vscode.languages.registerCompletionItemProvider(
  { scheme: 'file', language: 'yuml' }, {
  async provideCompletionItems(document, position) {
    const workspaceFolders = vscode.workspace.workspaceFolders
    if (!workspaceFolders) return
    
    var yumlFunctionArgs: YumlFunctionArgs = {}
    const importFileMatch = document.getText().match(/\/\/\s*\{import:([^}]*)\}/)
    if (importFileMatch) {
      const root = workspaceFolders[0].uri.fsPath
      const importFilePath = path.join(root, importFileMatch[1].trim())
      if (!fs.existsSync(importFilePath)) return
      if (fs.statSync(importFilePath).isDirectory()) return
      if (!importFilePath.endsWith('.js') && !importFilePath.endsWith('.ts')) return
      yumlFunctionArgs = {
        ...await getYumlFunctionArgs(importFilePath),
        ...await getYumlFunctionArgsFromPipelines([importFilePath]),
      }
    } else {
      yumlFunctionArgs = await getYumlFunctionArgsFromPipelines()
    }
    
    const line = document.lineAt(position)
    const text = line.text.substring(0, position.character)
    const match = text.match(/\[([a-zA-Z0-9_:\.\-]+)\|([^\]]*)$/)
    if (match) {
      const functionName = match[1].split(':')[0]
      const args = yumlFunctionArgs[functionName]
      if (!args) return

      return args.map(arg => {
        const item = new vscode.CompletionItem(arg.name, vscode.CompletionItemKind.Field)
        item.insertText = `${arg.name}=`
        item.label = arg.name
        item.detail = arg.type
        return item
      })
    }

    const functionMatch = text.match(/\[([a-zA-Z0-9_\.\-]*)$/)
    if (functionMatch) {
      const typed = functionMatch[1]
      return Object.keys(yumlFunctionArgs)
        .filter(name => name.includes(typed))
        .map(name => {
          const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Function)
          item.insertText = name
          item.label = name
          return item
        })
    }
  }
}, '|', '[', '.', ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_'.split(''))