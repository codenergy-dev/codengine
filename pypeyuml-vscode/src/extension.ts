// --- extension.ts (VSCode Extension Entry Point) ---

import * as vscode from 'vscode';
import { CompletionItemProvider } from './providers/completion-item-provider';
import { DocumentLinkProvider } from './providers/document-link-provider';
import { findPipelineFiles } from './functions/find-pipeline-files';
import { extractPipelineInfo } from './functions/extract-pipeline-info';

let pipelineData: Record<string, string[]> = {};

export function activate(context: vscode.ExtensionContext) {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) return;

  activatePipelines();

  context.subscriptions.push(CompletionItemProvider(pipelineData));
  context.subscriptions.push(DocumentLinkProvider());

  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(event => {
    if (event.affectsConfiguration('pypeyuml-vscode')) {
      reloadPipelines();
    }
  }));

  context.subscriptions.push(vscode.commands.registerCommand('pypeyuml-vscode.reloadPipelines', () => {
    reloadPipelines();
  }));
}

function activatePipelines() {
  const config = vscode.workspace.getConfiguration('pypeyuml-vscode');
  const pipelines = config.get<string[]>('pipelines') ?? [];

  Object.keys(pipelineData).forEach(key => delete pipelineData[key]);

  pipelines.forEach((pipeline) => {
    const pipelineFiles = findPipelineFiles(pipeline);
    pipelineFiles.forEach(fullPath => {
      const info = extractPipelineInfo(fullPath);
      if (info) {
        const [name, args] = info;
        pipelineData[name] = args;
      }
    });
  });
}

function reloadPipelines() {
  const config = vscode.workspace.getConfiguration('pypeyuml-vscode');
  const pipelines = config.get<string[]>('pipelines') ?? [];
  activatePipelines();
  if (pipelines.length) {
    vscode.window.showInformationMessage(`Reloaded pipelines from folders: ${pipelines.join(', ')}.`);
  } else {
    vscode.window.showWarningMessage(`Configure pipeline folders in pypeyuml-vscode.pipelines.`);
  }
}

export function deactivate() {}
