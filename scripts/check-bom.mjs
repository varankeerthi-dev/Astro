import fs from 'fs';
import path from 'path';

const root = process.cwd();
const exts = ['.astro', '.ts', '.tsx', '.js', '.jsx', '.mjs'];
const skip = ['node_modules', '.git', 'dist', '.turbo', '.vercel', '.kilo'];
const found = [];

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.isDirectory()) {
      if (!skip.includes(ent.name)) walk(path.join(dir, ent.name));
    } else if (exts.includes(path.extname(ent.name))) {
      const b = fs.readFileSync(path.join(dir, ent.name));
      if (b.length >= 3 && b[0] === 0xEF && b[1] === 0xBB && b[2] === 0xBF) {
        found.push(path.join(dir, ent.name));
      }
    }
  }
}

walk(root);

if (found.length) {
  console.error('UTF-8 BOM found in files:\n' + found.join('\n'));
  process.exit(1);
} else {
  console.log('No UTF-8 BOM found in source files.');
}
