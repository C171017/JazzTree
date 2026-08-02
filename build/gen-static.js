#!/usr/bin/env node
/**
 * Generates the complete guide as plain, dependency-free English and Simplified
 * Chinese pages. index.html embeds the English page and links to the Chinese page
 * when JavaScript is disabled.
 *
 * Run:  node build/gen-static.js
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { localizeData } from '../js/localize-data.js';
import {
  aspectLabel,
  edgeTypeLabel,
  familyName,
  genreName,
  genreOneLine,
  pathText,
  setLocale,
  t,
} from '../js/i18n.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));

const genresFile = read('data/genres.json');
const albums = read('data/albums.json');
const paths = read('data/paths.json');
const canonical = {
  genres: genresFile.genres,
  lineage: genresFile.lineage,
  families: genresFile.families,
  eras: genresFile.eras,
  present: genresFile.meta?.present ?? 2027,
  albums,
  paths,
  source: 'static',
};

// localizeData consumes the same generated sidecar as the browser. The npm data
// pipeline builds and validates this file immediately before running this script.
globalThis.__JAZZ_ZH_CN__ = read('data/localization.zh-CN.json');
globalThis.document ??= { documentElement: {} };
const chinese = localizeData(canonical, 'zh-CN');

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const q = (a) => encodeURIComponent(`${a.artist} ${a.title}`);

const STATIC_COPY = {
  en: {
    title: 'JazzTree — full text',
    description: ({ genres, edges, albums }) =>
      `The complete JazzTree guide as plain text: ${genres} genres, ${edges} influence edges, ${albums} records.`,
    lede: ({ genres, edges, albums }) =>
      `${genres} genres, ${edges} influence edges, ${albums} records. This is the complete text of the guide, without the interactive graph.`,
    sources: 'Sources and known gaps:',
    judgments: 'Judgment calls:',
    interactive: 'Interactive version:',
    genres: 'Genres',
    paths: 'Listening paths',
    records: (count) => `${count} records`,
    alsoCalled: 'also called',
    labels: 'Labels',
    cameOutOf: 'Came out of',
    fedInto: 'Fed into',
    via: 'via',
  },
  'zh-CN': {
    title: 'JazzTree — 完整文字版',
    description: ({ genres, edges, albums }) =>
      `JazzTree 完整文字指南：${genres} 种流派、${edges} 条影响关系、${albums} 张唱片。`,
    lede: ({ genres, edges, albums }) =>
      `${genres} 种流派、${edges} 条影响关系、${albums} 张唱片。这是本指南的完整文字版，不包含互动谱系图。`,
    sources: '资料来源及已知缺口：',
    judgments: '判断与取舍：',
    interactive: '互动版：',
    genres: '流派',
    paths: '聆听路线',
    records: (count) => `${count} 张唱片`,
    alsoCalled: '又称',
    labels: '厂牌',
    cameOutOf: '源自',
    fedInto: '影响了',
    via: '传承要素：',
    personnel: '演奏人员：',
  },
};

// Personnel names stay canonical, while the role abbreviations shown beside
// them are localized for the Chinese plain-text page.
const PERSONNEL_ROLES_ZH = {
  Cm: 'C 调旋律萨克斯', DJ: '唱片骑师', 'Hammond org': '哈蒙德风琴', MC: '主持／说唱',
  accordion: '手风琴', arr: '编曲', as: '中音萨克斯', b: '低音提琴', band: '乐队',
  'bass fl': '低音长笛', 'bass marimba': '低音马林巴', 'batá': '巴塔鼓', bcl: '低音单簧管',
  beatbox: '口技节拍', bells: '铃', berimbau: '比林鲍琴', bj: '班卓琴', bongos: '邦戈鼓',
  bs: '上低音萨克斯', cello: '大提琴', cl: '单簧管', clavinet: '电键琴', comp: '作曲',
  cond: '指挥', congas: '康加鼓', cor: '短号', curator: '策划', d: '鼓',
  didgeridoo: '迪吉里杜管', elb: '电贝司', elg: '电吉他', elp: '电钢琴', fl: '长笛',
  flugelhorn: '富鲁格号', frh: '圆号', g: '吉他', 'guitar synth': '吉他合成器', harp: '竖琴',
  hubkaphone: '轮毂盖打击乐器', keys: '键盘', ldr: '乐队领队', lyr: '作词', maracas: '沙锤',
  marimba: '马林巴', ms: '女中音', 'multi-instruments': '多种乐器', 'mus. dir': '音乐指导',
  ob: '双簧管', oboe: '双簧管', ocarina: '陶笛', org: '风琴', p: '钢琴', percussion: '打击乐',
  piccolo: '短笛', 'pocket tp': '袖珍小号', poetry: '诗歌朗诵', prod: '制作',
  'production collective': '制作团体', programming: '编程', prompter: '提示指挥', recorder: '竖笛',
  reeds: '簧管乐器', s: '女高音', sax: '萨克斯', saxello: '萨克赛洛管', ss: '高音萨克斯',
  synths: '合成器', t: '男高音', tabla: '塔布拉鼓', tanpura: '坦布拉琴', tb: '长号',
  timbales: '蒂姆巴莱斯鼓', tp: '小号', ts: '次中音萨克斯', tuba: '大号', turntables: '唱盘',
  tympani: '定音鼓', vib: '颤音琴', viola: '中提琴', vln: '小提琴', voc: '人声', vocoder: '声码器',
};

const PERSONNEL_LINES_ZH = {
  various: '多位乐手',
  'various bands': '多支乐队',
  'string section': '弦乐声部',
  'string orchestra': '弦乐团',
  'tsuzumi drums': '日本鼓',
  'noh vocal': '能乐人声',
  'compiled by Gilles Peterson and Norman Jay': 'Gilles Peterson、Norman Jay 编选',
  'cello ensemble': '大提琴合奏',
  "Jimmy Rushing's KC lineage": 'Jimmy Rushing 的堪萨斯城谱系',
};

const CANONICAL_PERSONNEL_NAMES = new Set([
  'Beaux Arts String Quartet', 'Ibex Band', 'Walias Band', "Shebele's Band",
  'Lincoln Center Jazz Orchestra', 'OSSO String Quartet', 'Ezra Collective',
]);

function personnelZh(value) {
  if (PERSONNEL_LINES_ZH[value]) return PERSONNEL_LINES_ZH[value];
  const numbered = value.match(/^(\d+)-(piece orchestra|voice choir|piece ensemble)$/);
  if (numbered) {
    const noun = {
      'piece orchestra': '人管弦乐团', 'voice choir': '人合唱团', 'piece ensemble': '人合奏团',
    }[numbered[2]];
    return `${numbered[1]} ${noun}`;
  }
  const match = value.match(/^(.*) \(([^()]*)\)$/);
  if (match) {
    const roles = match[2].split(',').map((role) => role.trim()).map((role) => {
      const translated = PERSONNEL_ROLES_ZH[role];
      if (!translated) throw new Error(`Missing Simplified Chinese personnel role: ${role}`);
      return translated;
    });
    return `${match[1]}（${roles.join('、')}）`;
  }
  if (CANONICAL_PERSONNEL_NAMES.has(value)) return value;
  throw new Error(`Missing Simplified Chinese personnel line: ${value}`);
}

function renderStatic(data, locale) {
  setLocale(locale);
  const isZh = locale === 'zh-CN';
  const copy = STATIC_COPY[locale];
  const { genres, lineage, families, albums, paths, present } = data;
  const counts = { genres: genres.length, edges: lineage.length, albums: albums.length };
  const span = (g) => g.era.end == null ? `${g.era.start}–${t('era.present')}` : `${g.era.start}–${g.era.end}`;
  const name = (id) => {
    const genre = genres.find((item) => item.id === id);
    return genre ? genreName(genre) : id;
  };

  function albumHtml(a) {
    const facts = isZh ? [
      a.recorded === a.released
        ? t('album.recordedReleased', { year: a.recorded })
        : t('album.recorded', { recorded: a.recorded, released: a.released ?? '—' }),
      a.label + (a.catalogNo ? ` ${a.catalogNo}` : ''),
      t('album.difficulty', { difficulty: a.difficulty, label: t(`difficulty.${a.difficulty}`) }),
      a.startTrack ? t('album.startWith', { track: a.startTrack }) : null,
      a.confidence !== 'high'
        ? t('album.confidence', { confidence: t(`confidence.${a.confidence}`) })
        : null,
    ] : [
      a.recorded === a.released ? `recorded/released ${a.recorded}` : `recorded ${a.recorded}, released ${a.released ?? '—'}`,
      a.label + (a.catalogNo ? ` ${a.catalogNo}` : ''),
      `difficulty ${a.difficulty}/5`,
      a.startTrack ? `start with “${a.startTrack}”` : null,
      a.confidence !== 'high' ? `${a.confidence} confidence` : null,
    ];
    const personnel = a.personnel?.length
      ? (isZh ? a.personnel.map(personnelZh) : a.personnel).map(esc).join(' · ')
      : '';
    const tier = isZh ? t(`panel.${a.tier}`) : a.tier;
    const listenFor = isZh ? `${t('album.listenFor')}：` : 'Listen for:';
    const note = isZh ? t('album.note', { note: a.note }) : `Note: ${a.note}`;
    const netease = isZh ? t('service.name.netease') : 'NetEase';
    return `<article class="a" id="album-${esc(a.id)}">
  <h4>${esc(a.artist)} — <em>${esc(a.title)}</em> <span class="tier">${esc(tier)}</span></h4>
  <p class="facts">${facts.filter(Boolean).map(esc).join(' · ')}</p>
  ${personnel ? `<p class="facts">${isZh ? copy.personnel : ''}${personnel}</p>` : ''}
  <p>${esc(a.whyThisOne)}</p>
  <p><b>${listenFor}</b> ${esc(a.listenFor)}</p>
  ${a.note ? `<p class="note">${esc(note)}</p>` : ''}
  <p class="links">
    <a href="https://open.spotify.com/search/${q(a)}" target="_blank" rel="noopener noreferrer">Spotify</a> ·
    <a href="https://music.apple.com/us/search?term=${q(a)}" target="_blank" rel="noopener noreferrer">Apple Music</a> ·
    <a href="https://music.163.com/#/search/m/?s=${q(a)}" target="_blank" rel="noopener noreferrer">${netease}</a>
  </p>
</article>`;
  }

  const genreHtml = (g) => {
    const own = albums.filter((a) => a.genreIds[0] === g.id);
    const parents = lineage.filter((e) => e.to === g.id);
    const children = lineage.filter((e) => e.from === g.id);
    const family = families.find((f) => f.id === g.family);
    const origin = `${esc(g.origin.city)}${isZh ? '、' : ', '}${esc(g.origin.country)}`;
    const aliases = g.aka?.length
      ? ` · ${copy.alsoCalled}${isZh ? '：' : ' '}${g.aka.map(esc).join(isZh ? '、' : ', ')}`
      : '';
    const edgeType = (edge) => isZh ? edgeTypeLabel(edge.type) : edge.type.replace(/-/g, ' ');
    const edgeAspects = (edge) => edge.aspects.map((aspect) => isZh ? aspectLabel(aspect) : aspect).join(isZh ? '、' : ', ');
    const parentLine = (edge) => isZh
      ? `<li><a href="#${esc(edge.from)}">${esc(name(edge.from))}</a> — <i>${esc(edgeType(edge))}</i>，${edge.year} 年，${copy.via}${esc(edgeAspects(edge))}。${esc(edge.explanation)}</li>`
      : `<li><a href="#${esc(edge.from)}">${esc(name(edge.from))}</a> — <i>${esc(edgeType(edge))}</i>, ${edge.year}, ${copy.via} ${edgeAspects(edge)}. ${esc(edge.explanation)}</li>`;
    const childLine = (edge) => isZh
      ? `<li><a href="#${esc(edge.to)}">${esc(name(edge.to))}</a> — <i>${esc(edgeType(edge))}</i>，${edge.year} 年</li>`
      : `<li><a href="#${esc(edge.to)}">${esc(name(edge.to))}</a> — <i>${esc(edgeType(edge))}</i>, ${edge.year}</li>`;
    return `<section class="g" id="${esc(g.id)}">
  <h2>${esc(genreName(g))} <span class="years">${span(g)}</span></h2>
  <p class="one">${esc(genreOneLine(g))}</p>
  <p class="facts">${origin} · ${esc(family ? familyName(family) : g.family)}${aliases}</p>
  <p>${esc(g.summary)}</p>
  <h3>${isZh ? t('panel.listenFor') : 'What to listen for'}</h3>
  <ul>${g.earMarkers.map((marker) => `<li>${esc(marker)}</li>`).join('')}</ul>
  <h3>${isZh ? t('panel.how') : 'How it works'}</h3>
  <dl>${Object.entries(g.musicalTraits).map(([key, value]) => `<dt>${esc(isZh ? aspectLabel(key) : key)}</dt><dd>${esc(value)}</dd>`).join('')}</dl>
  <h3>${isZh ? t('panel.figures') : 'Key figures'}</h3>
  <ul>${g.keyFigures.map((figure) => `<li><b>${esc(figure.name)}</b>${isZh ? '（' : ' ('}${esc(figure.instrument)}${isZh ? '）' : ')'} — ${esc(figure.why)}</li>`).join('')}</ul>
  <p class="facts">${isZh ? `${t('panel.labels')}：` : `${copy.labels}:`} ${g.keyLabels.map(esc).join(' · ')}</p>
  <h3>${isZh ? t('panel.contested') : 'Contested'}</h3>
  <p class="contested">${esc(g.contested)}</p>
  ${parents.length ? `<h3>${copy.cameOutOf}</h3><ul>${parents.map(parentLine).join('')}</ul>` : ''}
  ${children.length ? `<h3>${copy.fedInto}</h3><ul>${children.map(childLine).join('')}</ul>` : ''}
  <h3>${isZh ? t('panel.hear') : 'What to hear'}</h3>
  ${['gateway', 'core', 'deep'].map((tier) => {
    const list = own.filter((a) => a.tier === tier);
    const title = isZh ? t(`panel.${tier}`) : tier;
    return list.length ? `<h4 class="tierhead">${title}</h4>${list.map(albumHtml).join('')}` : '';
  }).join('')}
</section>`;
  };

  const pathHtml = (path) => `<section class="g" id="path-${esc(path.id)}">
  <h2>${esc(pathText(path, 'name'))} <span class="years">${copy.records(path.steps.length)}</span></h2>
  <p class="one">${esc(pathText(path, 'subtitle'))}</p>
  <p>${esc(pathText(path, 'blurb'))}</p>
  <ol class="steps">${path.steps.map((step) => {
    const album = albums.find((item) => item.id === step.albumId);
    return `<li><p class="bridge">${esc(step.bridge)}</p>${album ? albumHtml(album) : ''}</li>`;
  }).join('')}</ol>
</section>`;

  const sortedGenres = genres.slice().sort((a, b) => a.era.start - b.era.start);
  return `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(copy.title)}</title>
<meta name="description" content="${esc(copy.description(counts))}">
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
<p class="lede">${copy.lede(counts)}</p>
<p class="facts">${copy.sources} <a href="research/notes.md">research/notes.md</a> · ${copy.judgments} <a href="DECISIONS.md">DECISIONS.md</a> · ${copy.interactive} <a href="index.html">index.html</a></p>

<h3>${copy.genres}</h3>
<ul class="toc">${sortedGenres
    .map((genre) => `<li><a href="#${esc(genre.id)}">${esc(genreName(genre))}</a> <span class="years">${span(genre)}</span></li>`)
    .join('')}</ul>

<h3>${copy.paths}</h3>
<ul>${paths.map((path) => `<li><a href="#path-${esc(path.id)}">${esc(pathText(path, 'name'))}</a> — ${esc(pathText(path, 'subtitle'))}</li>`).join('')}</ul>

${sortedGenres.map(genreHtml).join('\n')}

<h3 style="margin-top:3rem">${copy.paths}</h3>
${paths.map(pathHtml).join('\n')}
</div>
</body>
</html>
`;
}

for (const output of [
  { locale: 'en', filename: 'static.html', data: canonical },
  { locale: 'zh-CN', filename: 'static.zh-CN.html', data: chinese },
]) {
  const html = renderStatic(output.data, output.locale);
  writeFileSync(join(root, output.filename), html);
  console.log(
    `wrote ${output.filename} — ${output.data.genres.length} genres, ${output.data.albums.length} albums, ` +
    `${output.data.paths.length} paths, ${(html.length / 1024).toFixed(0)} KB`
  );
}

setLocale('en');
