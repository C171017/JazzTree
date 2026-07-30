#!/usr/bin/env node
// Merges the hand-authored build/*.json fragments into data/genres.json and data/albums.json.
// Run from the project root:  node build/merge.js
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));

// Album ids that were authored with a slug naming the wrong artist/record.
const ID_FIXES = {
  'louis-armstrong-hot-five-1927': 'johnny-dodds-blue-clarinet-stomp',
  'bud-shank-jazz-at-cal-tech': 'bud-shank-bob-cooper-blowin-country',
  'dick-wellstood-alone': 'dick-wellstood-from-ragtime-on',
  'romane-elios-quintet': 'romane-ombre',
  'django-a-tribute-martin-taylor': 'martin-taylor-spirit-of-django',
  'irene-schweizer-live-at-taktlos': 'schweizer-moholo-duo',
  'art-hodes-blues-in-the-night': 'art-hodes-sittin-in',
  'eddie-condon-chicago-style': 'eddie-condon-chronological-1927-1938',
  'sy-oliver-jimmie-lunceford': 'jimmie-lunceford-rhythm-is-our-business',
  'leroy-jenkins-space-minds': 'revolutionary-ensemble-peoples-republic',
  'jazz-samurai-koichi-matsukaze': 'koichi-matsukaze-at-the-room-427',
  'incognito-jazz-funk': 'incognito-positivity',
  'roy-ayers-vibrant-new-direction': 'roy-ayers-wake-up',
  'gang-starr-jazz-thing': 'gang-starr-daily-operation',
  'brainfeeder-miguel-atwood-ferguson-suite': 'atwood-ferguson-suite-for-ma-dukes',
  'sons-of-kemet-your-queen-is-a-reptile': 'kamaal-williams-the-return',
  'arvo-part-tabula-rasa-jarrett': 'gary-peacock-tales-of-another',
  'zeena-parkins-no-way-back': 'elliott-sharp-carbon-tocsin',
  'james-chance-buy': 'james-white-off-white',
  'steve-coleman-afrocuba-de-matanzas': 'steve-coleman-sign-and-the-seal',
  'gilles-peterson-rebirth-of-cool': 'rebirth-of-cool-vol1',
  'eddie-harris-les-mccann-swiss-movement': 'les-mccann-eddie-harris-swiss-movement',
  'jimmy-giuffre-3-1961': 'jimmy-giuffre-fusion-1961',
  'sons-of-kemet-your-queen-is-a-reptile-album': 'sons-of-kemet-your-queen-is-a-reptile',
};

const FAMILIES = [
  { id: 'trad-mainstream', name: 'Traditional & Mainstream', short: 'Mainstream',
    blurb: 'The acoustic through-line: New Orleans to swing to bebop to hard bop to the modern mainstream.' },
  { id: 'avant', name: 'Avant-Garde & Composed', short: 'Avant-Garde',
    blurb: 'The experimental and composed wing — free jazz, the collectives, European improvisation, chamber jazz.' },
  { id: 'electric', name: 'Electric & Crossover', short: 'Electric',
    blurb: 'Amplified, groove-first and producer-shaped: fusion, funk, and everything downstream of the sampler.' },
  { id: 'global', name: 'Global Currents', short: 'Global',
    blurb: 'Jazz built on rhythmic systems from outside the United States, and the scenes that grew around them.' },
];

const ERAS = [
  { id: 'trad',       name: 'Trad',       start: 1890, end: 1929 },
  { id: 'swing',      name: 'Swing',      start: 1929, end: 1945 },
  { id: 'modern',     name: 'Modern',     start: 1945, end: 1959 },
  { id: 'the-break',  name: 'The Break',  start: 1959, end: 1969 },
  { id: 'electric',   name: 'Electric',   start: 1969, end: 1980 },
  { id: 'postmodern', name: 'Postmodern', start: 1980, end: 2027 },
];

const genres = [
  ...read('build/genres-1-early.json'),
  ...read('build/genres-2-modern.json'),
  ...read('build/genres-3-global.json'),
  ...read('build/genres-4-electric.json'),
];
const lineage = read('build/lineage.json');
const albums = [
  ...read('build/albums-1-early.json'),
  ...read('build/albums-2-modern.json'),
  ...read('build/albums-3-global.json'),
  ...read('build/albums-4-electric.json'),
  ...read('build/albums-5-modern.json'),
].map((a) => (ID_FIXES[a.id] ? { ...a, id: ID_FIXES[a.id] } : a));

// hingeAlbum references follow the same renames.
for (const e of lineage) {
  if (e.hingeAlbum && ID_FIXES[e.hingeAlbum]) e.hingeAlbum = ID_FIXES[e.hingeAlbum];
}

const PRESENT = 2027; // graph right edge; genres with era.end === null run to here

writeFileSync(
  join(root, 'data/genres.json'),
  JSON.stringify({ meta: { present: PRESENT, generated: 'hand-authored; see research/notes.md' }, families: FAMILIES, eras: ERAS, genres, lineage }, null, 2) + '\n'
);
writeFileSync(join(root, 'data/albums.json'), JSON.stringify(albums, null, 2) + '\n');

console.log(`merged ${genres.length} genres, ${lineage.length} lineage edges, ${albums.length} albums`);
