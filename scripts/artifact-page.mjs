// Turns the Vite build in dist-artifact/ into a page for a claude.ai Artifact.
// The Artifact host supplies <!doctype>, <head> and <body>, so the page is just
// its title, styles and the app's root element; JS/CSS ship as separate files.
import fs from 'node:fs';
import path from 'node:path';

const dir = 'dist-artifact';
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script[^>]*src="([^"]+)"[^>]*><\/script>/g)].map((m) => m[1].replace(/^\.\//, ''));
const styles = [...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g)].map((m) => m[1].replace(/^\.\//, ''));

const page = `<title>Network Tracker</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
${styles.map((s) => `<link rel="stylesheet" href="${s}">`).join('\n')}
<div id="root"></div>
${scripts.map((s) => `<script type="module" src="${s}"></script>`).join('\n')}
`;
fs.writeFileSync(path.join(dir, 'page.html'), page);

const files = fs.readdirSync(path.join(dir, 'assets')).map((f) => `assets/${f}`);
fs.writeFileSync(path.join(dir, 'files.json'), JSON.stringify(Object.fromEntries(files.map((f) => [f, `${dir}/${f}`])), null, 2));
console.log('page.html written; files:', files);
