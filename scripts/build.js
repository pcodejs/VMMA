const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'public');
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output);
for (const name of fs.readdirSync(root)) {
  if (name === 'index.html' || /\.(?:css|js)$/.test(name)) fs.copyFileSync(path.join(root, name), path.join(output, name));
}
for (const directory of ['assets', 'licenses']) fs.cpSync(path.join(root, directory), path.join(output, directory), { recursive: true });
console.log('Built static website in public/');
