import * as fs from "fs"
import * as path from "path"
import * as vscode from 'vscode'
import { getYumlJson } from "./yuml-json"
import { workflows } from "./workflows"

export interface YumlFunctionArgs {
  [functionName: string]: {
    name: string,
    type: string,
  }[]
}

export async function getYumlFunctionArgs(filePath: string) {
  const yumlFunctionArgs = await workflows.run('ast', 'load', { args: { path: filePath } })
  return yumlFunctionArgs?.[0] ?? {}
}

export async function getYumlFunctionArgsFromPipelines(excludeFilePaths: string[] = []): Promise<YumlFunctionArgs> {
  const json = getYumlJson()
  if (!json) return {}

  const root = vscode.workspace.workspaceFolders?.[0].uri.fsPath
  if (!root) return {}

  const pipelinesPath = path.join(root, json.pipelines)
  if (!fs.existsSync(pipelinesPath)) return {}

  const files = getAllFilesRecursive(pipelinesPath, [".ts", ".js"], excludeFilePaths)
  const result: YumlFunctionArgs = {}

  for (const file of files) {
    const fileName = path
      .relative(pipelinesPath, file)
      .replace(/\\/g, "/")
      .replace(/\.(ts|js)$/, "")

    const yumlFunctionArgs = await getYumlFunctionArgs(file)
    if (yumlFunctionArgs) {
      for (const [functionName, args] of Object.entries(yumlFunctionArgs)) {
        result[`${fileName}.${functionName}`] = args
      }
    }
  }

  return result
}

function getAllFilesRecursive(dir: string, exts: string[], excludeFilePaths: string[] = [], result: string[] = []): string[] {
  if (!fs.existsSync(dir)) return result

  for (const entry of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, entry)
    const stat = fs.statSync(fullPath)

    if (stat.isDirectory()) {
      getAllFilesRecursive(fullPath, exts, excludeFilePaths, result)
    } else if (exts.some(ext => fullPath.endsWith(ext)) &&
              !excludeFilePaths.includes(fullPath)) {
      result.push(fullPath)
    }
  }

  return result
}
