const fs = require('fs');
const code = fs.readFileSync('src/store/gameStore.ts', 'utf8');

const implStart = code.indexOf('subscribeWithSelector((set, get, api) => ({');
const implCode = code.substring(implStart === -1 ? code.indexOf('subscribeWithSelector((set, get) => ({') : implStart);

function extractMethod(name) {
  const searchStr = name + ':';
  const startIdx = implCode.indexOf(searchStr);
  if (startIdx === -1) return null;
  
  // Find the '=>'
  const arrowIdx = implCode.indexOf('=>', startIdx);
  if (arrowIdx === -1) return null;
  
  // Now we need to parse the body of the arrow function
  // We keep track of (), {}, [] and only stop at a comma when all are balanced
  let parenCount = 0;
  let braceCount = 0;
  let bracketCount = 0;
  
  let i = arrowIdx + 2; // skip '=>'
  let inString = false;
  let stringChar = '';
  
  while (i < implCode.length) {
    const char = implCode[i];
    
    if (!inString && (char === '"' || char === "'" || char === '`')) {
      inString = true;
      stringChar = char;
    } else if (inString && char === stringChar && implCode[i-1] !== '\\') {
      inString = false;
    } else if (!inString) {
      if (char === '(') parenCount++;
      else if (char === ')') parenCount--;
      else if (char === '{') braceCount++;
      else if (char === '}') braceCount--;
      else if (char === '[') bracketCount++;
      else if (char === ']') bracketCount--;
      else if (char === ',' && parenCount === 0 && braceCount === 0 && bracketCount === 0) {
        // We found the separating comma at the root level of the object literal!
        return implCode.substring(startIdx, i + 1);
      }
    }
    i++;
  }
  
  return null;
}

const methods = [
  'moveHero', 'attackMonster',
  'playCard', 'drawEncounterCard', 'cancelEncounterCard', 'drawTreasureCard', 'useTreasureCard', 'assignItem', 'advanceCardResolution', 'selectResolutionTarget', 'dismissCardResolution',
  'usePower', 'resetPower', 'getAvailablePowers', 'selectPower', 'deselectPower', 'confirmHeroSelection', 'autoSelectPowers', 'beginAdventure',
  'applyCondition', 'removeCondition', 'decrementConditions',
  'initializeTokensForScenario', 'searchToken', 'getTokensOnTile', 'canSearchTokens', 'disableTrap',
  
  'setGameState', 'startNewGame', 'loadGame', 'saveGame', 'selectEntity', 'selectCard', 'hoverTile', 'endTurn', 'levelUpHero', 'initializeDummyState', 'pauseGame', 'unpauseGame', 'updateSettings'
];

const extracted = {};
for (const m of methods) {
  extracted[m] = extractMethod(m);
  if (!extracted[m]) console.log('Could not extract ' + m);
}

// Replace relative paths for types in slices
for (const k in extracted) {
  if (extracted[k]) {
    extracted[k] = extracted[k].replace(/import\('\.\.\/game\/types'\)/g, "import('../../game/types')");
  }
}

fs.writeFileSync('extracted.json', JSON.stringify(extracted, null, 2));
console.log('Done extraction!');
