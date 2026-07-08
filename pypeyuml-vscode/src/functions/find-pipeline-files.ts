import * as fs from 'fs';
import * as path from 'path';

export function findPipelineFiles(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);

  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(findPipelineFiles(fullPath));
    } else if (file.endsWith('_pipeline.py')) {
      results.push(fullPath);
    }
  });

  return results;
}