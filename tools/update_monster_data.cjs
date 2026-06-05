const fs = require('fs');

// Read monsters.json
const monstersPath = 'src/data/monsters.json';
let monsters = JSON.parse(fs.readFileSync(monstersPath, 'utf8'));

// Read monsters CSV for passLeft data
const monstersCsv = fs.readFileSync('chromatic_dragons_monsters.csv', 'utf8');
const monsterLines = monstersCsv.split('\n').filter(l => l.trim());
const monsterHeader = monsterLines[0].split(',');
const nameIdx = monsterHeader.indexOf('Name');
const passesLeftIdx = monsterHeader.indexOf('Passes Left');
const cardCountIdx = monsterHeader.indexOf('Card Count');
const typeIdx = monsterHeader.indexOf('Type');
const acIdx = monsterHeader.indexOf('AC');
const hpIdx = monsterHeader.indexOf('HP');
const attackIdx = monsterHeader.indexOf('Attack');
const damageIdx = monsterHeader.indexOf('Damage');
const specialNameIdx = monsterHeader.indexOf('Special Ability Name');
const specialTextIdx = monsterHeader.indexOf('Special Ability Text');
const tacticsIdx = monsterHeader.indexOf('Tactics');
const xpIdx = monsterHeader.indexOf('XP');

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

// Map CSV monster name → monster id in monsters.json
const nameToId = {};
for (const m of monsters) {
  nameToId[m.name.toLowerCase()] = m.id;
}

// ---- STEP 1: Update passLeft on all CSV monster entries ----
const seenMonsters = new Set();
for (let i = 1; i < monsterLines.length; i++) {
  const cols = parseCSVLine(monsterLines[i]);
  const name = cols[nameIdx];
  const passesLeft = cols[passesLeftIdx]?.trim().toLowerCase() === 'true';
  const cardCount = parseInt(cols[cardCountIdx], 10);
  const csvType = cols[typeIdx];
  const csvAc = cols[acIdx];
  const csvHp = cols[hpIdx];
  const csvAttack = cols[attackIdx];
  const csvDamage = cols[damageIdx];
  const csvSpecialName = cols[specialNameIdx];
  const csvSpecialText = cols[specialTextIdx];
  const csvTactics = cols[tacticsIdx];
  const csvXp = cols[xpIdx];

  const lookupName = name.toLowerCase();
  const monsterId = nameToId[lookupName];
  if (!monsterId) {
    console.log(`[WARN] Monster not found in monsters.json: "${name}" (id lookup failed)`);
    continue;
  }

  seenMonsters.add(monsterId);

  // Find and update the monster entry
  monsters = monsters.map(m => {
    if (m.id === monsterId) {
      const updated = { ...m };
      
      // Set passLeft
      updated.passLeft = passesLeft ? 1 : 0;
      
      // Update stats from CSV
      if (csvAc && csvAc !== '—') updated.ac = parseInt(csvAc, 10);
      if (csvHp && csvHp !== '—') {
        const hpVal = parseInt(csvHp, 10);
        if (!isNaN(hpVal)) {
          updated.hp = hpVal;
          updated.maxHp = hpVal;
        }
      }
      
      // Parse attack: extract first +NUMBER pattern for attackBonus
      if (csvAttack && csvAttack !== '—') {
        const atkMatch = csvAttack.match(/\+(\d+)/);
        if (atkMatch) updated.attackBonus = parseInt(atkMatch[1], 10);
        
        // Parse damage: extract NUMBER after "/" for damage
        const dmgMatch = csvAttack.match(/\/\s*(\d+)/);
        if (dmgMatch) updated.damage = parseInt(dmgMatch[1], 10);
      }
      
      // Update XP
      if (csvXp && csvXp !== '—') {
        const xpVal = parseInt(csvXp, 10);
        if (!isNaN(xpVal)) updated.experienceValue = xpVal;
      }
      
      // Update tactics text
      if (csvTactics) updated.tacticsText = csvTactics;
      
      // Update special ability text
      if (csvSpecialName || csvSpecialText) {
        const text = [];
        if (csvSpecialName) text.push(`Special Ability: ${csvSpecialName}`);
        if (csvSpecialText) text.push(csvSpecialText);
        updated.specialAbilityText = text.join(' — ');
      }
      
      // Update type
      if (csvType) updated.monsterType = csvType;
      
      return updated;
    }
    return m;
  });
  
  console.log(`[OK] Updated monster: ${name} (passLeft: ${passesLeft ? 1 : 0})`);
}

