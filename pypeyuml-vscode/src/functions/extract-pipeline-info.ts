import * as fs from 'fs';

export function extractPipelineInfo(filePath: string): [string, string[]] | null {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const match = fileContent.match(/def\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)/s);
  if (!match) return null;

  const name = match[1];
  const argsBlock = match[2];
  const args = argsBlock
    .split(/,\s*/)
    .map(arg => arg.trim().split('=')[0].trim())
    .filter(arg => arg && arg !== '**kwargs');

  return [name, args];
}