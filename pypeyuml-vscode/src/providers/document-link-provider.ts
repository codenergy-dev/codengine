import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export const DocumentLinkProvider = () =>
  vscode.languages.registerDocumentLinkProvider({ scheme: 'file', language: 'yuml' }, {
    async provideDocumentLinks(document) {
      const links: vscode.DocumentLink[] = [];
      const regex = /\[([a-zA-Z0-9_:]+)(?:\|[^\]]*)?\]/g;
      const text = document.getText();
      let match: RegExpExecArray | null;

      const config = vscode.workspace.getConfiguration('pypeyuml-vscode');
      const pipelineDirs = config.get<string[]>('pipelines') ?? [];

      while ((match = regex.exec(text))) {
        const pipelineName = match[1].split(':')[0];
        const startPos = document.positionAt(match.index + 1);
        const endPos = document.positionAt(match.index + 1 + pipelineName.length);
        const fileName = `${pipelineName}.py`;

        const pipelinePath = findPipelineFileInConfiguredPaths(fileName, pipelineDirs);
        if (pipelinePath) {
          const uri = vscode.Uri.file(pipelinePath);
          links.push(new vscode.DocumentLink(new vscode.Range(startPos, endPos), uri));
        }
      }

      return links;
    }
  });

/**
 * Busca um arquivo por nome dentro dos diretórios configurados.
 */
function findPipelineFileInConfiguredPaths(fileName: string, dirs: string[]): string | undefined {
  for (const dir of dirs) {
    const fullPath = path.resolve(dir, fileName);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }
  return undefined;
}