// ---- STEP 2: Process villains CSV ----
const villainsCsv = fs.readFileSync('chromatic_dragons_villains.csv', 'utf8');
const villainLines = villainsCsv.split('\n').filter(l => l.trim());
const villainHeader = villainLines[0].split(',');
const vNameIdx = villainHeader.indexOf('Name');
const vTypeIdx = villainHeader.indexOf('Type');
const vAcIdx = villainHeader.indexOf('AC');
const vAcNoteIdx = villainHeader.indexOf('AC Note');
const vHpIdx = villainHeader.indexOf('HP');
const vLevelIdx = villainHeader.indexOf('Level');
const vAttacksIdx = villainHeader.indexOf('Attacks (Name: Bonus / Damage)');
const vSpecialNameIdx = villainHeader.indexOf('Special Ability Name');
const vSpecialTextIdx = villainHeader.indexOf('Special Ability Text');
const vTacticsIdx = villainHeader.indexOf('Tactics');

const villainNameToId = {};
for (const m of monsters) {
  villainNameToId[m.name.toLowerCase()] = m.id;
}

for (let i = 1; i < villainLines.length; i++) {
  const cols = parseCSVLine(villainLines[i]);
  const name = cols[vNameIdx];
  const displayName = name.replace(/^"|"$/g, '').trim();
  // Handle "Baran, Death Knight" → lookup "death knight"
  const lookupNames = [
    displayName.toLowerCase(),
    displayName.toLowerCase().replace(/^.*, /, ''),
    displayName.toLowerCase().replace(/^.*,\s*/, ''),
  ];
  
  const csvType = cols[vTypeIdx];
  const csvAc = cols[vAcIdx];
  const csvAcNote = cols[vAcNoteIdx] || '';
  const csvHp = cols[vHpIdx];
  const csvLevel = cols[vLevelIdx];
  const csvAttacks = cols[vAttacksIdx];
  const csvSpecialName = cols[vSpecialNameIdx];
  const csvSpecialText = cols[vSpecialTextIdx];
  const csvTactics = cols[vTacticsIdx];
  
  let monsterId = null;
  let matchedName = '';
  for (const ln of lookupNames) {
    if (villainNameToId[ln]) {
      monsterId = villainNameToId[ln];
      matchedName = ln;
      break;
    }
  }
  
  if (!monsterId) {
    console.log(`[NEW] Villain not found in monsters.json: "${displayName}" — needs to be created`);
    // Create new villain entry
    const newId = `monster_${displayName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`;
    
    // Parse attack for first +NUMBER / NUMBER pattern
    let atkBonus = 8;
    let dmgVal = 2;
    if (csvAttacks) {
      const atkMatch = csvAttacks.match(/\+(\d+)/);
      if (atkMatch) atkBonus = parseInt(atkMatch[1], 10);
      const dmgMatch = csvAttacks.match(/\/\s*(\d+)/);
      if (dmgMatch) dmgVal = parseInt(dmgMatch[1], 10);
    }
    
    const newMonster = {
      id: newId,
      name: displayName,
      type: 'monster',
      monsterType: csvType || 'Monster',
      hp: csvHp ? parseInt(csvHp, 10) : 6,
      maxHp: csvHp ? parseInt(csvHp, 10) : 6,
      ac: csvAc ? parseInt(csvAc, 10) : 15,
      speed: 1,
      attackBonus: atkBonus,
      damage: dmgVal,
      experienceValue: csvLevel ? parseInt(csvLevel, 10) * 2 : 10,
      moveRange: 1,
      abilities: [],
      isBoss: true,
      behavior: {
        conditions: ['adjacent_to_hero', 'within_1_tile'],
        priorityTargets: ['closest'],
        actions: ['attack', 'move_toward']
      },
      isExhausted: false,
      position: { x: 0, z: 0, sqX: 0, sqZ: 0 },
      conditions: [],
      usedPowers: [],
      tacticsText: csvTactics || `If ${displayName} is within 1 tile of a hero, it moves adjacent and attacks. Otherwise, it moves towards the closest hero.`,
      specialAbilityText: csvSpecialName ? `Special Ability: ${csvSpecialName}${csvSpecialText ? ' — ' + csvSpecialText : ''}` : (csvSpecialText || '')
    };
    
    if (csvAcNote && csvAcNote !== '—') {
      newMonster.specialAbilityText = (newMonster.specialAbilityText ? newMonster.specialAbilityText + ' | ' : '') + `AC Note: ${csvAcNote}`;
    }
    
    monsters.push(newMonster);
    nameToId[displayName.toLowerCase()] = newId;
    console.log(`[NEW] Created villain: ${displayName} (${newId})`);
    continue;
  }
  
  // Update existing monster → villain
  seenMonsters.add(monsterId);
  
  // Parse attack for first +NUMBER / NUMBER pattern
  let atkBonus = 8;
  let dmgVal = 2;
  if (csvAttacks) {
    const atkMatch = csvAttacks.match(/\+(\d+)/);
    if (atkMatch) atkBonus = parseInt(atkMatch[1], 10);
    const dmgMatch = csvAttacks.match(/\/\s*(\d+)/);
    if (dmgMatch) dmgVal = parseInt(dmgMatch[1], 10);
  }
  
  monsters = monsters.map(m => {
    if (m.id === monsterId) {
      const updated = {
        ...m,
        monsterType: csvType || m.monsterType,
        hp: csvHp ? parseInt(csvHp, 10) : m.hp,
        maxHp: csvHp ? parseInt(csvHp, 10) : m.maxHp,
        ac: csvAc ? parseInt(csvAc, 10) : m.ac,
        attackBonus: atkBonus,
        damage: dmgVal,
        isBoss: true,
        tacticsText: csvTactics || m.tacticsText,
      };
      
      if (csvSpecialName || csvSpecialText) {
        const text = [];
        if (csvSpecialName) text.push(`Special Ability: ${csvSpecialName}`);
        if (csvSpecialText) text.push(csvSpecialText);
        updated.specialAbilityText = text.join(' — ');
      }
      
      if (csvAcNote && csvAcNote !== '—') {
        updated.specialAbilityText = (updated.specialAbilityText ? updated.specialAbilityText + ' | ' : '') + `AC Note: ${csvAcNote}`;
      }
      
      updated.passLeft = 0;
      
      return updated;
    }
    return m;
  });
  
  console.log(`[OK] Updated villain: ${displayName} (${monsterId})`);
}

