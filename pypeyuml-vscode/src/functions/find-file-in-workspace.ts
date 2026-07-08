import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export function findFileInWorkspace(fileName: string): string | undefined {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders) return;

  for (const folder of folders) {
    const folderPath = folder.uri.fsPath;

    const found = findRecursively(folderPath, fileName);
    if (found) return found;
  }

  return undefined;
}

function findRecursively(dir: string, fileName: string): string | undefined {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const result = findRecursively(fullPath, fileName);
      if (result) return result;
    } else if (entry.name === fileName) {
      return fullPath;
    }
  }

  return undefined;
}