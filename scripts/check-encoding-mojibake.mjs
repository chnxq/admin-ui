import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

const root = join(process.cwd(), 'apps', 'web-antd', 'src');
const exts = new Set(['.js', '.json', '.jsx', '.md', '.ts', '.tsx', '.vue']);
const mojibakePatterns = ['绉熸', '骞冲', '褰撳', '鍙', '?????'];

const suspicious = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist') continue;
      walk(full);
      continue;
    }
    if (!exts.has(extname(full))) continue;
    const text = readFileSync(full, 'utf8');
    const hit = mojibakePatterns.find((pattern) => text.includes(pattern));
    if (hit) suspicious.push({ file: full, pattern: hit });
  }
}

walk(root);

if (suspicious.length > 0) {
  console.error('Detected suspicious mojibake patterns:');
  for (const item of suspicious) {
    console.error(`${item.file} :: ${item.pattern}`);
  }
  process.exit(1);
}

console.log('No suspicious mojibake patterns detected.');