// ---- STEP 3: Non-CSV monsters check ----
const allMonsterNames = new Set(monsters.map(m => m.name.toLowerCase()));
const allCsvMonsterNames = new Set();
for (let i = 1; i < monsterLines.length; i++) {
  const cols = parseCSVLine(monsterLines[i]);
  allCsvMonsterNames.add(cols[nameIdx].toLowerCase());
}
const allCsvVillainNames = new Set();
for (let i = 1; i < villainLines.length; i++) {
  const cols = parseCSVLine(villainLines[i]);
  const displayName = cols[vNameIdx].replace(/^"|"$/g, '').trim().toLowerCase();
  allCsvVillainNames.add(displayName);
  // Also add short name
  const shortName = displayName.replace(/^.*, /, '');
  if (shortName !== displayName) allCsvVillainNames.add(shortName);
}

console.log('\n--- Non-CSV monsters in monsters.json (needs review) ---');
for (const m of monsters) {
  const lower = m.name.toLowerCase();
  if (!allCsvMonsterNames.has(lower) && !allCsvVillainNames.has(lower)) {
    // Check shortened name
    const short = lower.replace(/^.*, /, '');
    if (!allCsvVillainNames.has(short) && !m.isBoss) {
      console.log(`  ${m.name} (${m.id}) — HP:${m.hp} AC:${m.ac} ATK:${m.attackBonus} DMG:${m.damage} XP:${m.experienceValue}`);
    }
  }
}

// ---- STEP 4: Write updated monsters.json ----
fs.writeFileSync(monstersPath, JSON.stringify(monsters, null, 2), 'utf8');
console.log(`\n[DONE] Updated monsters.json with ${monsters.length} total entries`);
