// Phosphor regular vectors become tintable UIKit toolbar images at 1x, 2x and 3x.
// Run with NODE_PATH pointing to a sharp installation; sharp is a build tool only.
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');
async function main() {
  const output = path.join(root, 'assets/icons/toolbar');
  await fs.mkdir(output, { recursive: true });
  for (const [name, definition] of [['profile', 'UserCircle'], ['settings', 'GearSix'], ['close', 'X']]) {
    const source = await fs.readFile(path.join(root, `node_modules/phosphor-react-native/src/defs/${definition}.tsx`), 'utf8');
    const regular = source.split("'regular'")[1].split("'thin'")[0];
    const paths = [...regular.matchAll(/<Path d="([^"]+)"/g)].map(match => `<path d="${match[1]}"/>`).join('');
    if (!paths) throw new Error(`No regular paths in ${definition}`);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="24" height="24" fill="#000">${paths}</svg>`;
    await fs.writeFile(path.join(output, `${name}.svg`), svg);
    for (const scale of [1, 2, 3]) await sharp(Buffer.from(svg)).resize(24 * scale, 24 * scale).png().toFile(path.join(output, `${name}${scale === 1 ? '' : `@${scale}x`}.png`));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
