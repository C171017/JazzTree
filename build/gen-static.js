#!/usr/bin/env node
/**
 * Generates static.html — the complete guide as one plain, dependency-free page.
 * index.html embeds it so the content is readable with JavaScript disabled.
 *
 * Run:  node build/gen-static.js
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));

const { genres, lineage, families, meta } = read('data/genres.json');
const albums = read('data/albums.json');
const paths = read('data/paths.json');
const PRESENT = meta?.present ?? 2027;

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const span = (g) => (g.era.end == null ? `${g.era.start}–present` : `${g.era.start}–${g.era.end}`);
const q = (a) => encodeURIComponent(`${a.artist} ${a.title}`);

function albumHtml(a) {
  const facts = [
    a.recorded === a.released ? `recorded/released ${a.recorded}` : `recorded ${a.recorded}, released ${a.released ?? '—'}`,
    esc(a.label) + (a.catalogNo ? ` ${esc(a.catalogNo)}` : ''),
    `difficulty ${a.difficulty}/5`,
    a.startTrack ? `start with “${esc(a.startTrack)}”` : null,
    a.confidence !== 'high' ? `${a.confidence} confidence` : null,
  ].filter(Boolean).join(' · ');
  return `<article class="a" id="album-${esc(a.id)}">
  <h4>${esc(a.artist)} — <em>${esc(a.title)}</em> <span class="tier">${esc(a.tier)}</span></h4>
  <p class="facts">${facts}</p>
  ${a.personnel?.length ? `<p class="facts">${a.personnel.map(esc).join(' · ')}</p>` : ''}
  <p>${esc(a.whyThisOne)}</p>
  <p><b>Listen for:</b> ${esc(a.listenFor)}</p>
  ${a.note ? `<p class="note">Note: ${esc(a.note)}</p>` : ''}
  <p class="links">
    <a href="https://open.spotify.com/search/${q(a)}" target="_blank" rel="noopener noreferrer">Spotify</a> ·
    <a href="https://music.apple.com/us/search?term=${q(a)}" target="_blank" rel="noopener noreferrer">Apple Music</a> ·
    <a href="https://music.163.com/#/search/m/?s=${q(a)}" target="_blank" rel="noopener noreferrer">NetEase</a>
  </p>
</article>`;
}

const genreHtml = (g) => {
  const own = albums.filter((a) => a.genreIds[0] === g.id);
  const parents = lineage.filter((e) => e.to === g.id);
  const children = lineage.filter((e) => e.from === g.id);
  const name = (id) => genres.find((x) => x.id === id)?.name ?? id;
  return `<section class="g" id="${esc(g.id)}">
  <h2>${esc(g.name)} <span class="years">${span(g)}</span></h2>
  <p class="one">${esc(g.oneLine)}</p>
  <p class="facts">${esc(g.origin.city)}, ${esc(g.origin.country)} · ${esc(families.find((f) => f.id === g.family)?.name ?? g.family)}${g.aka?.length ? ` · also called ${g.aka.map(esc).join(', ')}` : ''}</p>
  <p>${esc(g.summary)}</p>
  <h3>What to listen for</h3>
  <ul>${g.earMarkers.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>
  <h3>How it works</h3>
  <dl>${Object.entries(g.musicalTraits).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
  <h3>Key figures</h3>
  <ul>${g.keyFigures.map((f) => `<li><b>${esc(f.name)}</b> (${esc(f.instrument)}) — ${esc(f.why)}</li>`).join('')}</ul>
  <p class="facts">Labels: ${g.keyLabels.map(esc).join(' · ')}</p>
  <h3>Contested</h3>
  <p class="contested">${esc(g.contested)}</p>
  ${parents.length ? `<h3>Came out of</h3><ul>${parents.map((e) => `<li><a href="#${esc(e.from)}">${esc(name(e.from))}</a> — <i>${esc(e.type.replace(/-/g, ' '))}</i>, ${e.year}, via ${e.aspects.join(', ')}. ${esc(e.explanation)}</li>`).join('')}</ul>` : ''}
  ${children.length ? `<h3>Fed into</h3><ul>${children.map((e) => `<li><a href="#${esc(e.to)}">${esc(name(e.to))}</a> — <i>${esc(e.type.replace(/-/g, ' '))}</i>, ${e.year}</li>`).join('')}</ul>` : ''}
  <h3>What to hear</h3>
  ${['gateway', 'core', 'deep'].map((t) => {
    const list = own.filter((a) => a.tier === t);
    return list.length ? `<h4 class="tierhead">${t}</h4>${list.map(albumHtml).join('')}` : '';
  }).join('')}
</section>`;
};

const pathHtml = (p) => `<section class="g" id="path-${esc(p.id)}">
  <h2>${esc(p.name)} <span class="years">${p.steps.length} records</span></h2>
  <p class="one">${esc(p.subtitle)}</p>
  <p>${esc(p.blurb)}</p>
  <ol class="steps">${p.steps.map((s) => {
    const a = albums.find((x) => x.id === s.albumId);
    return `<li><p class="bridge">${esc(s.bridge)}</p>${a ? albumHtml(a) : ''}</li>`;
  }).join('')}</ol>
</section>`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>JazzTree — full text</title>
<meta name="description" content="The complete JazzTree guide as plain text: ${genres.length} genres, ${lineage.length} influence edges, ${albums.length} records.">
<style>
  :root { color-scheme: dark light;
    --bg:#13110E; --ink:#EBE4D7; --ink2:#C4BBAC; --ink3:#918879; --ink4:#665F54;
    --accent:#D2922F; --rule:#332C24; --raise:#1B1815; }
  @media (prefers-color-scheme: light) { :root {
    --bg:#F5F1E8; --ink:#1A1713; --ink2:#443C31; --ink3:#6D6355; --ink4:#978D7C;
    --accent:#9C6512; --rule:#D3C9B4; --raise:#FFFDF7; } }
  * { box-sizing: border-box; }
  body { margin:0; padding:2rem 1.25rem 6rem; background:var(--bg); color:var(--ink);
    font:16px/1.6 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  .wrap { max-width: 46rem; margin: 0 auto; }
  h1,h2,h3,h4 { font-family:"Iowan Old Style", Palatino, Georgia, serif; line-height:1.2; margin:0; }
  h1 { font-size:2.2rem; margin-bottom:.4rem; }
  h1 em { font-style:normal; color:var(--accent); }
  h2 { font-size:1.5rem; margin:0 0 .3rem; padding-top:1rem; }
  h3 { font-size:.78rem; letter-spacing:.12em; text-transform:uppercase; color:var(--ink4);
       font-family:inherit; margin:1.5rem 0 .5rem; border-bottom:1px solid var(--rule); padding-bottom:.3rem; }
  h4 { font-size:1rem; margin-bottom:.25rem; }
  h4.tierhead { font-family:inherit; font-size:.72rem; letter-spacing:.14em; text-transform:uppercase;
       color:var(--accent); margin:1.2rem 0 .5rem; }
  p { margin:0 0 .7em; }
  a { color:var(--accent); }
  ul, ol { margin:0 0 1em; padding-left:1.2rem; }
  li { margin-bottom:.45em; }
  dl { margin:0 0 1em; }
  dt { color:var(--ink4); font-size:.74rem; letter-spacing:.08em; text-transform:uppercase; margin-top:.6em; }
  dd { margin:0; color:var(--ink2); }
  .g { border-top:1px solid var(--rule); padding-top:1.5rem; margin-top:2.5rem; }
  .years { font-family:ui-monospace, monospace; font-size:.8rem; color:var(--ink4); font-weight:400; }
  .one { font-family:"Iowan Old Style", Palatino, Georgia, serif; font-style:italic;
         font-size:1.1rem; color:var(--accent); }
  .facts { font-size:.82rem; color:var(--ink4); }
  .note { font-size:.82rem; color:var(--ink4); font-style:italic; }
  .contested { border-left:2px solid #C0574A; padding-left:.8rem; color:var(--ink2); }
  .a { border:1px solid var(--rule); border-radius:3px; padding:.85rem .9rem; margin-bottom:.8rem; background:var(--raise); }
  .a p { font-size:.92rem; color:var(--ink2); }
  .a p:last-child { margin-bottom:0; }
  .tier { font-size:.68rem; letter-spacing:.1em; text-transform:uppercase; color:var(--ink4); font-family:inherit; font-weight:400; }
  .links { font-size:.82rem; }
  .bridge { font-family:"Iowan Old Style", Palatino, Georgia, serif; font-style:italic; color:var(--ink2); }
  .toc { columns: 2; column-gap: 2rem; font-size:.92rem; }
  @media (max-width:640px) { .toc { columns:1; } }
  .lede { font-size:1.1rem; color:var(--ink2); }
</style>
</head>
<body>
<div class="wrap">
<h1>Jazz<em>Tree</em></h1>
<p class="lede">${genres.length} genres, ${lineage.length} influence edges, ${albums.length} records. This is the complete text of the guide, without the interactive graph.</p>
<p class="facts">Sources and known gaps: <a href="research/notes.md">research/notes.md</a> · Judgment calls: <a href="DECISIONS.md">DECISIONS.md</a> · Interactive version: <a href="index.html">index.html</a></p>

<h3>Genres</h3>
<ul class="toc">${genres
  .slice()
  .sort((a, b) => a.era.start - b.era.start)
  .map((g) => `<li><a href="#${esc(g.id)}">${esc(g.name)}</a> <span class="years">${span(g)}</span></li>`)
  .join('')}</ul>

<h3>Listening paths</h3>
<ul>${paths.map((p) => `<li><a href="#path-${esc(p.id)}">${esc(p.name)}</a> — ${esc(p.subtitle)}</li>`).join('')}</ul>

${genres.slice().sort((a, b) => a.era.start - b.era.start).map(genreHtml).join('\n')}

<h3 style="margin-top:3rem">Listening paths</h3>
${paths.map(pathHtml).join('\n')}
</div>
</body>
</html>
`;

writeFileSync(join(root, 'static.html'), html);
console.log(`wrote static.html — ${genres.length} genres, ${albums.length} albums, ${paths.length} paths, ${(html.length / 1024).toFixed(0)} KB`);
void PRESENT;
