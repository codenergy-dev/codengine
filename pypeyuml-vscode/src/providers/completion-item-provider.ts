import * as vscode from 'vscode';

export const CompletionItemProvider = (pipelineData: Record<string, string[]> = {}) => vscode.languages.registerCompletionItemProvider({ scheme: 'file', language: 'yuml' }, {
  provideCompletionItems(document, position) {
    const line = document.lineAt(position);
    const text = line.text.substring(0, position.character);

    const match = text.match(/\[([a-zA-Z0-9_:]+)\|([^\]]*)$/);
    if (match) {
      const pipelineName = match[1].split(':')[0];
      const args = pipelineData[pipelineName];
      if (!args) return;

      return args.map(arg => {
        const item = new vscode.CompletionItem(arg, vscode.CompletionItemKind.Field);
        item.insertText = `${arg.split(':')[0].trim()}=`;
        item.label = arg;
        item.detail = `${arg}`;
        return item;
      });
    }

    // Suggest pipeline names when typing [ or incomplete match
    const pipelineMatch = text.match(/\[([a-zA-Z0-9_]*)$/);
    if (pipelineMatch) {
      const typed = pipelineMatch[1];
      return Object.keys(pipelineData)
        .filter(name => name.includes(typed))
        .map(name => {
          const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Function);
          item.insertText = name;
          item.label = name;
          return item;
        });
    }
  }
}, '|', '[', ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_'.split(''));