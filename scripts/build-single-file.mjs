/**
 * Fasst den Vite-Build zu einer einzigen HTML-Datei zusammen.
 *
 * Gedacht zum Weitergeben oder Hosten an Orten, die keine Nebendateien
 * ausliefern können. Die Ausgabe enthält kein <html>/<head>/<body>, damit sie
 * sich auch in ein vorhandenes Seitengerüst einsetzen lässt.
 *
 * Aufruf: npm run build && node scripts/build-single-file.mjs [ziel.html]
 */

import { readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = join(root, 'dist');
const target = resolve(process.argv[2] ?? join(distDir, 'tagesplaner.html'));

const assets = await readdir(join(distDir, 'assets'));
const cssFile = assets.find((f) => f.endsWith('.css'));
const jsFile = assets.find((f) => f.endsWith('.js'));
if (!cssFile || !jsFile) {
  throw new Error('Kein Build gefunden – bitte zuerst "npm run build" ausführen.');
}

const css = await readFile(join(distDir, 'assets', cssFile), 'utf8');
const js = await readFile(join(distDir, 'assets', jsFile), 'utf8');

// </script> im Bundle würde den umschließenden Tag vorzeitig beenden.
const safeJs = js.replaceAll('</script', '<\\/script');

const html = `<title>Tagesplaner</title>
<style>
${css}
</style>
<div id="root"></div>
<script type="module">
${safeJs}
</script>
`;

await writeFile(target, html, 'utf8');
console.log(`${target} · ${(Buffer.byteLength(html) / 1024).toFixed(0)} kB`);
