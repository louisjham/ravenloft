/**
 * Rebrand script for the Castle Ravenloft -> original gothic IP fork.
 *
 * Rewrites expressive text (names, descriptions, flavor text) while preserving
 * 100% of mechanical fields (ids, stats, effects, triggers, ranges, targets).
 *
 * Usage:
 *   npx ts-node scripts/rebrand.ts --bible ./rebrand-bible.json --dry-run
 *   npx ts-node scripts/rebrand.ts --bible ./rebrand-bible.json --out ./src/data.rebranded
 *
 * The bible JSON defines your world's names. Fill it in before running.
 * LLM provider: set REBRAND_LLM=anthropic|openai and the matching API key env var.
 * Without an API key, executes high-fidelity deterministic glossary rebrand.
 */

import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

interface Bible {
  worldTitle: string;
  villainName: string;
  villainTitle: string;
  castleName: string;
  heroes: { oldName: string; newName: string; archetype: string }[];
  monsters: { oldName: string; newName: string }[];
  /** Extra find/replace pairs for proper nouns, factions, places */
  glossary: { from: string; to: string }[];
}

interface Args {
  bible: string;
  out: string;
  dryRun: boolean;
  dumpPrompts: boolean;
  only: string[]; // file basenames to process, empty = all
}

function parseArgs(): Args {
  const a = process.argv.slice(2);
  const get = (flag: string) => {
    const i = a.indexOf(flag);
    return i >= 0 && i + 1 < a.length ? a[i + 1] : '';
  };
  return {
    bible: get('--bible') || './rebrand-bible.json',
    out: get('--out') || '',
    dryRun: a.includes('--dry-run'),
    dumpPrompts: a.includes('--dump-prompts'),
    only: (get('--only') || '').split(',').filter(Boolean),
  };
}

// Files to process, relative to src/data. `textFields` are rewritten;
// everything else passes through byte-identical.
const TARGETS: { file: string; textFields: string[] }[] = [
  { file: 'heroes.json', textFields: ['name', 'bio'] },
  { file: 'powerCards.json', textFields: ['name', 'description', 'flavorText'] },
  { file: 'cards/treasures.json', textFields: ['name', 'description', 'flavorText'] },
  { file: 'cards/encounters.json', textFields: ['name', 'description', 'flavorText'] },
  { file: 'cards/items.json', textFields: ['name', 'description', 'flavorText'] },
  { file: 'cards/monsters.json', textFields: ['name', 'description', 'flavorText', 'tactics'] },
  { file: 'monsters.json', textFields: ['name', 'description', 'tactics', 'tacticsText', 'specialAbilityText'] },
  { file: 'cards/hero-abilities/arjhan.json', textFields: ['name', 'description', 'flavorText'] },
  { file: 'cards/hero-abilities/immeril.json', textFields: ['name', 'description', 'flavorText'] },
  { file: 'cards/hero-abilities/kat.json', textFields: ['name', 'description', 'flavorText'] },
  { file: 'cards/hero-abilities/thorgrim.json', textFields: ['name', 'description', 'flavorText'] },
  { file: 'cards/hero-abilities/alissa.json', textFields: ['name', 'description', 'flavorText'] },
  { file: 'scenarios.json', textFields: ['name', 'description', 'introText'] },
  { file: 'boss-phases.json', textFields: ['className'] },
  { file: 'tiles.json', textFields: ['name'] },
  { file: 'scenarios/scenario1.json', textFields: ['name', 'description', 'introText', 'victoryText', 'defeatText'] },
  { file: 'scenarios/scenario2.json', textFields: ['name', 'description', 'introText', 'victoryText', 'defeatText'] },
  { file: 'scenarios/scenario3.json', textFields: ['name', 'description', 'introText', 'victoryText', 'defeatText'] },
  { file: 'scenarios/scenario4.json', textFields: ['name', 'description', 'introText', 'victoryText', 'defeatText'] },
  { file: 'scenarios/scenario5.json', textFields: ['name', 'description', 'introText', 'victoryText', 'defeatText'] },
  { file: 'scenarios/adventure_01.json', textFields: ['name', 'description', 'introText', 'victoryText', 'defeatText'] },
  { file: 'scenarios/adventure_02.json', textFields: ['name', 'description', 'introText', 'victoryText', 'defeatText'] },
  { file: 'scenarios/adventure_03.json', textFields: ['name', 'description', 'introText', 'victoryText', 'defeatText'] },
  { file: 'scenarios/adventure_04.json', textFields: ['name', 'description', 'introText', 'victoryText', 'defeatText'] },
  { file: 'scenarios/adventure_05.json', textFields: ['name', 'description', 'introText', 'victoryText', 'defeatText'] },
  { file: 'scenarios/adventure_06.json', textFields: ['name', 'description', 'introText', 'victoryText', 'defeatText'] },
  { file: 'scenarios/adventure_07.json', textFields: ['name', 'description', 'introText', 'victoryText', 'defeatText'] },
  { file: 'scenarios/adventure_08.json', textFields: ['name', 'description', 'introText', 'victoryText', 'defeatText'] },
  { file: 'scenarios/adventure_09.json', textFields: ['name', 'description', 'introText', 'victoryText', 'defeatText'] },
  { file: 'scenarios/adventure_10.json', textFields: ['name', 'description', 'introText', 'victoryText', 'defeatText'] },
  { file: 'scenarios/adventure_11.json', textFields: ['name', 'description', 'introText', 'victoryText', 'defeatText'] },
  { file: 'scenarios/adventure_12.json', textFields: ['name', 'description', 'introText', 'victoryText', 'defeatText'] },
  { file: 'scenarios/adventure_13.json', textFields: ['name', 'description', 'introText', 'victoryText', 'defeatText'] },
  { file: 'scenarios/adventure_tome_of_strahd.json', textFields: ['name', 'description', 'introText', 'victoryText', 'defeatText'] },
];

