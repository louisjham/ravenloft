const fs = require('fs');
let code = fs.readFileSync('C:/antigravity/ravenloft/src/game/engine/PowerSystem.ts', 'utf8');

const regex = /const resolved = (await CombatAdapter\.resolveAttackAsync|CombatSystem\.resolveAttack)\(([^,]+),([^;]+);/g;

code = code.replace(regex, (match, fn, heroVar, rest) => {
    if (rest.includes('applyAttackResultEffects')) return match;
    
    heroVar = heroVar.trim();
    if (heroVar === 'hero' || heroVar === 'currentHero') {
        return `const resolved = ${fn}(${heroVar}, ${rest};
            ${heroVar} = CombatSystem.applyAttackResultEffects(${heroVar}, resolved);
            newState = this.updateEntityInState(newState, ${heroVar});`;
    }
    return match;
});

fs.writeFileSync('C:/antigravity/ravenloft/src/game/engine/PowerSystem.ts', code);
console.log('PowerSystem updated successfully');
