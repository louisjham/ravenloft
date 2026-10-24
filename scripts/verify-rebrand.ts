#!/usr/bin/env npx ts-node
/**
 * Post-rebrand verification: scans data files for leftover D&D trademark terms.
 * Run after rebrand.ts to catch anything the LLM missed.
 *
 * Usage: npx ts-node scripts/verify-rebrand.ts --dir ./src/data.rebranded
 */
import * as fs from 'fs';
import * as path from 'path';

const FORBIDDEN = [
  'ravenloft', 'strahd', 'von zarovich', 'barovia',
  'faerun', "faerûn", 'sword coast', 'underdark',
  'mind flayer', 'illithid', 'beholder', 'tarrasque',
  'vecna', 'mordenkainen', 'tasha', "bigby",
  'drizzt', "d'urden",
];

const dir = process.argv.includes('--dir')
  ? process.argv[process.argv.indexOf('--dir') + 1]
  : 'src/data';

let hits = 0;
function scan(file: string) {
  const text = fs.readFileSync(file, 'utf8');
  const lower = text.toLowerCase();
  for (const term of FORBIDDEN) {
    let idx = lower.indexOf(term);
    while (idx !== -1) {
      // Show surrounding context
      const ctx = text.slice(Math.max(0, idx - 40), idx + term.length + 40).replace(/\s+/g, ' ');
      console.log(`HIT "${term}" in ${path.basename(file)}: ...${ctx}...`);
      hits++;
      idx = lower.indexOf(term, idx + 1);
      if (hits > 50) return; // cap output
    }
  }
}

function walk(d: string) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.json') && !e.name.endsWith('.rebrand-bak')) scan(p);
  }
}

walk(path.resolve(dir));
console.log(hits === 0 ? '\nCLEAN: no forbidden terms found.' : `\n${hits} hits need review.`);
process.exit(hits === 0 ? 0 : 1);