// ---------------------------------------------------------------------------
// Deterministic Glossary Engine
// ---------------------------------------------------------------------------

export function applyGlossary(text: string, bible: Bible): string {
  if (!text || typeof text !== 'string') return text;
  let result = text;

  // Sort glossary items by length descending so longer phrases match first
  const glossary = [...bible.glossary].sort((a, b) => b.from.length - a.from.length);
  for (const item of glossary) {
    const escaped = item.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
    result = result.replace(regex, (match) => {
      if (match === match.toUpperCase() && match.length > 1) {
        return item.to.toUpperCase();
      }
      if (match[0] === match[0].toUpperCase()) {
        return item.to.charAt(0).toUpperCase() + item.to.slice(1);
      }
      return item.to;
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// LLM
// ---------------------------------------------------------------------------

function buildPrompt(bible: Bible, entityType: string, fields: Record<string, string>): string {
  const heroLines = bible.heroes.map(h => `  - ${h.oldName} -> ${h.newName} (${h.archetype})`).join('\n');
  const monsterLines = bible.monsters.map(m => `  - ${m.oldName} -> ${m.newName}`).join('\n');
  const glossLines = bible.glossary.map(g => `  - "${g.from}" -> "${g.to}"`).join('\n');
  const fieldLines = Object.entries(fields).map(([k, v]) => `${k}: """${v}"""`).join('\n');

  return `You are rewriting card/game text for a gothic fantasy dungeon-crawler board game adaptation. The original text is from a D&D-licensed product; produce original text with the same mechanical meaning but no D&D proper nouns, trademarked terms, or copied flavor.

WORLD BIBLE (use these names exactly):
- Game title: ${bible.worldTitle}
- Main villain: ${bible.villainName}, ${bible.villainTitle}
- Castle: ${bible.castleName}
- Heroes:
${heroLines}
- Monsters:
${monsterLines}
- Glossary:
${glossLines}

RULES:
1. Rewrite each field below. Keep the MECHANICAL meaning identical (who it targets, ranges, damage, conditions, timing). Only the expressive wording and proper nouns change.
2. Keep roughly the same length. Card text must stay concise.
3. Never use: Ravenloft, Strahd, von Zarovich, Barovia, D&D class/race trademarks used as proper nouns (use the bible's archetype names instead).
4. Output ONLY a JSON object with the same field keys and rewritten string values. No explanation.

FIELDS (${entityType}):
${fieldLines}`;
}

async function callLLM(prompt: string): Promise<Record<string, string>> {
  const provider = process.env.REBRAND_LLM || 'anthropic';
  const model = process.env.REBRAND_MODEL || (provider === 'anthropic' ? 'claude-sonnet-4-20250514' : 'gpt-4o-mini');

  if (provider === 'anthropic') {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error('ANTHROPIC_API_KEY not set');
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model, max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const data = await res.json() as any;
    const text = data.content?.[0]?.text ?? '';
    return JSON.parse(text);
  } else {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error('OPENAI_API_KEY not set');
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model, temperature: 0.7,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      }),
    });
    const data = await res.json() as any;
    return JSON.parse(data.choices[0].message.content);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function copyDirRecursive(src: string, dest: string) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else if (!fs.existsSync(destPath)) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

async function main() {
  const args = parseArgs();
  const bible: Bible = JSON.parse(fs.readFileSync(args.bible, 'utf8'));
  const dataDir = path.resolve('src/data');
  const outDir = args.out ? path.resolve(args.out) : dataDir;

  // Safety: never overwrite src/data without --out unless explicitly confirmed
  if (!args.out && !args.dryRun && !args.dumpPrompts) {
    console.error('Refusing to overwrite src/data in place. Pass --out <dir> or --dry-run.');
    process.exit(1);
  }

  const hasLLMKey = Boolean(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY);
  if (!hasLLMKey && !args.dryRun && !args.dumpPrompts) {
    console.log('[rebrand] No LLM API key detected — executing deterministic glossary rebrand pass.');
  }

  // Pre-seed output directory with all assets/files if outputting to a separate dir
  if (outDir !== dataDir && !args.dryRun && !args.dumpPrompts) {
    copyDirRecursive(dataDir, outDir);
  }

  let totalEntities = 0, totalFields = 0, totalChars = 0;
  const promptDump: string[] = [];

  for (const target of TARGETS) {
    if (args.only.length && !args.only.includes(path.basename(target.file))) continue;
    const srcPath = path.join(dataDir, target.file);
    if (!fs.existsSync(srcPath)) {
      console.log(`SKIP (missing): ${target.file}`);
      continue;
    }

    const raw = fs.readFileSync(srcPath, 'utf8');
    const entities: any = JSON.parse(raw);
    const isSingleObject = !Array.isArray(entities) && typeof entities === 'object';
    const list = Array.isArray(entities) ? entities : [entities];

    for (const ent of list) {
      const fields: Record<string, string> = {};
      for (const f of target.textFields) {
        if (typeof ent[f] === 'string' && ent[f].trim()) {
          fields[f] = ent[f];
        } else if (Array.isArray(ent[f])) {
          // Array of strings (e.g. tactics array)
          ent[f] = ent[f].map((str: any) => typeof str === 'string' ? applyGlossary(str, bible) : str);
        }
      }

      // Objectives in scenarios
      if (Array.isArray(ent.objectives)) {
        for (const obj of ent.objectives) {
          if (typeof obj.description === 'string') {
            obj.description = applyGlossary(obj.description, bible);
          }
        }
      }

      // Special rules in scenarios
      if (Array.isArray(ent.specialRules)) {
        for (const rule of ent.specialRules) {
          if (typeof rule.description === 'string') {
            rule.description = applyGlossary(rule.description, bible);
          }
        }
      }

      // Victory conditions in scenarios
      if (Array.isArray(ent.victoryConditions)) {
        ent.victoryConditions = ent.victoryConditions.map((cond: any) =>
          typeof cond === 'string' ? applyGlossary(cond, bible) : cond
        );
      }

      // Special handling for boss-phases.json
      if (ent.strahd && Array.isArray(ent.strahd.phases)) {
        for (const p of ent.strahd.phases) {
          if (typeof p.className === 'string') {
            p.className = applyGlossary(p.className, bible);
          }
        }
      }

      if (!Object.keys(fields).length) continue;

      totalEntities++;
      totalFields += Object.keys(fields).length;
      totalChars += Object.values(fields).join('').length;

      // Deterministic glossary pass first (proper nouns)
      for (const [k, v] of Object.entries(fields)) {
        const replaced = applyGlossary(v, bible);
        fields[k] = replaced;
        ent[k] = replaced;
      }

      if (args.dumpPrompts) {
        const prompt = buildPrompt(bible, target.file, fields);
        promptDump.push(`### ${target.file} :: ${ent.id || ent.name}\n${prompt}\n`);
        continue;
      }
      if (args.dryRun) continue;

      if (hasLLMKey) {
        try {
          const prompt = buildPrompt(bible, target.file, fields);
          const rewritten = await callLLM(prompt);
          for (const [k, v] of Object.entries(rewritten)) {
            if (typeof v === 'string' && target.textFields.includes(k)) ent[k] = v;
          }
          await sleep(400); // rate-limit courtesy
        } catch (e: any) {
          console.error(`LLM FAIL ${target.file} :: ${ent.id}: ${e.message}`);
        }
      }
    }

    if (!args.dryRun && !args.dumpPrompts) {
      const dest = path.join(outDir, target.file);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      // Backup originals once
      const bak = srcPath + '.rebrand-bak';
      if (!fs.existsSync(bak) && path.resolve(srcPath) !== path.resolve(dest)) {
        fs.copyFileSync(srcPath, bak);
      }
      const outputData = Array.isArray(entities) ? list : (isSingleObject && list.length === 1 ? list[0] : list);
      fs.writeFileSync(dest, JSON.stringify(outputData, null, 2) + '\n');
      console.log(`WROTE: ${target.file} (${list.length} entities)`);
    }
  }

  if (args.dumpPrompts) {
    fs.writeFileSync('rebrand-prompts.md', promptDump.join('\n---\n'));
    console.log(`Dumped ${promptDump.length} prompts to rebrand-prompts.md`);
  }

  console.log(`\nEntities: ${totalEntities} | Fields: ${totalFields} | Chars: ${totalChars}`);
  console.log(`Est. words: ~${Math.round(totalChars / 5.5)}`);
  if (args.dryRun) console.log('(dry run — no files written, no LLM calls made)');
}

main().catch(e => { console.error(e); process.exit(1); });
