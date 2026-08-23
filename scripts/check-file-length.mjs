import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

const root = process.cwd();
const ignoredDirectories = new Set(['.git', 'coverage', 'dist', 'node_modules']);
const checkedExtensions = new Set([
  '.js',
  '.json',
  '.md',
  '.mjs',
  '.mmd',
  '.sql',
  '.ts',
  '.yaml',
  '.yml',
]);
const ignoredFiles = new Set(['package-lock.json']);
const maximumLines = 300;
const violations = [];

async function inspectDirectory(directory) {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;

    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      await inspectDirectory(absolutePath);
      continue;
    }
    if (ignoredFiles.has(entry.name) || !checkedExtensions.has(extname(entry.name))) continue;

    const content = await readFile(absolutePath, 'utf8');
    const lines = content === '' ? 0 : content.split(/\r?\n/).length;
    if (lines > maximumLines) violations.push(`${relative(root, absolutePath)}: ${lines} lignes`);
  }
}

await inspectDirectory(root);

if (violations.length > 0) {
  console.error(`Fichiers dépassant ${maximumLines} lignes:\n${violations.join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`Tous les fichiers vérifiés respectent la limite de ${maximumLines} lignes.`);
}
