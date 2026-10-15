import { copyFile, lstat, mkdir, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const target = path.resolve(root, process.argv[2] || '.pages-artifact');
const expectedTarget = path.resolve(root, '.pages-artifact');

if (target !== expectedTarget) {
  throw new Error(`Refusing unexpected artifact target: ${target}`);
}

const rootFiles = [
  '.nojekyll',
  '404.html',
  '404.js',
  'CNAME',
  'favicon.svg',
  'index.html',
  'vedox-logo-showcase.png',
  'vedox-mark-dark.png',
  'vedox-mark-light.png',
  'vedox-platform-preview.png',
  'vedox-wordmark-dark.png',
  'vedox-wordmark-light.png',
];

const allowedAssetExtensions = new Set([
  '.css', '.gif', '.ico', '.jpeg', '.jpg', '.js', '.png', '.svg', '.webp',
  '.woff', '.woff2',
]);

async function copyCheckedFile(source, destination, allowedExtensions = null) {
  const stat = await lstat(source);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`Artifact input must be a regular file: ${source}`);
  }
  const extension = path.extname(source).toLowerCase();
  if (extension === '.map' || (allowedExtensions && !allowedExtensions.has(extension))) {
    throw new Error(`Artifact input type is not allowed: ${source}`);
  }
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(source, destination);
  return stat.size;
}

async function copyAssets(sourceDir, destinationDir) {
  let count = 0;
  let bytes = 0;
  for (const entry of await readdir(sourceDir, { withFileTypes: true })) {
    const source = path.join(sourceDir, entry.name);
    const destination = path.join(destinationDir, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Symlink is not allowed: ${source}`);
    if (entry.isDirectory()) {
      const nested = await copyAssets(source, destination);
      count += nested.count;
      bytes += nested.bytes;
    } else if (entry.isFile()) {
      bytes += await copyCheckedFile(source, destination, allowedAssetExtensions);
      count += 1;
    } else {
      throw new Error(`Unsupported artifact entry: ${source}`);
    }
  }
  return { count, bytes };
}

await mkdir(target, { recursive: false });
let count = 0;
let bytes = 0;

for (const name of rootFiles) {
  bytes += await copyCheckedFile(path.join(root, name), path.join(target, name));
  count += 1;
}

const assets = await copyAssets(path.join(root, 'assets'), path.join(target, 'assets'));
count += assets.count;
bytes += assets.bytes;

for (const page of ['index.html', '404.html']) {
  const html = await readFile(path.join(target, page), 'utf8');
  const references = [...html.matchAll(/(?:src|href)=["'](\/assets\/[^"']+)["']/g)]
    .map((match) => match[1]);
  for (const reference of references) {
    const localPath = path.join(target, reference.replace(/^\//, ''));
    const stat = await lstat(localPath).catch(() => null);
    if (!stat?.isFile()) throw new Error(`${page} references missing asset ${reference}`);
  }
}

const forbiddenTopLevel = new Set([
  '.env', '.git', '.github', 'docs', 'frontend', 'node_modules', 'sql', 'tools',
]);
for (const entry of await readdir(target, { withFileTypes: true })) {
  if (forbiddenTopLevel.has(entry.name)) {
    throw new Error(`Forbidden top-level artifact entry: ${entry.name}`);
  }
}

console.log(`Pages artifact verified: ${count} files, ${bytes} bytes`);
