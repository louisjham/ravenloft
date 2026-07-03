import { Card, EncounterType, Entity, GameState, Hero, Monster, Tile, Trap, Direction, Rotation, GameLogEntry } from '../types';
import { DataLoader } from '../dataLoader';
import { CombatSystem } from './CombatSystem';
import { ConditionSystem } from './ConditionSystem';
import { TreasureSystem } from './TreasureSystem';
import { TileSystem } from './TileSystem';
import { AbilitySystem } from '../ai/AbilitySystem';
import { getPathToward, activateMonsterEntity, getTileGraphDistance } from './MonsterAI';



export class EncounterSystem {
    public static drawEncounterCard(gameState: GameState): { card: Card | null; message: string; newState: GameState } {
        if (gameState.encounterDeck.length === 0) {
            return { card: null, message: 'Encounter deck is empty', newState: gameState };
        }

        const deck = [...gameState.encounterDeck];
        const cardId = deck.shift();
        if (!cardId) {
            return { card: null, message: 'Failed to draw encounter card', newState: gameState };
        }

        const card = DataLoader.getInstance().getCardById(cardId);
        if (!card) {
            return { card: null, message: `Encounter card not found: ${cardId}`, newState: { ...gameState, encounterDeck: deck } };
        }

        return { card, message: `Drew encounter card: ${card.name}`, newState: { ...gameState, encounterDeck: deck } };
    }

    /**
     * Draws and resolves an Encounter Card synchronously.
     */
    public static drawAndResolve(gameState: GameState): GameState {
        const drawResult = this.drawEncounterCard(gameState);
        if (!drawResult.card) {
            return drawResult.newState;
        }

        const card = drawResult.card;
        let resultState = drawResult.newState;
        const activeHero = resultState.heroes.find(h => h.id === resultState.currentHeroId) || resultState.heroes[0];

        if (!activeHero) {
            return resultState;
        }

        if (card.encounterType === 'environment') {
            const res = this.processEnvironmentCard(resultState, card);
            return res.gameState;
        } else if (card.encounterType === 'event') {
            const res = this.processEventCard(resultState, card, activeHero);
            return res.gameState;
        } else if (card.encounterType === 'event-attack') {
            const res = this.processEventAttackCard(resultState, card, activeHero);
            return res.gameState;
        } else if (card.encounterType === 'trap') {
            const res = this.placeTrap(resultState, card, activeHero);
            return res.gameState;
        }

        return resultState;
    }

    public static processEnvironmentCard(
        gameState: GameState,
        card: Card
    ): { success: boolean; message: string; gameState: GameState } {
        const result = this.processEnvironmentCardInternal(gameState, card);
        return {
            ...result,
            gameState: ConditionSystem.syncActiveConditions(result.gameState)
        };
    }

    private static processEnvironmentCardInternal(
        gameState: GameState,
        card: Card
    ): { success: boolean; message: string; gameState: GameState } {
        let updatedHeroes = [...gameState.heroes];
        let updatedMonsters = [...gameState.monsters];
        let updatedDiscardPiles = { ...gameState.discardPiles };

        let updatedMonsterDeck = gameState.monsterDeck;
        for (const effect of card.effects) {
            const result = this.applyEffect(effect, updatedHeroes, gameState.heroes.find(h => h.id === gameState.currentHeroId) || updatedHeroes[0], null, { ...gameState, heroes: updatedHeroes, monsters: updatedMonsters, discardPiles: updatedDiscardPiles, monsterDeck: updatedMonsterDeck });
            updatedHeroes = result.heroes ?? updatedHeroes;
            updatedMonsters = result.monsters ?? updatedMonsters;
            updatedDiscardPiles = result.discardPiles ?? updatedDiscardPiles;
            updatedMonsterDeck = result.monsterDeck ?? updatedMonsterDeck;
        }

        return {
            success: true,
            message: `Environment card ${card.name} is now active. Effects apply to all heroes.`,
            gameState: {
                ...gameState,
                activeEnvironmentCard: card.id,
                heroes: updatedHeroes,
                monsters: updatedMonsters,
                discardPiles: updatedDiscardPiles,
                monsterDeck: updatedMonsterDeck
            }
        };
    }

    public static processEventCard(
        gameState: GameState,
        card: Card,
        activeHero: Hero
    ): { success: boolean; message: string; gameState: GameState } {
        const result = this.processEventCardInternal(gameState, card, activeHero);
        return {
            ...result,
            gameState: ConditionSystem.syncActiveConditions(result.gameState)
        };
    }

    private static processEventCardInternal(
        gameState: GameState,
        card: Card,
        activeHero: Hero
    ): { success: boolean; message: string; gameState: GameState } {
        const manhattanDistance = (p1: { x: number; z: number }, p2: { x: number; z: number }) =>
            Math.abs(p1.x - p2.x) + Math.abs(p1.z - p2.z);
        const roll = () => AbilitySystem._rollOverride ? AbilitySystem._rollOverride() : Math.floor(Math.random() * 20) + 1;
        const discard = (state: GameState) => ({
            ...state,
            discardPiles: { ...state.discardPiles, encounter: [...(state.discardPiles['encounter'] ?? []), card.id] }
        });

        // -----------------------------------------------------------------------
        // Passage of Time — each Hero takes 1 damage
        // -----------------------------------------------------------------------
        if (card.id === 'enc_passage_of_time') {
            const updatedHeroes = gameState.heroes.map(h => CombatSystem.applyDamage(h, 1) as Hero);
            return { success: true, message: 'Passage of Time: Each hero takes 1 damage.', gameState: discard({ ...gameState, heroes: updatedHeroes }) };
        }

        // -----------------------------------------------------------------------
        // Bubbling Cauldron — move each Monster 1 tile closer to active hero
        // -----------------------------------------------------------------------
        if (card.id === 'enc_bubbling_cauldron') {
            const activeMonsters = gameState.monsters.filter(m => m.hp > 0 && !m.isDefeated);
            const updatedMonsters = gameState.monsters.map(m => {
                if (m.hp <= 0 || m.isDefeated) return m;
                const dist = manhattanDistance(m.position, activeHero.position);
                if (dist <= 1) return m; // already adjacent, no movement
                // Move 1 tile step toward hero using the axis with largest delta
                const dx = activeHero.position.x - m.position.x;
                const dz = activeHero.position.z - m.position.z;
                let nx = m.position.x;
                let nz = m.position.z;
                if (Math.abs(dx) >= Math.abs(dz)) {
                    nx += Math.sign(dx);
                } else {
                    nz += Math.sign(dz);
                }
                // Only move if target tile exists
                const targetTile = gameState.tiles.find(t => t.x === nx && t.z === nz);
                if (!targetTile) return m;
                return { ...m, position: { ...m.position, x: nx, z: nz } };
            });
            const msg = `Bubbling Cauldron: ${activeMonsters.length} monster(s) moved 1 tile closer to ${activeHero.name}.`;
            return { success: true, message: msg, gameState: discard({ ...gameState, monsters: updatedMonsters }) };
        }

        // -----------------------------------------------------------------------
        // Ghost of Prince Aurel — flip one used Daily/Utility; else take 1 damage
        // -----------------------------------------------------------------------
        if (card.id === 'enc_ghost_prince_of_aurel') {
            const hero = gameState.heroes.find(h => h.id === activeHero.id)!;
            const flipped = hero.flippedPowerIds ?? [];
            // Get all owned powers
            const ownedPowers = [...new Set([...(hero.abilities ?? []), ...(hero.selectedPowerIds ?? [])])];
            // Filter Daily/Utility powers that are NOT currently flipped
            const unusedDailyOrUtility = ownedPowers.filter(powerId => {
                const p = DataLoader.getInstance().getCardById(powerId);
                const isDailyOrUtility = p && (p.powerType === 'daily' || p.powerType === 'utility');
                return isDailyOrUtility && !flipped.includes(powerId);
            });
            if (unusedDailyOrUtility.length > 0) {
                const flipCandidate = unusedDailyOrUtility[0];
                const updatedHero = { ...hero, flippedPowerIds: [...flipped, flipCandidate] };
                const updatedHeroes = gameState.heroes.map(h => h.id === hero.id ? updatedHero : h);
                return { success: true, message: `Ghost of Prince Aurel: ${hero.name} flipped unused power ${flipCandidate} face-down.`, gameState: discard({ ...gameState, heroes: updatedHeroes }) };
            } else {
                const updatedHero = CombatSystem.applyDamage(hero, 1) as Hero;
                const updatedHeroes = gameState.heroes.map(h => h.id === hero.id ? updatedHero : h);
                return { success: true, message: `Ghost of Prince Aurel: ${hero.name} had no unused Daily or Utility power to flip and takes 1 damage.`, gameState: discard({ ...gameState, heroes: updatedHeroes }) };
            }
        }

        // -----------------------------------------------------------------------
        // Illusionary Trick — active Hero swaps with farthest Monster
        // -----------------------------------------------------------------------
        if (card.id === 'enc_illusionary_trick') {
            const activeMonsters = gameState.monsters.filter(m => m.hp > 0 && !m.isDefeated);
            if (activeMonsters.length === 0) {
                return { success: true, message: 'Illusionary Trick: No monsters to swap with.', gameState: discard(gameState) };
            }
            const heroTile = gameState.tiles.find(t => t.x === activeHero.position.x && t.z === activeHero.position.z);
            if (!heroTile) {
                return { success: true, message: 'Illusionary Trick: Active hero not on a valid tile.', gameState: discard(gameState) };
            }
            let farthestMonster = activeMonsters[0];
            let maxDist = -1;
            for (const m of activeMonsters) {
                const mTile = gameState.tiles.find(t => t.x === m.position.x && t.z === m.position.z);
                if (!mTile) continue;
                const d = getTileGraphDistance(heroTile, mTile, gameState.tiles);
                if (d === 999) continue; // Unreachable
                if (d > maxDist) {
                    maxDist = d;
                    farthestMonster = m;
                } else if (d === maxDist && farthestMonster) {
                    // Tiebreaker: highest x, then z coordinate
                    if (m.position.x > farthestMonster.position.x) {
                        farthestMonster = m;
                    } else if (m.position.x === farthestMonster.position.x && m.position.z > farthestMonster.position.z) {
                        farthestMonster = m;
                    }
                }
            }
            if (maxDist === -1) {
                return { success: true, message: 'Illusionary Trick: Farthest monster is unreachable.', gameState: discard(gameState) };
            }
            const heroOldPos = { ...activeHero.position };
            const monsterOldPos = { ...farthestMonster.position };
            const updatedHeroes = gameState.heroes.map(h =>
                h.id === activeHero.id ? { ...h, position: { ...h.position, x: monsterOldPos.x, z: monsterOldPos.z, sqX: farthestMonster.position.sqX, sqZ: farthestMonster.position.sqZ } } : h
            );
            const updatedMonsters = gameState.monsters.map(m =>
                m.id === farthestMonster.id ? { ...m, position: { ...m.position, x: heroOldPos.x, z: heroOldPos.z, sqX: activeHero.position.sqX, sqZ: activeHero.position.sqZ } } : m
            );
            // Update tile arrays
            const updatedTiles = gameState.tiles.map(t => {
                let heroes = [...t.heroes];
                let monsters = [...t.monsters];
                if (t.x === heroOldPos.x && t.z === heroOldPos.z) {
                    heroes = heroes.filter(id => id !== activeHero.id);
                    monsters = [...new Set([...monsters, farthestMonster.id])];
                }
                if (t.x === monsterOldPos.x && t.z === monsterOldPos.z) {
                    monsters = monsters.filter(id => id !== farthestMonster.id);
                    heroes = [...new Set([...heroes, activeHero.id])];
                }
                return { ...t, heroes, monsters };
            });
            return { success: true, message: `Illusionary Trick: ${activeHero.name} swapped positions with ${farthestMonster.name}.`, gameState: discard({ ...gameState, heroes: updatedHeroes, monsters: updatedMonsters, tiles: updatedTiles }) };
        }

        // -----------------------------------------------------------------------
        // Lief Lipsiege — roll: 1-10 spawn monster; 11-20 draw treasure
        // -----------------------------------------------------------------------
        if (card.id === 'enc_lief_lipsiege') {
            const r = roll();
            if (r <= 10) {
                const targetTile = gameState.tiles.find(t => t.x === activeHero.position.x && t.z === activeHero.position.z);
                if (targetTile) {
                    const spawnResult = this.spawnMonsterOnTile(gameState, targetTile);
                    const updatedMonsters = spawnResult.monster ? [...gameState.monsters, spawnResult.monster] : gameState.monsters;
                    return { success: true, message: `Lief Lipsiege (Roll: ${r}): ${activeHero.name} scared Lief! A new monster appears.`, gameState: discard({ ...gameState, monsters: updatedMonsters, monsterDeck: spawnResult.monsterDeck }) };
                }
            } else {
                const drawResult = TreasureSystem.drawTreasureCard(gameState, activeHero);
                let newState = drawResult.newState;
                if (drawResult.card) {
                    if (drawResult.card.treasureType === 'item') {
                        const r2 = TreasureSystem.assignItem(newState, drawResult.card, activeHero);
                        newState = r2.newState;
                    } else if (drawResult.card.treasureType === 'blessing') {
                        const r2 = TreasureSystem.useBlessing(newState, drawResult.card, activeHero);
                        newState = r2.newState;
                    } else if (drawResult.card.treasureType === 'fortune') {
                        const r2 = TreasureSystem.useFortune(newState, drawResult.card, activeHero);
                        newState = r2.newState;
                    }
                }
                return { success: true, message: `Lief Lipsiege (Roll: ${r}): ${activeHero.name} distracted Lief and draws a Treasure Card!`, gameState: discard(newState) };
            }
            return { success: true, message: `Lief Lipsiege resolved.`, gameState: discard(gameState) };
        }

        // -----------------------------------------------------------------------
        // Mists of Terror — for each Hero, roll; 1-5 → 1 damage + Immobilized
        // -----------------------------------------------------------------------
        if (card.id === 'enc_mists_of_terror') {
            let updatedHeroes = [...gameState.heroes];
            const msgs: string[] = [];
            for (const hero of updatedHeroes) {
                const r = roll();
                if (r <= 5) {
                    const damaged = CombatSystem.applyDamage(hero, 1) as Hero;
                    const conditioned = ConditionSystem.applyCondition(damaged, 'immobilized', 'enc_mists_of_terror', 1);
                    updatedHeroes = updatedHeroes.map(h => h.id === hero.id ? conditioned as Hero : h);
                    msgs.push(`${hero.name} (roll ${r}): 1 damage + Immobilized`);
                } else {
                    msgs.push(`${hero.name} (roll ${r}): unaffected`);
                }
            }
            return { success: true, message: `Mists of Terror: ${msgs.join('; ')}.`, gameState: discard({ ...gameState, heroes: updatedHeroes }) };
        }

        // -----------------------------------------------------------------------
        // Neglected Passage — requires Start tile; draw bottom tile near Start, spawn monster
        // -----------------------------------------------------------------------
        if (card.id === 'enc_neglected_passage') {
            const startTile = gameState.tiles.find(t => t.isStart);
            if (!startTile) {
                return { success: true, message: 'Neglected Passage: No Start tile in play. Card discarded.', gameState: discard(gameState) };
            }
            const points = TileSystem.getExplorationPoints(gameState.tiles);
            if (points.length === 0) {
                return { success: true, message: 'Neglected Passage: No unexplored edges. Card discarded.', gameState: discard(gameState) };
            }
            let closestPoint = points[0];
            let minDist = Infinity;
            for (const pt of points) {
                const ptTile = gameState.tiles.find(t => t.id === pt.tileId)!;
                const d = manhattanDistance({ x: ptTile.x, z: ptTile.z }, { x: startTile.x, z: startTile.z });
                if (d < minDist) { minDist = d; closestPoint = pt; }
            }
            const drawResult = TileSystem.drawAndPlaceFromBottom(gameState, closestPoint);
            if (!drawResult.tile) {
                return { success: true, message: 'Neglected Passage: Could not place tile. Card discarded.', gameState: discard(gameState) };
            }
            const parentTile = gameState.tiles.find(t => t.id === closestPoint.tileId)!;
            const targetCoords = TileSystem.getTargetCoords(parentTile.x, parentTile.z, closestPoint.edge);
            const newTileInstance: Tile = {
                ...drawResult.tile,
                id: `${drawResult.tile.id}_${Math.random().toString(36).substr(2, 5)}`,
                x: targetCoords.x, z: targetCoords.z,
                rotation: drawResult.validRotations[0],
                connections: TileSystem.rotateConnections(drawResult.tile.connections.map(c => ({ ...c })), drawResult.validRotations[0]),
                isRevealed: true, monsters: [], heroes: [], items: []
            };
            let updatedTiles = TileSystem.connectTiles(gameState.tiles, parentTile, newTileInstance, closestPoint.edge);
            const spawnResult = this.spawnMonsterOnTile({ ...gameState, tiles: updatedTiles, dungeonDeck: drawResult.remainingDeck }, newTileInstance);
            let updatedMonsters = gameState.monsters;
            if (spawnResult.monster) {
                updatedMonsters = [...gameState.monsters, spawnResult.monster];
                updatedTiles = updatedTiles.map(t => {
                    if (t.id === newTileInstance.id) {
                        return { ...t, monsters: [...t.monsters, spawnResult.monster!.id] };
                    }
                    return t;
                });
            }
            return { success: true, message: 'Neglected Passage: A forgotten passage opens. A new monster lurks within.', gameState: discard({ ...gameState, tiles: updatedTiles, dungeonDeck: drawResult.remainingDeck, monsters: updatedMonsters, monsterDeck: spawnResult.monsterDeck }) };
        }

        // -----------------------------------------------------------------------
        // Overrun — each Hero takes damage = # of Monsters they control
        // -----------------------------------------------------------------------
        if (card.id === 'enc_overrun') {
            let updatedHeroes = [...gameState.heroes];
            const msgs: string[] = [];
            for (const hero of updatedHeroes) {
                const controlledCount = gameState.monsters.filter(m => m.ownedByHeroId === hero.id && !m.isDefeated && m.hp > 0).length;
                if (controlledCount > 0) {
                    const damaged = CombatSystem.applyDamage(hero, controlledCount) as Hero;
                    updatedHeroes = updatedHeroes.map(h => h.id === hero.id ? damaged : h);
                    msgs.push(`${hero.name} takes ${controlledCount} damage`);
                } else {
                    msgs.push(`${hero.name} takes 0 damage (controls no monsters)`);
                }
            }
            return { success: true, message: `Overrun: ${msgs.join('; ')}.`, gameState: discard({ ...gameState, heroes: updatedHeroes }) };
        }

        // -----------------------------------------------------------------------
        // Overwhelming Terror — requires Start tile; move each Hero 2 tiles toward Start; Slowed if lands on monster tile
        // -----------------------------------------------------------------------
        if (card.id === 'enc_overwhelming_terror') {
            const startTile = gameState.tiles.find(t => t.isStart);
            if (!startTile) {
                return { success: true, message: 'Overwhelming Terror: No Start tile in play. Card discarded.', gameState: discard(gameState) };
            }
            let updatedHeroes = [...gameState.heroes];
            let updatedTiles = [...gameState.tiles];
            const msgs: string[] = [];
            for (const hero of updatedHeroes) {
                const heroTile = gameState.tiles.find(t => t.x === hero.position.x && t.z === hero.position.z);
                if (!heroTile) {
                    msgs.push(`${hero.name} is not on a valid tile`);
                    continue;
                }
                
                let destTile = heroTile;
                if (heroTile.id !== startTile.id) {
                    const path = getPathToward(heroTile, startTile, gameState.tiles, 2);
                    if (path.length > 0) {
                        destTile = path[path.length - 1];
                    }
                }
                
                // Update hero position and tile arrays
                updatedTiles = updatedTiles.map(t => {
                    let heroes = [...t.heroes];
                    if (t.id === heroTile.id) heroes = heroes.filter(id => id !== hero.id);
                    if (t.id === destTile.id) heroes = [...new Set([...heroes, hero.id])];
                    return { ...t, heroes };
                });
                
                let updatedHero: Hero = {
                    ...hero,
                    position: {
                        ...hero.position,
                        x: destTile.x,
                        z: destTile.z,
                        sqX: destTile.id !== heroTile.id ? 2 : hero.position.sqX,
                        sqZ: destTile.id !== heroTile.id ? 2 : hero.position.sqZ
                    }
                };
                const monstersAtDest = gameState.monsters.filter(m => !m.isDefeated && m.hp > 0 && m.position.x === destTile.x && m.position.z === destTile.z);
                if (monstersAtDest.length > 0) {
                    updatedHero = ConditionSystem.applyCondition(updatedHero, 'slowed', 'enc_overwhelming_terror', 1) as Hero;
                    msgs.push(`${hero.name} moved to (${destTile.x},${destTile.z}) and is Slowed`);
                } else {
                    msgs.push(`${hero.name} moved to (${destTile.x},${destTile.z})`);
                }
                updatedHeroes = updatedHeroes.map(h => h.id === hero.id ? updatedHero : h);
            }
            return { success: true, message: `Overwhelming Terror: ${msgs.join('; ')}.`, gameState: discard({ ...gameState, heroes: updatedHeroes, tiles: updatedTiles }) };
        }

        // -----------------------------------------------------------------------
        // Prowling Spirits — active Hero discards one Treasure Card
        // -----------------------------------------------------------------------
        if (card.id === 'enc_prowling_spirits') {
            const hero = gameState.heroes.find(h => h.id === activeHero.id)!;
            if (hero.items.length === 0) {
                return { success: true, message: `Prowling Spirits: ${hero.name} has no treasure cards to discard.`, gameState: discard(gameState) };
            }
            // Auto-discard the last item in the inventory
            const discardedItem = hero.items[hero.items.length - 1];
            const updatedHero = { ...hero, items: hero.items.slice(0, -1) };
            const updatedHeroes = gameState.heroes.map(h => h.id === hero.id ? updatedHero : h);
            let updatedDiscardPiles = { ...gameState.discardPiles };
            updatedDiscardPiles['treasure'] = [...(updatedDiscardPiles['treasure'] ?? []), discardedItem];
            // Spirit of Doom environment: hero takes 1 damage when discarding treasure
            let finalHeroes = updatedHeroes;
            if (gameState.activeEnvironmentCard === 'enc_spirit_of_doom_env') {
                finalHeroes = finalHeroes.map(h =>
                    h.id === hero.id ? CombatSystem.applyDamage(h, 1) as Hero : h
                );
            }
            return { success: true, message: `Prowling Spirits: ${hero.name} discards ${discardedItem}.`, gameState: discard({ ...gameState, heroes: finalHeroes, discardPiles: updatedDiscardPiles }) };
        }

        // -----------------------------------------------------------------------
        // Reinforcements — hero controlling fewest monsters spawns on tile with unexplored edge
        // -----------------------------------------------------------------------
        if (card.id === 'enc_reinforcements') {
            let fewestHero = gameState.heroes[0];
            let fewestCount = Infinity;
            for (const h of gameState.heroes) {
                const count = gameState.monsters.filter(m => m.ownedByHeroId === h.id && !m.isDefeated && m.hp > 0).length;
                if (count < fewestCount) { fewestCount = count; fewestHero = h; }
            }
            const points = TileSystem.getExplorationPoints(gameState.tiles);
            if (points.length === 0) {
                return { success: true, message: 'Reinforcements: No tiles with unexplored edges. Card discarded.', gameState: discard(gameState) };
            }
            const targetPoint = points[0];
            const targetTile = gameState.tiles.find(t => t.id === targetPoint.tileId);
            if (!targetTile) {
                return { success: true, message: 'Reinforcements: Could not find tile. Card discarded.', gameState: discard(gameState) };
            }
            const spawnResult = this.spawnMonsterOnTile(gameState, targetTile);
            const updatedMonsters = spawnResult.monster
                ? [...gameState.monsters, { ...spawnResult.monster, ownedByHeroId: fewestHero.id }]
                : gameState.monsters;
            return { success: true, message: `Reinforcements: ${fewestHero.name} (fewest monsters) places a new monster on tile (${targetTile.x},${targetTile.z}).`, gameState: discard({ ...gameState, monsters: updatedMonsters, monsterDeck: spawnResult.monsterDeck }) };
        }

        // -----------------------------------------------------------------------
        // Secret Door — draw bottom tile near active hero, spawn monster, no new encounter
        // -----------------------------------------------------------------------
        if (card.id === 'enc_secret_door') {
            const points = TileSystem.getExplorationPoints(gameState.tiles);
            if (points.length === 0) {
                return { success: true, message: 'Secret Door: No unexplored edges. Card discarded.', gameState: discard(gameState) };
            }
            let closestPoint = points[0];
            let minDist = Infinity;
            for (const pt of points) {
                const ptTile = gameState.tiles.find(t => t.id === pt.tileId)!;
                const d = manhattanDistance({ x: ptTile.x, z: ptTile.z }, activeHero.position);
                if (d < minDist) { minDist = d; closestPoint = pt; }
            }
            const drawResult = TileSystem.drawAndPlaceFromBottom(gameState, closestPoint);
            if (!drawResult.tile) {
                return { success: true, message: 'Secret Door: Could not place tile. Card discarded.', gameState: discard(gameState) };
            }
            const parentTile = gameState.tiles.find(t => t.id === closestPoint.tileId)!;
            const targetCoords = TileSystem.getTargetCoords(parentTile.x, parentTile.z, closestPoint.edge);
            const newTileInstance: Tile = {
                ...drawResult.tile,
                id: `${drawResult.tile.id}_${Math.random().toString(36).substr(2, 5)}`,
                x: targetCoords.x, z: targetCoords.z,
                rotation: drawResult.validRotations[0],
                connections: TileSystem.rotateConnections(drawResult.tile.connections.map(c => ({ ...c })), drawResult.validRotations[0]),
                isRevealed: true, monsters: [], heroes: [], items: []
            };
            let updatedTiles = TileSystem.connectTiles(gameState.tiles, parentTile, newTileInstance, closestPoint.edge);
            const spawnResult = this.spawnMonsterOnTile({ ...gameState, tiles: updatedTiles, dungeonDeck: drawResult.remainingDeck }, newTileInstance);
            let updatedMonsters = gameState.monsters;
            if (spawnResult.monster) {
                updatedMonsters = [...gameState.monsters, { ...spawnResult.monster, ownedByHeroId: activeHero.id }];
                updatedTiles = updatedTiles.map(t => {
                    if (t.id === newTileInstance.id) {
                        return { ...t, monsters: [...t.monsters, spawnResult.monster!.id] };
                    }
                    return t;
                });
            }
            return { success: true, message: `Secret Door: A hidden passage revealed at (${newTileInstance.x},${newTileInstance.z}). A monster emerges!`, gameState: discard({ ...gameState, tiles: updatedTiles, dungeonDeck: drawResult.remainingDeck, monsters: updatedMonsters, monsterDeck: spawnResult.monsterDeck }) };
        }

        // -----------------------------------------------------------------------
        // Cyrus Belview — draw bottom tile adjacent to first unexplored edge, place 2 monsters, place all heroes there
        // -----------------------------------------------------------------------
        if (card.id === 'enc_cyrus_belview') {
            const points = TileSystem.getExplorationPoints(gameState.tiles);
            if (points.length === 0) {
                return { success: true, message: 'Cyrus Belview: No unexplored edges. Card discarded.', gameState: discard(gameState) };
            }
            const targetPoint = points[0];
            const drawResult = TileSystem.drawAndPlaceFromBottom(gameState, targetPoint);
            if (!drawResult.tile) {
                return { success: true, message: 'Cyrus Belview: Could not place tile. Card discarded.', gameState: discard(gameState) };
            }
            const parentTile = gameState.tiles.find(t => t.id === targetPoint.tileId)!;
            const targetCoords = TileSystem.getTargetCoords(parentTile.x, parentTile.z, targetPoint.edge);
            const newTileInstance: Tile = {
                ...drawResult.tile,
                id: `${drawResult.tile.id}_${Math.random().toString(36).substr(2, 5)}`,
                x: targetCoords.x, z: targetCoords.z,
                rotation: drawResult.validRotations[0],
                connections: TileSystem.rotateConnections(drawResult.tile.connections.map(c => ({ ...c })), drawResult.validRotations[0]),
                isRevealed: true, monsters: [], heroes: [], items: []
            };
            let updatedTiles = TileSystem.connectTiles(gameState.tiles, parentTile, newTileInstance, targetPoint.edge);
            
            let updatedMonsters = [...gameState.monsters];
            let monsterDeck = gameState.monsterDeck;
            
            // Spawn monster 1
            const spawn1 = this.spawnMonsterOnTile({ ...gameState, tiles: updatedTiles, monsters: updatedMonsters, monsterDeck }, newTileInstance);
            if (spawn1.monster) {
                updatedMonsters = [...updatedMonsters, { ...spawn1.monster, ownedByHeroId: activeHero.id }];
                monsterDeck = spawn1.monsterDeck;
                newTileInstance.monsters.push(spawn1.monster.id);
            }
            // Spawn monster 2
            const spawn2 = this.spawnMonsterOnTile({ ...gameState, tiles: updatedTiles, monsters: updatedMonsters, monsterDeck }, newTileInstance);
            if (spawn2.monster) {
                updatedMonsters = [...updatedMonsters, { ...spawn2.monster, ownedByHeroId: activeHero.id }];
                monsterDeck = spawn2.monsterDeck;
                newTileInstance.monsters.push(spawn2.monster.id);
            }

            // Relocate all heroes to new tile
            const oldPositionsMap = new Map<string, { x: number; z: number }>();
            for (const h of gameState.heroes) {
                oldPositionsMap.set(h.id, { x: h.position.x, z: h.position.z });
            }
            const updatedHeroes = gameState.heroes.map(h => ({
                ...h,
                position: { ...h.position, x: newTileInstance.x, z: newTileInstance.z, sqX: 2, sqZ: 2 }
            }));
            newTileInstance.heroes = updatedHeroes.map(h => h.id);

            // Update all tiles to remove heroes from their old locations and set new tile
            updatedTiles = updatedTiles.map(t => {
                if (t.id === newTileInstance.id) {
                    return newTileInstance;
                }
                let heroes = [...t.heroes];
                for (const hId of heroes) {
                    const oldPos = oldPositionsMap.get(hId);
                    if (oldPos && oldPos.x === t.x && oldPos.z === t.z) {
                        heroes = heroes.filter(id => id !== hId);
                    }
                }
                return { ...t, heroes };
            });

            return { success: true, message: `Cyrus Belview: A new passage is opened. Two monsters spawn and all heroes relocate to the new tile.`, gameState: discard({ ...gameState, tiles: updatedTiles, dungeonDeck: drawResult.remainingDeck, monsters: updatedMonsters, monsterDeck, heroes: updatedHeroes }) };
        }

        // -----------------------------------------------------------------------
        // Spirit of Doom (Event) — heroes move, heroes on empty tiles take 1 damage
        // -----------------------------------------------------------------------
        if (card.id === 'enc_spirit_of_doom_event') {
            let updatedHeroes = [...gameState.heroes];
            let updatedTiles = [...gameState.tiles];
            const msgs: string[] = [];
            const activeMonsters = gameState.monsters.filter(m => !m.isDefeated && m.hp > 0);

            for (const hero of updatedHeroes) {
                const currentPos = { x: hero.position.x, z: hero.position.z };
                let destination = currentPos;

                if (activeMonsters.length > 0) {
                    // Find closest tile with a monster
                    let closestMonsterTile = gameState.tiles.find(t => t.x === activeMonsters[0].position.x && t.z === activeMonsters[0].position.z)!;
                    let minDist = manhattanDistance(currentPos, { x: closestMonsterTile.x, z: closestMonsterTile.z });
                    
                    for (const m of activeMonsters) {
                        const t = gameState.tiles.find(tile => tile.x === m.position.x && tile.z === m.position.z);
                        if (t) {
                            const d = manhattanDistance(currentPos, { x: t.x, z: t.z });
                            if (d < minDist) {
                                minDist = d;
                                closestMonsterTile = t;
                            }
                        }
                    }

                    // Can we reach this or any monster tile within speed?
                    const reachableMonsterTiles = gameState.tiles.filter(t => {
                        const hasMonster = activeMonsters.some(m => m.position.x === t.x && m.position.z === t.z);
                        return hasMonster && manhattanDistance(currentPos, { x: t.x, z: t.z }) <= hero.speed;
                    });

                    if (reachableMonsterTiles.length > 0) {
                        // Choose closest reachable monster tile
                        let target = reachableMonsterTiles[0];
                        let targetDist = manhattanDistance(currentPos, { x: target.x, z: target.z });
                        for (const t of reachableMonsterTiles) {
                            const d = manhattanDistance(currentPos, { x: t.x, z: t.z });
                            if (d < targetDist) {
                                targetDist = d;
                                target = t;
                            }
                        }
                        destination = { x: target.x, z: target.z };
                    } else {
                        // Move up to speed steps towards closest monster tile
                        let tempPos = { ...currentPos };
                        for (let step = 0; step < hero.speed; step++) {
                            const dx = closestMonsterTile.x - tempPos.x;
                            const dz = closestMonsterTile.z - tempPos.z;
                            if (dx === 0 && dz === 0) break;
                            let nx = tempPos.x;
                            let nz = tempPos.z;
                            if (Math.abs(dx) >= Math.abs(dz)) {
                                nx += Math.sign(dx);
                            } else {
                                nz += Math.sign(dz);
                            }
                            const nextTile = gameState.tiles.find(t => t.x === nx && t.z === nz);
                            if (nextTile) tempPos = { x: nx, z: nz };
                        }
                        destination = tempPos;
                    }
                }

                // If hero moved, update tiles
                if (destination.x !== currentPos.x || destination.z !== currentPos.z) {
                    updatedTiles = updatedTiles.map(t => {
                        let heroes = [...t.heroes];
                        if (t.x === currentPos.x && t.z === currentPos.z) {
                            heroes = heroes.filter(id => id !== hero.id);
                        }
                        if (t.x === destination.x && t.z === destination.z) {
                            heroes = [...new Set([...heroes, hero.id])];
                        }
                        return { ...t, heroes };
                    });
                }

                let finalHero = { ...hero, position: { ...hero.position, x: destination.x, z: destination.z } };
                // Check if there are monsters at destination
                const monstersAtDest = activeMonsters.filter(m => m.position.x === destination.x && m.position.z === destination.z);
                if (monstersAtDest.length === 0) {
                    finalHero = CombatSystem.applyDamage(finalHero, 1) as Hero;
                    msgs.push(`${hero.name} takes 1 damage (no monsters on tile)`);
                } else {
                    msgs.push(`${hero.name} takes 0 damage`);
                }

                updatedHeroes = updatedHeroes.map(h => h.id === hero.id ? finalHero : h);
            }

            return {
                success: true,
                message: `Spirit of Doom: Heroes moved to avoid doom. ${msgs.join('; ')}`,
                gameState: discard({ ...gameState, heroes: updatedHeroes, tiles: updatedTiles })
            };
        }

        // -----------------------------------------------------------------------
        // Strahd's Hunger — hero with most HP: 1 damage + Immobilized
        // -----------------------------------------------------------------------
        if (card.id === 'enc_strahds_hunger') {
            let maxHpHero = gameState.heroes[0];
            for (const h of gameState.heroes) {
                if (h.hp > maxHpHero.hp) maxHpHero = h;
            }
            const damaged = CombatSystem.applyDamage(maxHpHero, 1) as Hero;
            const conditioned = ConditionSystem.applyCondition(damaged, 'immobilized', 'enc_strahds_hunger', 1) as Hero;
            const updatedHeroes = gameState.heroes.map(h => h.id === maxHpHero.id ? conditioned : h);
            return { success: true, message: `Strahd's Hunger: ${maxHpHero.name} (most HP) takes 1 damage and is Immobilized.`, gameState: discard({ ...gameState, heroes: updatedHeroes }) };
        }

        // -----------------------------------------------------------------------
        // Strahd's Minions — active hero + 2 closest monsters move to farthest tile; if <2 monsters spawn 1 adjacent
        // -----------------------------------------------------------------------
        if (card.id === 'enc_strahds_minions') {
            const startTile = gameState.tiles.find(t => t.isStart) || gameState.tiles[0];
            const farthestTile = TileSystem.getFarthestTile(startTile.id, gameState);
            if (!farthestTile) {
                return { success: true, message: "Strahd's Minions: No tiles available.", gameState: discard(gameState) };
            }
            const activeMonsters = gameState.monsters.filter(m => m.hp > 0 && !m.isDefeated);
            // Sort monsters by Manhattan distance to active hero (closest first)
            const sorted = [...activeMonsters].sort((a, b) => {
                const distA = Math.abs(a.position.x - activeHero.position.x) + Math.abs(a.position.z - activeHero.position.z);
                const distB = Math.abs(b.position.x - activeHero.position.x) + Math.abs(b.position.z - activeHero.position.z);
                return distA - distB;
            });
            const closest2 = sorted.slice(0, 2);
            const closest2Ids = closest2.map(m => m.id);

            // Save old positions to clear tile lists
            const oldHeroTile = gameState.tiles.find(t => t.x === activeHero.position.x && t.z === activeHero.position.z);
            const oldMonsterTilesMap = new Map<string, { x: number; z: number }>();
            for (const m of closest2) {
                oldMonsterTilesMap.set(m.id, { x: m.position.x, z: m.position.z });
            }

            // Move hero and 2 closest monsters to farthest tile
            let updatedHeroes = gameState.heroes.map(h =>
                h.id === activeHero.id ? { ...h, position: { ...h.position, x: farthestTile.x, z: farthestTile.z, sqX: 2, sqZ: 2 } } : h
            );
            let updatedMonsters = gameState.monsters.map(m => {
                if (closest2Ids.includes(m.id)) {
                    return { ...m, position: { ...m.position, x: farthestTile.x, z: farthestTile.z, sqX: 2, sqZ: 2 } };
                }
                return m;
            });
            let updatedTiles = gameState.tiles.map(t => {
                let heroes = t.heroes;
                if (oldHeroTile && t.id === oldHeroTile.id) heroes = heroes.filter(id => id !== activeHero.id);
                
                let monsters = t.monsters;
                for (const mId of closest2Ids) {
                    const oldPos = oldMonsterTilesMap.get(mId);
                    if (oldPos && oldPos.x === t.x && oldPos.z === t.z) {
                        monsters = monsters.filter(id => id !== mId);
                    }
                }

                if (t.id === farthestTile.id) {
                    heroes = [...new Set([...heroes, activeHero.id])];
                    monsters = [...new Set([...monsters, ...closest2Ids])];
                }
                return { ...t, heroes, monsters };
            });
            let monsterDeck = gameState.monsterDeck;
            let message = `Strahd's Minions: ${activeHero.name} and ${closest2.length} monster(s) moved to farthest tile (${farthestTile.x},${farthestTile.z}).`;
            // If fewer than 2 monsters, spawn 1 on the farthest tile
            if (activeMonsters.length < 2) {
                const spawnResult = this.spawnMonsterOnTile({ ...gameState, tiles: updatedTiles, monsters: updatedMonsters, monsterDeck }, farthestTile);
                if (spawnResult.monster) {
                    updatedMonsters = [...updatedMonsters, { ...spawnResult.monster, ownedByHeroId: activeHero.id }];
                    monsterDeck = spawnResult.monsterDeck;
                    updatedTiles = updatedTiles.map(t => {
                        if (t.id === farthestTile.id) {
                            return { ...t, monsters: [...new Set([...t.monsters, spawnResult.monster!.id])] };
                        }
                        return t;
                    });
                    message += ' Fewer than 2 monsters: spawned 1 on the farthest tile.';
                }
            }
            return { success: true, message, gameState: discard({ ...gameState, heroes: updatedHeroes, monsters: updatedMonsters, tiles: updatedTiles, monsterDeck }) };
        }

        // -----------------------------------------------------------------------
        // Strahd's Whispers — move active hero to closest other hero's tile; that hero attacks moved hero with an at-will
        // -----------------------------------------------------------------------
        if (card.id === 'enc_strahds_whispers') {
            const otherHeroes = gameState.heroes.filter(h => h.id !== activeHero.id && !h.removedFromPlay);
            if (otherHeroes.length === 0) {
                return { success: true, message: "Strahd's Whispers: No other heroes on board.", gameState: discard(gameState) };
            }
            // Sort other heroes by Manhattan distance from activeHero
            const sorted = [...otherHeroes].sort((a, b) => {
                const distA = Math.abs(a.position.x - activeHero.position.x) + Math.abs(a.position.z - activeHero.position.z);
                const distB = Math.abs(b.position.x - activeHero.position.x) + Math.abs(b.position.z - activeHero.position.z);
                return distA - distB;
            });
            const closestHero = sorted[0];

            const heroTile = gameState.tiles.find(t => t.x === activeHero.position.x && t.z === activeHero.position.z);
            const destTile = gameState.tiles.find(t => t.x === closestHero.position.x && t.z === closestHero.position.z)!;
            
            const updatedHeroes = gameState.heroes.map(h =>
                h.id === activeHero.id ? { ...h, position: { ...h.position, x: destTile.x, z: destTile.z, sqX: closestHero.position.sqX, sqZ: closestHero.position.sqZ } } : h
            );
            const updatedTiles = gameState.tiles.map(t => {
                let heroes = t.heroes;
                if (heroTile && t.id === heroTile.id) heroes = heroes.filter(id => id !== activeHero.id);
                if (t.id === destTile.id) heroes = [...new Set([...heroes, activeHero.id])];
                return { ...t, heroes };
            });

            // Find at-will powers of closestHero
            const ownedPowers = [...new Set([...(closestHero.abilities ?? []), ...(closestHero.selectedPowerIds ?? [])])];
            const atWillPowers = ownedPowers.filter(powerId => {
                const p = DataLoader.getInstance().getCardById(powerId);
                return p && p.powerType === 'at-will';
            });

            return {
                success: true,
                message: `Strahd's Whispers: ${activeHero.name} moved to ${closestHero.name}'s tile.`,
                gameState: {
                    ...gameState,
                    heroes: updatedHeroes,
                    tiles: updatedTiles,
                    pendingFortune: {
                        kind: 'atWillPowerPick',
                        attackerHeroId: closestHero.id,
                        targetHeroId: activeHero.id,
                        eligiblePowerIds: atWillPowers,
                        fortuneCardId: card.id
                    }
                }
            };
        }

        // -----------------------------------------------------------------------
        // Strahd's Trick — place hero on tile within 1 tile with most monsters; else damage 1
        // -----------------------------------------------------------------------
        if (card.id === 'enc_strahds_trick') {
            const adjacentTiles = gameState.tiles.filter(t =>
                t.isRevealed && manhattanDistance({ x: t.x, z: t.z }, activeHero.position) <= 1
                && (t.x !== activeHero.position.x || t.z !== activeHero.position.z)
            );
            let bestTile: Tile | null = null;
            let bestCount = 0;
            for (const t of adjacentTiles) {
                const count = gameState.monsters.filter(m => !m.isDefeated && m.hp > 0 && m.position.x === t.x && m.position.z === t.z).length;
                if (count > bestCount) { bestCount = count; bestTile = t; }
            }
            if (bestTile) {
                const updatedHeroes = gameState.heroes.map(h =>
                    h.id === activeHero.id ? { ...h, position: { ...h.position, x: bestTile!.x, z: bestTile!.z } } : h
                );
                const updatedTiles = gameState.tiles.map(t => {
                    let heroes = [...t.heroes];
                    if (t.x === activeHero.position.x && t.z === activeHero.position.z) heroes = heroes.filter(id => id !== activeHero.id);
                    if (t.x === bestTile!.x && t.z === bestTile!.z) heroes = [...new Set([...heroes, activeHero.id])];
                    return { ...t, heroes };
                });
                return { success: true, message: `Strahd's Trick: ${activeHero.name} placed on tile (${bestTile.x},${bestTile.z}) with ${bestCount} monsters.`, gameState: discard({ ...gameState, heroes: updatedHeroes, tiles: updatedTiles }) };
            } else {
                const updatedHero = CombatSystem.applyDamage(activeHero, 1) as Hero;
                const updatedHeroes = gameState.heroes.map(h => h.id === activeHero.id ? updatedHero : h);
                return { success: true, message: `Strahd's Trick: No adjacent tile has monsters. ${activeHero.name} takes 1 damage.`, gameState: discard({ ...gameState, heroes: updatedHeroes }) };
            }
        }

        // -----------------------------------------------------------------------
        // Teleport Glyph — active hero + monsters on tile → farthest tile
        // -----------------------------------------------------------------------
        if (card.id === 'enc_teleport_glyph') {
            const heroTile = gameState.tiles.find(t => t.x === activeHero.position.x && t.z === activeHero.position.z);
            if (!heroTile) {
                return { success: true, message: 'Teleport Glyph: Active hero not on a valid tile.', gameState: discard(gameState) };
            }
            const farthestTile = TileSystem.getFarthestTile(heroTile.id, gameState);
            if (!farthestTile || farthestTile.id === heroTile.id) {
                return { success: true, message: 'Teleport Glyph: Hero already on the farthest tile. No movement.', gameState: discard(gameState) };
            }
            const monstersOnHeroTile = gameState.monsters.filter(m =>
                !m.isDefeated && m.hp > 0 && m.position.x === activeHero.position.x && m.position.z === activeHero.position.z
            );
            const monstersOnHeroTileIds = monstersOnHeroTile.map(m => m.id);

            const updatedHeroes = gameState.heroes.map(h =>
                h.id === activeHero.id ? { ...h, position: { ...h.position, x: farthestTile.x, z: farthestTile.z, sqX: 2, sqZ: 2 } } : h
            );
            const updatedMonsters = gameState.monsters.map(m => {
                if (monstersOnHeroTileIds.includes(m.id)) {
                    return { ...m, position: { ...m.position, x: farthestTile.x, z: farthestTile.z, sqX: 2, sqZ: 2 } };
                }
                return m;
            });
            const updatedTiles = gameState.tiles.map(t => {
                let heroes = t.heroes;
                if (t.id === heroTile.id) heroes = heroes.filter(id => id !== activeHero.id);

                let monsters = t.monsters;
                if (t.id === heroTile.id) monsters = monsters.filter(id => !monstersOnHeroTileIds.includes(id));

                if (t.id === farthestTile.id) {
                    heroes = [...new Set([...heroes, activeHero.id])];
                    monsters = [...new Set([...monsters, ...monstersOnHeroTileIds])];
                }
                return { ...t, heroes, monsters };
            });
            return { success: true, message: `Teleport Glyph: ${activeHero.name} and ${monstersOnHeroTile.length} monster(s) teleported to farthest tile (${farthestTile.x},${farthestTile.z}).`, gameState: discard({ ...gameState, heroes: updatedHeroes, monsters: updatedMonsters, tiles: updatedTiles }) };
        }

        // -----------------------------------------------------------------------
        // Treasure Chest — roll: 1-10 → 2 damage; 11-15 → 1 damage + treasure; 16-20 → treasure
        // -----------------------------------------------------------------------
        if (card.id === 'enc_treasure_chest') {
            const r = roll();
            let msg = '';
            let newState = gameState;
            if (r <= 10) {
                const updatedHero = CombatSystem.applyDamage(activeHero, 2) as Hero;
                newState = { ...gameState, heroes: gameState.heroes.map(h => h.id === activeHero.id ? updatedHero : h) };
                msg = `Treasure Chest (Roll: ${r}): ${activeHero.name} takes 2 damage!`;
            } else if (r <= 15) {
                let updatedHero = CombatSystem.applyDamage(activeHero, 1) as Hero;
                let stateWithDamage = { ...gameState, heroes: gameState.heroes.map(h => h.id === activeHero.id ? updatedHero : h) };
                const drawResult = TreasureSystem.drawTreasureCard(stateWithDamage, updatedHero);
                newState = drawResult.newState;
                if (drawResult.card) {
                    if (drawResult.card.treasureType === 'item') {
                        const r2 = TreasureSystem.assignItem(newState, drawResult.card, updatedHero);
                        newState = r2.newState;
                    } else if (drawResult.card.treasureType === 'blessing') {
                        const r2 = TreasureSystem.useBlessing(newState, drawResult.card, updatedHero);
                        newState = r2.newState;
                    } else if (drawResult.card.treasureType === 'fortune') {
                        const r2 = TreasureSystem.useFortune(newState, drawResult.card, updatedHero);
                        newState = r2.newState;
                    }
                }
                msg = `Treasure Chest (Roll: ${r}): ${activeHero.name} takes 1 damage and draws a Treasure Card!`;
            } else {
                const drawResult = TreasureSystem.drawTreasureCard(gameState, activeHero);
                newState = drawResult.newState;
                if (drawResult.card) {
                    if (drawResult.card.treasureType === 'item') {
                        const r2 = TreasureSystem.assignItem(newState, drawResult.card, activeHero);
                        newState = r2.newState;
                    } else if (drawResult.card.treasureType === 'blessing') {
                        const r2 = TreasureSystem.useBlessing(newState, drawResult.card, activeHero);
                        newState = r2.newState;
                    } else if (drawResult.card.treasureType === 'fortune') {
                        const r2 = TreasureSystem.useFortune(newState, drawResult.card, activeHero);
                        newState = r2.newState;
                    }
                }
                msg = `Treasure Chest (Roll: ${r}): ${activeHero.name} draws a Treasure Card!`;
            }
            return { success: true, message: msg, gameState: discard(newState) };
        }

        // -----------------------------------------------------------------------
        // Corner of Your Eye — place hero on adjacent tile; roll: 1-15 spawn, 16-20 flip power
        // -----------------------------------------------------------------------
        if (card.id === 'enc_corner_of_your_eye') {
            // Move hero to a random adjacent revealed tile
            const adjacentTiles = gameState.tiles.filter(t =>
                t.isRevealed && manhattanDistance({ x: t.x, z: t.z }, activeHero.position) === 1
            );
            let updatedHeroes = [...gameState.heroes];
            let updatedTiles = [...gameState.tiles];
            let updatedMonsters = [...gameState.monsters];
            let monsterDeck = gameState.monsterDeck;
            let msg = '';
            if (adjacentTiles.length > 0) {
                const newTile = adjacentTiles[Math.floor(Math.random() * adjacentTiles.length)];
                updatedTiles = updatedTiles.map(t => {
                    let heroes = [...t.heroes];
                    if (t.x === activeHero.position.x && t.z === activeHero.position.z) heroes = heroes.filter(id => id !== activeHero.id);
                    if (t.x === newTile.x && t.z === newTile.z) heroes = [...new Set([...heroes, activeHero.id])];
                    return { ...t, heroes };
                });
                updatedHeroes = updatedHeroes.map(h =>
                    h.id === activeHero.id ? { ...h, position: { ...h.position, x: newTile.x, z: newTile.z } } : h
                );
                const r = roll();
                if (r <= 15) {
                    const heroTile = updatedTiles.find(t => t.x === newTile.x && t.z === newTile.z);
                    if (heroTile) {
                        const spawnResult = this.spawnMonsterOnTile({ ...gameState, tiles: updatedTiles, monsters: updatedMonsters, monsterDeck }, heroTile);
                        if (spawnResult.monster) {
                            updatedMonsters = [...updatedMonsters, { ...spawnResult.monster, ownedByHeroId: activeHero.id }];
                            monsterDeck = spawnResult.monsterDeck;
                        }
                    }
                    msg = `Corner of Your Eye (Roll: ${r}): ${activeHero.name} moved to (${newTile.x},${newTile.z}). A monster rushes from the darkness!`;
                } else {
                    const hero = updatedHeroes.find(h => h.id === activeHero.id)!;
                    const flipped = hero.flippedPowerIds ?? [];
                    if (flipped.length > 0) {
                        updatedHeroes = updatedHeroes.map(h =>
                            h.id === hero.id ? { ...h, flippedPowerIds: flipped.slice(0, -1) } : h
                        );
                        msg = `Corner of Your Eye (Roll: ${r}): ${hero.name} moved to (${newTile.x},${newTile.z}). A friendly spirit flips a used power back up!`;
                    } else {
                        msg = `Corner of Your Eye (Roll: ${r}): ${hero.name} moved to (${newTile.x},${newTile.z}). Rolled high but no used power to flip.`;
                    }
                }
            } else {
                msg = 'Corner of Your Eye: No adjacent tile to move to.';
            }
            return { success: true, message: msg, gameState: discard({ ...gameState, heroes: updatedHeroes, tiles: updatedTiles, monsters: updatedMonsters, monsterDeck }) };
        }

        // -----------------------------------------------------------------------
        // Cowardly Flight — closest monster flees to new tile drawn from bottom of deck
        // -----------------------------------------------------------------------
        if (card.id === 'enc_cowardly_flight') {
            const activeMonsters = gameState.monsters.filter(m => m.hp > 0 && !m.isDefeated);
            if (activeMonsters.length === 0) {
                return { success: true, message: 'Cowardly Flight: No monsters in play. Card discarded.', gameState: discard(gameState) };
            }
            const points = TileSystem.getExplorationPoints(gameState.tiles);
            if (points.length === 0) {
                return { success: true, message: 'Cowardly Flight: No unexplored edges. Card discarded.', gameState: discard(gameState) };
            }
            let closestPoint = points[0];
            let minDist = Infinity;
            for (const pt of points) {
                const ptTile = gameState.tiles.find(t => t.id === pt.tileId)!;
                const d = manhattanDistance({ x: ptTile.x, z: ptTile.z }, activeHero.position);
                if (d < minDist) { minDist = d; closestPoint = pt; }
            }
            const drawResult = TileSystem.drawAndPlaceFromBottom(gameState, closestPoint);
            if (!drawResult.tile) {
                return { success: true, message: 'Cowardly Flight: Could not place tile. Card discarded.', gameState: discard(gameState) };
            }
            const parentTile = gameState.tiles.find(t => t.id === closestPoint.tileId)!;
            const targetCoords = TileSystem.getTargetCoords(parentTile.x, parentTile.z, closestPoint.edge);
            const newTileInstance: Tile = {
                ...drawResult.tile,
                id: `${drawResult.tile.id}_${Math.random().toString(36).substr(2, 5)}`,
                x: targetCoords.x, z: targetCoords.z,
                rotation: drawResult.validRotations[0],
                connections: TileSystem.rotateConnections(drawResult.tile.connections.map(c => ({ ...c })), drawResult.validRotations[0]),
                isRevealed: true, monsters: [], heroes: [], items: []
            };
            let updatedTiles = TileSystem.connectTiles(gameState.tiles, parentTile, newTileInstance, closestPoint.edge);

            // Find monster closest to activeHero
            let closestMonster = activeMonsters[0];
            let minMonsterDist = manhattanDistance(closestMonster.position, activeHero.position);
            for (const m of activeMonsters) {
                const d = manhattanDistance(m.position, activeHero.position);
                if (d < minMonsterDist) { minMonsterDist = d; closestMonster = m; }
            }

            // Move the closest monster to the new tile
            const monsterOldPos = { ...closestMonster.position };
            const updatedMonsters = gameState.monsters.map(m => {
                if (m.id === closestMonster.id) {
                    return { ...m, position: { ...m.position, x: newTileInstance.x, z: newTileInstance.z, sqX: 2, sqZ: 2 } };
                }
                return m;
            });
            updatedTiles = updatedTiles.map(t => {
                let monsters = [...t.monsters];
                if (t.x === monsterOldPos.x && t.z === monsterOldPos.z) {
                    monsters = monsters.filter(id => id !== closestMonster.id);
                }
                if (t.x === newTileInstance.x && t.z === newTileInstance.z) {
                    monsters = [...new Set([...monsters, closestMonster.id])];
                }
                return { ...t, monsters };
            });

            // Place a new monster on that tile
            const spawnResult = this.spawnMonsterOnTile({ ...gameState, tiles: updatedTiles, monsters: updatedMonsters, monsterDeck: gameState.monsterDeck, dungeonDeck: drawResult.remainingDeck }, newTileInstance);
            let finalMonsters = updatedMonsters;
            let finalMonsterDeck = gameState.monsterDeck;
            if (spawnResult.monster) {
                finalMonsters = [...finalMonsters, { ...spawnResult.monster, ownedByHeroId: activeHero.id }];
                finalMonsterDeck = spawnResult.monsterDeck;
                updatedTiles = updatedTiles.map(t => {
                    if (t.x === newTileInstance.x && t.z === newTileInstance.z) {
                        return { ...t, monsters: [...new Set([...t.monsters, spawnResult.monster!.id])] };
                    }
                    return t;
                });
            }

            return {
                success: true,
                message: `Cowardly Flight: The closest monster (${closestMonster.name}) flees to the new tile. A new monster has also spawned there.`,
                gameState: discard({ ...gameState, tiles: updatedTiles, monsters: finalMonsters, monsterDeck: finalMonsterDeck, dungeonDeck: drawResult.remainingDeck })
            };
        }

        // -----------------------------------------------------------------------
        // Cyrus Belview — draw bottom tile adjacent to any unexplored edge; spawn 2 monsters; move active hero there; others may follow
        // -----------------------------------------------------------------------
        if (card.id === 'enc_cyrus_belview') {
            const points = TileSystem.getExplorationPoints(gameState.tiles);
            if (points.length === 0) {
                return { success: true, message: 'Cyrus Belview: No unexplored edges. Card discarded.', gameState: discard(gameState) };
            }
            const targetPoint = points[Math.floor(Math.random() * points.length)];
            const drawResult = TileSystem.drawAndPlaceFromBottom(gameState, targetPoint);
            if (!drawResult.tile) {
                return { success: true, message: 'Cyrus Belview: Could not place tile. Card discarded.', gameState: discard(gameState) };
            }
            const parentTile = gameState.tiles.find(t => t.id === targetPoint.tileId)!;
            const targetCoords = TileSystem.getTargetCoords(parentTile.x, parentTile.z, targetPoint.edge);
            const newTileInstance: Tile = {
                ...drawResult.tile,
                id: `${drawResult.tile.id}_${Math.random().toString(36).substr(2, 5)}`,
                x: targetCoords.x, z: targetCoords.z,
                rotation: drawResult.validRotations[0],
                isRevealed: true, monsters: [], heroes: [], items: []
            };
            let updatedTiles = TileSystem.connectTiles(gameState.tiles, parentTile, newTileInstance, targetPoint.edge);
            let monsterDeck = drawResult.remainingDeck;
            let updatedMonsters = [...gameState.monsters];
            // Spawn 2 monsters
            for (let i = 0; i < 2; i++) {
                const spawnResult = this.spawnMonsterOnTile({ ...gameState, tiles: updatedTiles, monsters: updatedMonsters, monsterDeck, dungeonDeck: drawResult.remainingDeck }, newTileInstance);
                if (spawnResult.monster) {
                    updatedMonsters = [...updatedMonsters, { ...spawnResult.monster, ownedByHeroId: activeHero.id }];
                    monsterDeck = spawnResult.monsterDeck;
                }
            }
            // Move all heroes to new tile (auto-follow per card: "each other Hero can place himself or herself")
            const updatedHeroes = gameState.heroes.map(h => ({
                ...h, position: { ...h.position, x: newTileInstance.x, z: newTileInstance.z }
            }));
            updatedTiles = updatedTiles.map(t => {
                if (t.x === newTileInstance.x && t.z === newTileInstance.z) {
                    return { ...t, heroes: gameState.heroes.map(h => h.id) };
                }
                return { ...t, heroes: t.heroes.filter(id => !gameState.heroes.find(h => h.id === id)) };
            });
            return { success: true, message: `Cyrus Belview: All heroes move to new tile (${newTileInstance.x},${newTileInstance.z}) with 2 new monsters.`, gameState: discard({ ...gameState, tiles: updatedTiles, heroes: updatedHeroes, monsters: updatedMonsters, monsterDeck, dungeonDeck: drawResult.remainingDeck }) };
        }

        // -----------------------------------------------------------------------
        // Strahd's Whispers — DEFERRED (requires player to choose power to attack adjacent hero)
        // -----------------------------------------------------------------------
        if (card.id === 'enc_strahds_whispers') {
            const otherHeroes = gameState.heroes.filter(h => h.id !== activeHero.id);
            if (otherHeroes.length === 0) {
                return { success: true, message: "Strahd's Whispers: No other heroes to target.", gameState: discard(gameState) };
            }
            // Find closest other hero
            let closestHero = otherHeroes[0];
            let minDist = manhattanDistance(activeHero.position, closestHero.position);
            for (const h of otherHeroes) {
                const d = manhattanDistance(activeHero.position, h.position);
                if (d < minDist) { minDist = d; closestHero = h; }
            }
            // Move active hero adjacent to closest hero
            const updatedHeroes = gameState.heroes.map(h =>
                h.id === activeHero.id ? { ...h, position: { ...h.position, x: closestHero.position.x, z: closestHero.position.z } } : h
            );
            const updatedTiles = gameState.tiles.map(t => {
                let heroes = [...t.heroes];
                if (t.x === activeHero.position.x && t.z === activeHero.position.z) heroes = heroes.filter(id => id !== activeHero.id);
                if (t.x === closestHero.position.x && t.z === closestHero.position.z) heroes = [...new Set([...heroes, activeHero.id])];
                return { ...t, heroes };
            });
            return { success: true, message: `Strahd's Whispers: ${activeHero.name} placed adjacent to ${closestHero.name}. (At-will attack deferred — requires player selection.)`, gameState: discard({ ...gameState, heroes: updatedHeroes, tiles: updatedTiles }) };
        }

        // -----------------------------------------------------------------------
        // Frenzy — each monster controlled by active hero activates twice
        // -----------------------------------------------------------------------
        if (card.id === 'enc_frenzy') {
            return {
                success: true,
                message: `Frenzy: Each monster you control will activate twice this Villain Phase.`,
                gameState: discard({ ...gameState, frenzyActiveThisTurn: true })
            };
        }

        // -----------------------------------------------------------------------
        // Howl of the Wolf — choose one monster on any hero's tile to activate immediately
        // -----------------------------------------------------------------------
        if (card.id === 'enc_howl_of_the_wolf') {
            const heroTiles = new Set(gameState.heroes.map(h => `${h.position.x},${h.position.z}`));
            const monstersOnHeroTiles = gameState.monsters.filter(m =>
                !m.isDefeated && m.hp > 0 && heroTiles.has(`${m.position.x},${m.position.z}`)
            );
            if (monstersOnHeroTiles.length > 0) {
                const targetMonster = monstersOnHeroTiles[0];
                const nextState = activateMonsterEntity(gameState, targetMonster.id);
                return {
                    success: true,
                    message: `Howl of the Wolf: ${targetMonster.name} on a hero's tile immediately activates.`,
                    gameState: discard(nextState)
                };
            } else {
                return {
                    success: true,
                    message: `Howl of the Wolf: No monsters on any hero's tile to activate.`,
                    gameState: discard(gameState)
                };
            }
        }

        // -----------------------------------------------------------------------
        // Voice of the Master — each hero activates a controlled monster (fallback: spawn)
        // -----------------------------------------------------------------------
        if (card.id === 'enc_voice_of_the_master') {
            const activeIndex = gameState.heroes.findIndex(h => h.id === activeHero.id);
            const orderedHeroes: Hero[] = [];
            for (let i = 1; i <= gameState.heroes.length; i++) {
                const nextHero = gameState.heroes[(activeIndex + i) % gameState.heroes.length];
                orderedHeroes.push(nextHero);
            }
            let tempState = { ...gameState };
            let placementDone = false;
            const msgs: string[] = [];

            for (const hero of orderedHeroes) {
                const controlledMonsters = tempState.monsters.filter(m => m.ownedByHeroId === hero.id && m.hp > 0 && !m.isDefeated);
                if (controlledMonsters.length > 0) {
                    const monster = controlledMonsters[0];
                    msgs.push(`${hero.name} activates ${monster.name}`);
                    tempState = activateMonsterEntity(tempState, monster.id);
                } else if (!placementDone) {
                    const heroTile = tempState.tiles.find(t => t.x === hero.position.x && t.z === hero.position.z);
                    if (heroTile) {
                        const spawnResult = this.spawnMonsterOnTile(tempState, heroTile);
                        if (spawnResult.monster) {
                            const newMonster = { ...spawnResult.monster, ownedByHeroId: hero.id };
                            tempState = {
                                ...tempState,
                                monsters: [...tempState.monsters, newMonster],
                                monsterDeck: spawnResult.monsterDeck
                            };
                            msgs.push(`${hero.name} cannot activate a monster and instead places a new ${newMonster.name} on tile (${heroTile.x},${heroTile.z})`);
                        }
                    }
                    placementDone = true;
                }
            }
            return {
                success: true,
                message: `Voice of the Master: ${msgs.join('; ')}.`,
                gameState: discard(tempState)
            };
        }

        // -----------------------------------------------------------------------
        // Fallback: generic effect loop for remaining cards
        // -----------------------------------------------------------------------
        let updatedHero = activeHero;
        let updatedMonsters = [...gameState.monsters];
        let updatedDiscardPiles = { ...gameState.discardPiles };
        let updatedMonsterDeck = gameState.monsterDeck;

        for (const effect of card.effects) {
            const result = this.applyEffect(effect, [updatedHero], updatedHero, null, { ...gameState, monsters: updatedMonsters, discardPiles: updatedDiscardPiles, monsterDeck: updatedMonsterDeck });
            if (result.heroes) updatedHero = result.heroes[0];
            updatedMonsters = result.monsters ?? updatedMonsters;
            updatedDiscardPiles = result.discardPiles ?? updatedDiscardPiles;
            updatedMonsterDeck = result.monsterDeck ?? updatedMonsterDeck;
        }

        updatedDiscardPiles['encounter'] = [...(updatedDiscardPiles['encounter'] ?? []), card.id];

        const updatedHeroes = gameState.heroes.map(h => h.id === updatedHero.id ? updatedHero : h);

        return {
            success: true,
            message: `Event card ${card.name} resolved and discarded.`,
            gameState: {
                ...gameState,
                heroes: updatedHeroes,
                monsters: updatedMonsters,
                discardPiles: updatedDiscardPiles,
                monsterDeck: updatedMonsterDeck
            }
        };
    }

    public static processEventAttackCard(
        gameState: GameState,
        card: Card,
        activeHero: Hero
    ): { success: boolean; message: string; results: any[]; gameState: GameState } {
        const result = this.processEventAttackCardInternal(gameState, card, activeHero);
        return {
            ...result,
            gameState: ConditionSystem.syncActiveConditions(result.gameState)
        };
    }

    private static processEventAttackCardInternal(
        gameState: GameState,
        card: Card,
        activeHero: Hero
    ): { success: boolean; message: string; results: any[]; gameState: GameState } {
        const results: any[] = [];
        let updatedHeroes = [...gameState.heroes];
        let updatedMonsters = [...gameState.monsters];
        let monsterDeck = gameState.monsterDeck;
        let updatedTiles = [...gameState.tiles];

        const manhattanDistance = (p1: { x: number; z: number }, p2: { x: number; z: number }) =>
            Math.abs(p1.x - p2.x) + Math.abs(p1.z - p2.z);

        const makeAttacker = (pos: { x: number; z: number; sqX: number; sqZ: number }) => ({
            id: 'event', name: card.name, type: 'monster' as const,
            hp: 0, maxHp: 0, ac: 0, speed: 0, isExhausted: false,
            position: pos, conditions: [], usedPowers: []
        });

        const discardTreasureRandom = (hero: Hero, state: GameState): { hero: Hero; discardPiles: GameState['discardPiles'] } => {
            if (hero.items.length === 0) return { hero, discardPiles: state.discardPiles };
            const idx = Math.floor(Math.random() * hero.items.length);
            const item = hero.items[idx];
            const newHero = { ...hero, items: hero.items.filter((_, i) => i !== idx) };
            let piles = { ...state.discardPiles };
            piles['treasure'] = [...(piles['treasure'] ?? []), item];
            // Spirit of Doom env triggers on treasure discard
            let finalHero = newHero;
            if (state.activeEnvironmentCard === 'enc_spirit_of_doom_env') {
                finalHero = CombatSystem.applyDamage(newHero, 1) as Hero;
            }
            return { hero: finalHero, discardPiles: piles };
        };

        for (const effect of card.effects) {
            if (effect.type === 'event_attack') {
                const attackBonus: number = (effect as any).attackBonus ?? 7;
                const damage: number = (effect as any).damage ?? 1;
                const missValue: number = (effect as any).missValue ?? 0;
                const target: string = (effect as any).target ?? 'active_hero';
                const onHitStatusEffect: string | undefined = (effect as any).onHitStatusEffect;
                const onMissStatusEffect: string | undefined = (effect as any).onMissStatusEffect;
                const onHitEffect: string | undefined = (effect as any).onHitEffect;
                const repeatCount: number = (effect as any).repeatCount ?? 1;

                // Determine target heroes
                let targetHeroes: Hero[] = [];
                if (target === 'active_hero') {
                    targetHeroes = [updatedHeroes.find(h => h.id === activeHero.id) ?? activeHero];
                } else if (target === 'heroes_on_active_tile') {
                    targetHeroes = updatedHeroes.filter(h =>
                        h.position.x === activeHero.position.x && h.position.z === activeHero.position.z
                    );
                } else if (target === 'all_heroes') {
                    targetHeroes = [...updatedHeroes];
                } else if (target === 'heroes_within_1_tile') {
                    targetHeroes = updatedHeroes.filter(h =>
                        manhattanDistance(h.position, activeHero.position) <= 1
                    );
                }

                for (const hero of targetHeroes) {
                    for (let rep = 0; rep < repeatCount; rep++) {
                        const currentHero = updatedHeroes.find(h => h.id === hero.id) ?? hero;
                        const attackResult = CombatSystem.resolveAttack(
                            makeAttacker(currentHero.position),
                            currentHero,
                            attackBonus, damage, 0,
                            undefined, gameState, missValue
                        );
                        let finalHero = currentHero;
                        if (attackResult.hit) {
                            finalHero = CombatSystem.applyDamage(finalHero, attackResult.damage) as Hero;
                            if (onHitStatusEffect) {
                                finalHero = ConditionSystem.applyCondition(finalHero, onHitStatusEffect as any, card.id, 1) as Hero;
                            }
                            if (onHitEffect === 'discard_treasure_random') {
                                const { hero: heroAfterDiscard, discardPiles } = discardTreasureRandom(finalHero, { ...gameState, discardPiles: gameState.discardPiles });
                                finalHero = heroAfterDiscard;
                                gameState = { ...gameState, discardPiles };
                            }
                        } else {
                            if (missValue > 0) {
                                finalHero = CombatSystem.applyDamage(finalHero, missValue) as Hero;
                            }
                            if (onMissStatusEffect) {
                                finalHero = ConditionSystem.applyCondition(finalHero, onMissStatusEffect as any, card.id, 1) as Hero;
                            }
                        }
                        updatedHeroes = updatedHeroes.map(h => h.id === hero.id ? finalHero : h);
                        results.push({ heroId: hero.id, hit: attackResult.hit, roll: attackResult.roll, damage: attackResult.damage, rep });
                    }
                }
            } else if (effect.type === 'spawn_monster') {
                // Post-attack spawn (e.g. Ambush!)
                const targetTile = gameState.tiles.find(t => t.x === activeHero.position.x && t.z === activeHero.position.z);
                if (targetTile) {
                    const spawnResult = this.spawnMonsterOnTile({ ...gameState, monsters: updatedMonsters, monsterDeck }, targetTile);
                    if (spawnResult.monster) {
                        updatedMonsters = [...updatedMonsters, { ...spawnResult.monster, ownedByHeroId: activeHero.id }];
                        monsterDeck = spawnResult.monsterDeck;
                    }
                }
            } else if (effect.type === 'heal_undead_on_tile') {
                // Circle of Death — heal undead monsters on active hero's tile
                updatedMonsters = updatedMonsters.map(m => {
                    if (m.isUndead && !m.isDefeated && m.hp > 0 &&
                        m.position.x === activeHero.position.x && m.position.z === activeHero.position.z) {
                        return { ...m, hp: Math.min(m.hp + (effect.value || 1), m.maxHp) };
                    }
                    return m;
                });
            } else if (effect.type === 'move_monsters_closer') {
                // Patrina Velikovna post-attack — move lone monsters 1 tile closer
                const heroPositions = new Set(updatedHeroes.map(h => `${h.position.x},${h.position.z}`));
                updatedMonsters = updatedMonsters.map(m => {
                    if (m.isDefeated || m.hp <= 0) return m;
                    if (heroPositions.has(`${m.position.x},${m.position.z}`)) return m; // already on hero tile
                    // Move 1 tile toward closest hero
                    let closestHero = updatedHeroes[0];
                    let minDist = manhattanDistance(m.position, closestHero.position);
                    for (const h of updatedHeroes) {
                        const d = manhattanDistance(m.position, h.position);
                        if (d < minDist) { minDist = d; closestHero = h; }
                    }
                    const dx = closestHero.position.x - m.position.x;
                    const dz = closestHero.position.z - m.position.z;
                    let nx = m.position.x;
                    let nz = m.position.z;
                    if (Math.abs(dx) >= Math.abs(dz)) {
                        nx += Math.sign(dx);
                    } else {
                        nz += Math.sign(dz);
                    }
                    const targetTile = gameState.tiles.find(t => t.x === nx && t.z === nz);
                    if (!targetTile) return m;
                    return { ...m, position: { ...m.position, x: nx, z: nz } };
                });
            } else if (effect.type === 'passive' && (effect as any).passiveType === 'prowling_ghost_post') {
                // Prowling Ghost — draw tile near active hero, spawn monster, move hero there
                const points = TileSystem.getExplorationPoints(updatedTiles);
                if (points.length > 0) {
                    let closestPoint = points[0];
                    let minDist = Infinity;
                    for (const pt of points) {
                        const ptTile = updatedTiles.find(t => t.id === pt.tileId)!;
                        const d = manhattanDistance({ x: ptTile.x, z: ptTile.z }, activeHero.position);
                        if (d < minDist) { minDist = d; closestPoint = pt; }
                    }
                    const drawResult = TileSystem.drawAndPlaceFromBottom({ ...gameState, tiles: updatedTiles }, closestPoint);
                    if (drawResult.tile) {
                        const parentTile = updatedTiles.find(t => t.id === closestPoint.tileId)!;
                        const targetCoords = TileSystem.getTargetCoords(parentTile.x, parentTile.z, closestPoint.edge);
                        const newTileInstance: Tile = {
                            ...drawResult.tile,
                            id: `${drawResult.tile.id}_${Math.random().toString(36).substr(2, 5)}`,
                            x: targetCoords.x, z: targetCoords.z,
                            rotation: drawResult.validRotations[0],
                            isRevealed: true, monsters: [], heroes: [], items: []
                        };
                        updatedTiles = TileSystem.connectTiles(updatedTiles, parentTile, newTileInstance, closestPoint.edge);
                        const spawnResult = this.spawnMonsterOnTile({ ...gameState, tiles: updatedTiles, monsters: updatedMonsters, monsterDeck, dungeonDeck: drawResult.remainingDeck }, newTileInstance);
                        if (spawnResult.monster) {
                            updatedMonsters = [...updatedMonsters, { ...spawnResult.monster, ownedByHeroId: activeHero.id }];
                            monsterDeck = spawnResult.monsterDeck;
                        }
                        // Move active hero to new tile
                        updatedHeroes = updatedHeroes.map(h => {
                            if (h.id !== activeHero.id) return h;
                            return { ...h, position: { ...h.position, x: newTileInstance.x, z: newTileInstance.z } };
                        });
                        updatedTiles = updatedTiles.map(t => {
                            let heroes = [...t.heroes];
                            if (t.x === activeHero.position.x && t.z === activeHero.position.z) heroes = heroes.filter(id => id !== activeHero.id);
                            if (t.x === newTileInstance.x && t.z === newTileInstance.z) heroes = [...new Set([...heroes, activeHero.id])];
                            return { ...t, heroes };
                        });
                        gameState = { ...gameState, dungeonDeck: drawResult.remainingDeck };
                    }
                }
            }
        }

        if (card.id === 'enc_king_tomescus_portal') {
            updatedHeroes = updatedHeroes.map(h => {
                if (h.id !== activeHero.id) return h;
                return {
                    ...h,
                    removedFromPlay: true,
                    position: { ...h.position, x: -999, z: -999 }
                };
            });
            updatedTiles = updatedTiles.map(t => {
                let heroesList = [...t.heroes];
                if (t.x === activeHero.position.x && t.z === activeHero.position.z) {
                    heroesList = heroesList.filter(id => id !== activeHero.id);
                }
                return { ...t, heroes: heroesList };
            });
        }

        if (card.id === 'enc_icy_corridor') {
            const adjTiles = updatedTiles.filter(t => t.isRevealed && manhattanDistance({ x: t.x, z: t.z }, activeHero.position) === 1);
            return {
                success: true,
                message: `Icy Corridor: Resolved attack. Choose adjacent tile to relocate.`,
                results,
                gameState: {
                    ...gameState,
                    heroes: updatedHeroes,
                    monsters: updatedMonsters,
                    tiles: updatedTiles,
                    monsterDeck,
                    pendingFortune: {
                        kind: 'tileRelocatePick',
                        heroId: activeHero.id,
                        eligibleTileIds: adjTiles.map(t => t.id),
                        fortuneCardId: card.id
                    }
                }
            };
        }

        const updatedDiscardPiles = {
            ...gameState.discardPiles,
            encounter: [...(gameState.discardPiles['encounter'] ?? []), card.id]
        };

        return {
            success: true,
            message: `Event-attack card ${card.name} resolved.`,
            results,
            gameState: { ...gameState, heroes: updatedHeroes, monsters: updatedMonsters, tiles: updatedTiles, monsterDeck, discardPiles: updatedDiscardPiles }
        };
    }


    public static placeTrap(
        gameState: GameState,
        card: Card,
        activeHero: Hero
    ): { success: boolean; message: string; trap?: Trap; gameState: GameState } {
        const targetTile = gameState.tiles.find(t => t.x === activeHero.position.x && t.z === activeHero.position.z);

        if (!targetTile) {
            return { success: false, message: 'Hero is not on a valid tile.', gameState };
        }

        const existingTrap = gameState.traps.find(t => t.tileId === targetTile.id);
        if (existingTrap) {
            const updatedDiscardPiles = {
                ...gameState.discardPiles,
                encounter: [...(gameState.discardPiles['encounter'] ?? []), card.id]
            };
            return {
                success: false,
                message: 'A trap already exists on this tile. Drawing another encounter card.',
                gameState: { ...gameState, discardPiles: updatedDiscardPiles }
            };
        }

        const trap: Trap = {
            id: `trap_${Date.now()}`,
            cardId: card.id,
            tileId: targetTile.id,
            position: activeHero.position,
            isDisabled: false,
            ownedByHeroId: activeHero.id,
            isTriggered: false
        };

        return {
            success: true,
            message: `Trap ${card.name} placed on tile.`,
            trap,
            gameState: { ...gameState, traps: [...gameState.traps, trap] }
        };
    }

    public static activateTrap(
        gameState: GameState,
        trap: Trap,
        card: Card
    ): { success: boolean; message: string; results: any[]; gameState: GameState } {
        const result = this.activateTrapInternal(gameState, trap, card);
        return {
            ...result,
            gameState: ConditionSystem.syncActiveConditions(result.gameState)
        };
    }

    private static activateTrapInternal(
        gameState: GameState,
        trap: Trap,
        card: Card
    ): { success: boolean; message: string; results: any[]; gameState: GameState } {
        if (trap.isDisabled) {
            return { success: false, message: 'Trap is disabled', results: [], gameState };
        }

        const results: any[] = [];
        let tempState = { ...gameState };
        let updatedHeroes = [...tempState.heroes];
        let updatedTiles = [...tempState.tiles];
        let updatedMonsters = [...tempState.monsters];
        let updatedMonsterDeck = tempState.monsterDeck;
        let logIdCounter = tempState.logIdCounter ?? 0;
        let log = [...(tempState.log ?? [])];

        const addLogEntry = (message: string) => {
            logIdCounter++;
            log.push({
                id: String(logIdCounter),
                timestamp: new Date().toISOString(),
                message,
                type: 'combat' as const
            });
        };

        const trapTile = tempState.tiles.find(t => t.id === trap.tileId);
        if (!trapTile) {
            return { success: false, message: 'Trap has no parent tile.', results: [], gameState };
        }

        const trapEntity = {
            id: trap.id,
            name: card.name,
            type: 'monster' as const,
            hp: 0, maxHp: 0, ac: 0, speed: 0,
            isExhausted: false,
            position: { x: trapTile.x, z: trapTile.z, sqX: 2, sqZ: 2 },
            conditions: [],
            usedPowers: []
        };

        // 1. Alarm Trap
        if (card.id === 'enc_alarm_trap') {
            const unexploredEdges: { tile: Tile; edge: Direction; target: { x: number; z: number } }[] = [];
            for (const tile of tempState.tiles) {
                if (!tile.isRevealed) continue;
                for (const conn of tile.connections) {
                    if (conn.isOpen && !conn.connectedTileId) {
                        const edge = conn.edge as Direction;
                        const target = TileSystem.getTargetCoords(tile.x, tile.z, edge);
                        const occupied = tempState.tiles.some(t => t.x === target.x && t.z === target.z);
                        if (!occupied) {
                            unexploredEdges.push({ tile, edge, target });
                        }
                    }
                }
            }

            unexploredEdges.sort((a, b) => {
                const distA = Math.abs(trapTile.x - a.target.x) + Math.abs(trapTile.z - a.target.z);
                const distB = Math.abs(trapTile.x - b.target.x) + Math.abs(trapTile.z - b.target.z);
                if (distA !== distB) return distA - distB;
                if (a.target.x !== b.target.x) return a.target.x - b.target.x;
                if (a.target.z !== b.target.z) return a.target.z - b.target.z;
                return a.edge.localeCompare(b.edge);
            });

            if (unexploredEdges.length > 0) {
                const closest = unexploredEdges[0];
                const spawnResult = this.spawnMonsterOnTile(tempState, closest.tile);
                if (spawnResult.monster) {
                    const newMonster = { ...spawnResult.monster, ownedByHeroId: tempState.currentHeroId };
                    updatedMonsters = [...updatedMonsters, newMonster];
                    updatedMonsterDeck = spawnResult.monsterDeck;
                    addLogEntry(`Alarm Trap: Spawned ${newMonster.name} on tile (${closest.tile.x},${closest.tile.z}) near unexplored ${closest.edge} edge.`);
                    results.push({ spawnedMonsterId: newMonster.id });
                }
            } else {
                addLogEntry(`Alarm Trap: No unexplored edges remain.`);
            }
        }

        // 2. Crossbow Turret
        else if (card.id === 'enc_crossbow_turret') {
            const targetHeroes = updatedHeroes.filter(h => {
                if (h.removedFromPlay) return false;
                const hTile = tempState.tiles.find(t => t.x === h.position.x && t.z === h.position.z);
                if (!hTile) return false;
                return getTileGraphDistance(trapTile, hTile, tempState.tiles) <= 1;
            });

            for (const hero of targetHeroes) {
                const res = CombatSystem.resolveAttack(trapEntity, hero, 8, 2, 0, undefined, tempState, 1);
                const updated = CombatSystem.applyDamage(hero, res.damage) as Hero;
                updatedHeroes = updatedHeroes.map(h => h.id === hero.id ? updated : h);
                results.push({ heroId: hero.id, hit: res.hit, damage: res.damage });
                addLogEntry(`Crossbow Turret attacks ${hero.name} (+8 vs AC ${hero.ac}): ${res.hit ? 'HIT' : 'MISS'}. Deals ${res.damage} damage. (Roll: ${res.roll})`);
            }
        }

        // 3. Crushing Walls
        else if (card.id === 'enc_crushing_walls') {
            const targetHeroes = updatedHeroes.filter(h => {
                if (h.removedFromPlay) return false;
                return h.position.x === trapTile.x && h.position.z === trapTile.z;
            });

            for (const hero of targetHeroes) {
                const res = CombatSystem.resolveAttack(trapEntity, hero, 6, 2, 0, undefined, tempState, 1);
                let updated = CombatSystem.applyDamage(hero, res.damage) as Hero;
                if (res.hit) {
                    updated = ConditionSystem.applyCondition(updated, 'immobilized', trap.id, 1) as Hero;
                }
                updatedHeroes = updatedHeroes.map(h => h.id === hero.id ? updated : h);
                results.push({ heroId: hero.id, hit: res.hit, damage: res.damage, statusEffect: res.hit ? 'immobilized' : undefined });
                addLogEntry(`Crushing Walls attacks ${hero.name} (+6 vs AC ${hero.ac}): ${res.hit ? 'HIT' : 'MISS'}. Deals ${res.damage} damage${res.hit ? ' and Immobilized' : ''}. (Roll: ${res.roll})`);
            }
        }

        // 4. Dart Trap
        else if (card.id === 'enc_dart_trap') {
            const targetHeroes = updatedHeroes.filter(h => {
                if (h.removedFromPlay) return false;
                return h.position.x === trapTile.x && h.position.z === trapTile.z;
            });

            for (const hero of targetHeroes) {
                const res = CombatSystem.resolveAttack(trapEntity, hero, 8, 2, 0, undefined, tempState, 1);
                const updated = CombatSystem.applyDamage(hero, res.damage) as Hero;
                updatedHeroes = updatedHeroes.map(h => h.id === hero.id ? updated : h);
                results.push({ heroId: hero.id, hit: res.hit, damage: res.damage });
                addLogEntry(`Dart Trap attacks ${hero.name} (+8 vs AC ${hero.ac}): ${res.hit ? 'HIT' : 'MISS'}. Deals ${res.damage} damage. (Roll: ${res.roll})`);
            }
        }

        // 5. Fire Trap
        else if (card.id === 'enc_fire_trap') {
            const targetHeroes = updatedHeroes.filter(h => {
                if (h.removedFromPlay) return false;
                return h.position.x === trapTile.x && h.position.z === trapTile.z;
            });

            for (const hero of targetHeroes) {
                const updated = CombatSystem.applyDamage(hero, 2) as Hero;
                updatedHeroes = updatedHeroes.map(h => h.id === hero.id ? updated : h);
                results.push({ heroId: hero.id, hit: true, damage: 2 });
                addLogEntry(`Fire Trap deals 2 damage directly to ${hero.name}.`);
            }
        }

        // 6. Sliding Walls
        else if (card.id === 'enc_sliding_walls') {
            const targetHeroes = updatedHeroes.filter(h => {
                if (h.removedFromPlay) return false;
                return h.position.x === trapTile.x && h.position.z === trapTile.z;
            });

            for (const hero of targetHeroes) {
                const r = AbilitySystem._rollOverride ? AbilitySystem._rollOverride() : Math.floor(Math.random() * 20) + 1;
                const edgeMap: Record<number, Direction> = {
                    1: 'north', 2: 'north', 3: 'north', 4: 'north', 5: 'north',
                    6: 'south', 7: 'south', 8: 'south', 9: 'south', 10: 'south',
                    11: 'east', 12: 'east', 13: 'east', 14: 'east', 15: 'east',
                    16: 'west', 17: 'west', 18: 'west', 19: 'west', 20: 'west'
                };
                const direction = edgeMap[r];
                const connection = trapTile.connections.find(c => c.edge === direction);
                let moved = false;
                let targetTile: Tile | undefined;
                if (connection && connection.isOpen && connection.connectedTileId) {
                    targetTile = tempState.tiles.find(t => t.id === connection.connectedTileId);
                    if (targetTile) {
                        moved = true;
                    }
                }

                if (moved && targetTile) {
                    updatedTiles = updatedTiles.map(t => {
                        let heroesList = [...t.heroes];
                        if (t.id === trapTile.id) {
                            heroesList = heroesList.filter(id => id !== hero.id);
                        }
                        if (t.id === targetTile!.id) {
                            heroesList = [...new Set([...heroesList, hero.id])];
                        }
                        return { ...t, heroes: heroesList };
                    });

                    const updatedHero = {
                        ...hero,
                        position: {
                            x: targetTile.x,
                            z: targetTile.z,
                            sqX: 2,
                            sqZ: 2
                        }
                    };
                    updatedHeroes = updatedHeroes.map(h => h.id === hero.id ? updatedHero : h);
                    results.push({ heroId: hero.id, moved: true, targetTileId: targetTile.id });
                    addLogEntry(`Sliding Walls (Roll: ${r} -> ${direction}): Placed ${hero.name} on tile (${targetTile.x},${targetTile.z}).`);
                } else {
                    const damagedHero = CombatSystem.applyDamage(hero, 1) as Hero;
                    updatedHeroes = updatedHeroes.map(h => h.id === hero.id ? damagedHero : h);
                    results.push({ heroId: hero.id, moved: false, damage: 1 });
                    addLogEntry(`Sliding Walls (Roll: ${r} -> ${direction}): Wall/unexplored tile blocks path. ${hero.name} takes 1 damage and remains on tile (${trapTile.x},${trapTile.z}).`);
                }
            }
        }

        // 7. Spear Gauntlet
        else if (card.id === 'enc_spear_gauntlet') {
            const targetHeroes = updatedHeroes.filter(h => {
                if (h.removedFromPlay) return false;
                const hTile = tempState.tiles.find(t => t.x === h.position.x && t.z === h.position.z);
                if (!hTile) return false;
                return getTileGraphDistance(trapTile, hTile, tempState.tiles) <= 1;
            });

            for (const hero of targetHeroes) {
                const res = CombatSystem.resolveAttack(trapEntity, hero, 6, 3, 0, undefined, tempState, 1);
                const updated = CombatSystem.applyDamage(hero, res.damage) as Hero;
                updatedHeroes = updatedHeroes.map(h => h.id === hero.id ? updated : h);
                results.push({ heroId: hero.id, hit: res.hit, damage: res.damage });
                addLogEntry(`Spear Gauntlet attacks ${hero.name} (+6 vs AC ${hero.ac}): ${res.hit ? 'HIT' : 'MISS'}. Deals ${res.damage} damage. (Roll: ${res.roll})`);
            }
        }

        return {
            success: true,
            message: `Trap ${card.name} activated.`,
            results,
            gameState: {
                ...tempState,
                heroes: updatedHeroes,
                tiles: updatedTiles,
                monsters: updatedMonsters,
                monsterDeck: updatedMonsterDeck,
                log: log.slice(-100),
                logIdCounter
            }
        };
    }

    public static attemptDisableTrap(
        gameState: GameState,
        hero: Hero,
        trap: Trap,
        card: Card
    ): { success: boolean; message: string; disabled: boolean; gameState: GameState } {
        if (hero.position.x !== trap.position?.x || hero.position.z !== trap.position?.z) {
            return {
                success: false,
                message: 'Hero must be on the same tile as the trap to disable it.',
                disabled: false,
                gameState
            };
        }

        const roll = AbilitySystem._rollOverride ? AbilitySystem._rollOverride() : Math.floor(Math.random() * 20) + 1;
        
        let trapDisableBonus = 0;
        if (hero.items?.includes('card-item-thieves-tools') || hero.items?.includes('item_thieves_tools')) {
            trapDisableBonus = 4;
        }
        
        const totalRoll = roll + trapDisableBonus;
        const disableDC = card.disableDC || 10;
        const success = totalRoll >= disableDC;

        const nextLogId = (gameState.logIdCounter ?? 0) + 1;
        const rollMathStr = trapDisableBonus ? ` (Roll: ${roll} + ${trapDisableBonus} = ${totalRoll}, DC: ${disableDC})` : ` (Roll: ${roll}, DC: ${disableDC})`;
        const msg = success
            ? `${hero.name} disabled the trap ${card.name}!${rollMathStr}`
            : `${hero.name} failed to disable the trap ${card.name}.${rollMathStr}`;
        
        const logEntry: GameLogEntry = {
            id: String(nextLogId),
            timestamp: new Date().toISOString(),
            message: msg,
            type: 'combat' as const
        };
        const nextLog = [...(gameState.log ?? []), logEntry].slice(-100);

        let finalGameState = { ...gameState, log: nextLog, logIdCounter: nextLogId };

        if (roll === 20) {
            finalGameState.heroes = finalGameState.heroes.map(h => 
                h.id === hero.id ? { ...h, hasRolledNatural20ThisTurn: true } : h
            );
        }

        if (success) {
            const updatedTraps = finalGameState.traps.filter(t => t.id !== trap.id);
            const updatedDiscardPiles = {
                ...finalGameState.discardPiles,
                encounter: [...(finalGameState.discardPiles['encounter'] ?? []), card.id]
            };

            return {
                success: true,
                message: msg,
                disabled: true,
                gameState: {
                    ...finalGameState,
                    traps: updatedTraps,
                    discardPiles: updatedDiscardPiles,
                    hasAttackedThisTurn: true
                }
            };
        } else {
            return {
                success: false,
                message: msg,
                disabled: false,
                gameState: {
                    ...finalGameState,
                    hasAttackedThisTurn: true
                }
            };
        }
    }

    private static applyEffect(
        effect: any,
        currentHeroes: Hero[],
        activeHero: Hero,
        selectedTarget: Entity | null,
        gameState: GameState
    ): { spawnedMonsterId?: string | null; heroes?: Hero[]; monsters?: Monster[]; discardPiles?: GameState['discardPiles']; monsterDeck?: string[]; gameState?: GameState } {
        const result: { spawnedMonsterId?: string | null; heroes?: Hero[]; monsters?: Monster[]; discardPiles?: GameState['discardPiles']; monsterDeck?: string[]; gameState?: GameState } = {};
        let updatedHeroes = [...currentHeroes];
        let updatedMonsters = [...gameState.monsters];
        let updatedDiscardPiles = { ...gameState.discardPiles };

        if (effect.target === 'all_heroes') {
            for (const hero of updatedHeroes) {
                const r = this.applyEffectToTarget(effect, hero, gameState);
                if (r.updatedEntity) {
                    updatedHeroes = updatedHeroes.map(h => h.id === hero.id ? r.updatedEntity as Hero : h);
                }
                if (r.spawnedMonsterId) result.spawnedMonsterId = r.spawnedMonsterId;
                updatedMonsters = r.monsters ?? updatedMonsters;
                updatedDiscardPiles = r.discardPiles ?? updatedDiscardPiles;
            }
        } else if (effect.target === 'all_monsters') {
            for (const monster of updatedMonsters) {
                const r = this.applyEffectToTarget(effect, monster, gameState);
                if (r.updatedEntity) {
                    updatedMonsters = updatedMonsters.map(m => m.id === monster.id ? r.updatedEntity as Monster : m);
                }
                updatedDiscardPiles = r.discardPiles ?? updatedDiscardPiles;
            }
        } else if (effect.type !== 'spawn_monster') {
            const target = effect.target === 'single' && selectedTarget
                ? selectedTarget
                : activeHero;
            const r = this.applyEffectToTarget(effect, target, gameState);
            if (r.updatedEntity) {
                if (target.type === 'hero') {
                    updatedHeroes = updatedHeroes.map(h => h.id === target.id ? r.updatedEntity as Hero : h);
                } else if (target.type === 'monster') {
                    updatedMonsters = updatedMonsters.map(m => m.id === target.id ? r.updatedEntity as Monster : m);
                }
            }
            if (r.spawnedMonsterId) result.spawnedMonsterId = r.spawnedMonsterId;
            updatedMonsters = r.monsters ?? updatedMonsters;
            updatedDiscardPiles = r.discardPiles ?? updatedDiscardPiles;
        }

        if (effect.type === 'spawn_monster') {
            const targetTile = gameState.tiles.find(t => t.x === activeHero.position.x && t.z === activeHero.position.z);
            if (targetTile) {
                let currentDeck = gameState.monsterDeck;
                for (let i = 0; i < (effect.value as number); i++) {
                    const hasStealth = activeHero && activeHero.heroClass === 'rogue' &&
                                      (activeHero.abilities.includes('rogue_stealth') || activeHero.hand.includes('rogue_stealth')) &&
                                      !(activeHero.flippedPowerIds ?? []).includes('rogue_stealth');

                    if (hasStealth) {
                        const monsterTemplateId = currentDeck[0];
                        currentDeck = currentDeck.slice(1);

                        const updatedHero = {
                            ...activeHero,
                            flippedPowerIds: [...(activeHero.flippedPowerIds ?? []), 'rogue_stealth']
                        };
                        updatedHeroes = updatedHeroes.map(h => h.id === updatedHero.id ? updatedHero : h);
                        activeHero = updatedHero;

                        const baseState = result.gameState ?? gameState;
                        const stealthLog = {
                            id: String(baseState.logIdCounter),
                            timestamp: new Date().toISOString(),
                            message: `${activeHero.name} uses Stealth! Discards the drawn monster card (${monsterTemplateId || 'unknown'}) instead of spawning it. Stealth flips face-down.`,
                            type: 'system' as const
                        };
                        result.gameState = {
                            ...baseState,
                            log: [...baseState.log, stealthLog].slice(-100),
                            logIdCounter: (baseState.logIdCounter ?? 0) + 1
                        };
                    } else {
                        // Music of the Damned Environment Check
                        if (gameState.activeEnvironmentCard === 'enc_music_of_the_damned' && currentDeck.length > 1) {
                            const candidate1Id = currentDeck[0];
                            const candidate2Id = currentDeck[1];
                            const template1 = DataLoader.getInstance().getMonsterById(candidate1Id);
                            const template2 = DataLoader.getInstance().getMonsterById(candidate2Id);
                            const xp1 = template1?.experienceValue ?? 1;
                            const xp2 = template2?.experienceValue ?? 1;

                            if (xp1 >= xp2) {
                                currentDeck = [candidate1Id, ...currentDeck.slice(2)];
                                updatedDiscardPiles = {
                                    ...updatedDiscardPiles,
                                    monster: [...(updatedDiscardPiles.monster ?? []), candidate2Id]
                                };
                            } else {
                                currentDeck = [candidate2Id, ...currentDeck.slice(2)];
                                updatedDiscardPiles = {
                                    ...updatedDiscardPiles,
                                    monster: [...(updatedDiscardPiles.monster ?? []), candidate1Id]
                                };
                            }
                        }

                        const spawnResult = this.spawnMonsterOnTile({ ...gameState, monsterDeck: currentDeck }, targetTile);
                        if (spawnResult.monster) {
                            updatedMonsters.push(spawnResult.monster);
                            result.spawnedMonsterId = spawnResult.monster.id;
                        }
                        currentDeck = spawnResult.monsterDeck;
                    }
                }
                result.monsterDeck = currentDeck;
            }
        }

        if (effect.type === 'draw_treasure') {
            const drawResult = TreasureSystem.drawTreasureCard({ ...gameState, discardPiles: updatedDiscardPiles, monsters: updatedMonsters }, activeHero);
            if (drawResult.card) {
                const effectiveHero = updatedHeroes.find(h => h.id === activeHero.id) || activeHero;
                if (drawResult.card.treasureType === 'blessing') {
                    const blessingResult = TreasureSystem.useBlessing(drawResult.newState, drawResult.card, effectiveHero);
                    updatedHeroes = blessingResult.newState.heroes;
                    updatedDiscardPiles = blessingResult.newState.discardPiles;
                } else if (drawResult.card.treasureType === 'fortune') {
                    const fortuneResult = TreasureSystem.useFortune(drawResult.newState, drawResult.card, effectiveHero);
                    updatedHeroes = fortuneResult.newState.heroes;
                    updatedDiscardPiles = fortuneResult.newState.discardPiles;
                } else if (drawResult.card.treasureType === 'item') {
                    const assignResult = TreasureSystem.assignItem(drawResult.newState, drawResult.card, effectiveHero);
                    updatedHeroes = assignResult.newState.heroes;
                    updatedDiscardPiles = assignResult.newState.discardPiles;
                }
            }
        }

        result.heroes = updatedHeroes;
        result.monsters = updatedMonsters;
        result.discardPiles = updatedDiscardPiles;
        return result;
    }

    private static applyEffectToTarget(
        effect: any,
        target: Entity,
        gameState: GameState
    ): { updatedEntity?: Entity; spawnedMonsterId?: string | null; monsters?: Monster[]; discardPiles?: GameState['discardPiles'] } {
        switch (effect.type) {
            case 'damage':
                if (effect.value) {
                    return { updatedEntity: CombatSystem.applyDamage(target, effect.value) };
                }
                break;

            case 'heal':
                if (effect.value) {
                    return { updatedEntity: CombatSystem.applyHealing(target, effect.value) };
                }
                break;

            case 'status_effect':
                if (effect.statusEffect) {
                    return { updatedEntity: ConditionSystem.applyCondition(target, effect.statusEffect!, 'encounter', effect.duration || 1) };
                }
                break;
        }
        return {};
    }

    public static getActiveEnvironmentCard(gameState: GameState): string | null {
        return gameState.activeEnvironmentCard;
    }

    public static removeEnvironmentCard(gameState: GameState): GameState {
        if (gameState.activeEnvironmentCard) {
            const discardPiles = {
                ...gameState.discardPiles,
                encounter: [...(gameState.discardPiles['encounter'] ?? []), gameState.activeEnvironmentCard]
            };
            return { ...gameState, activeEnvironmentCard: null, discardPiles };
        }
        return gameState;
    }

    public static advanceCardResolution(gameState: GameState): GameState {
        const resolution = gameState.cardResolution;
        if (!resolution || !resolution.cardId) {
            return {
                ...gameState,
                cardResolution: { phase: 'idle', cardId: null, cardType: null, targetEntityId: null, pendingEffects: [], resolvedEffects: [], result: null }
            };
        }

        const card = DataLoader.getInstance().getCardById(resolution.cardId);

        switch (resolution.phase) {
            case 'drawing':
                return {
                    ...gameState,
                    cardResolution: { ...resolution, phase: 'revealing' }
                };

            case 'revealing':
                if (!card) return { ...gameState, cardResolution: { ...resolution, phase: 'complete' } };
                return {
                    ...gameState,
                    cardResolution: {
                        ...resolution,
                        phase: 'resolving',
                        pendingEffects: [...(card.effects || [])],
                        resolvedEffects: []
                    }
                };

            case 'resolving': {
                if (!card) return { ...gameState, cardResolution: { ...resolution, phase: 'complete' } };

                const pending = [...(resolution.pendingEffects || [])];
                const resolved = [...(resolution.resolvedEffects || [])];
                const activeEffect = pending.shift();

                if (activeEffect) {
                    const hero = gameState.heroes.find(h => h.id === gameState.currentHeroId);
                    if (hero) {
                        const selectedTarget = resolution.targetEntityId
                            ? [...gameState.heroes, ...gameState.monsters].find(e => e.id === resolution.targetEntityId) ?? null
                            : null;
                        const effectResult = this.applyEffect(activeEffect, [hero], hero, selectedTarget, gameState);
                        resolved.push(activeEffect);

                        const spawnedMonsterId = effectResult.spawnedMonsterId ?? null;

                        const nextPhase = pending.length === 0 ? 'complete' : 'resolving';
                        const updatedHeroes = effectResult.heroes ?? gameState.heroes;
                        const updatedMonsters = effectResult.monsters ?? gameState.monsters;
                        const updatedDiscardPiles = effectResult.discardPiles ?? gameState.discardPiles;

                        return {
                            ...(effectResult.gameState ?? gameState),
                            heroes: updatedHeroes,
                            monsters: updatedMonsters,
                            discardPiles: updatedDiscardPiles,
                            monsterDeck: effectResult.monsterDeck ?? (effectResult.gameState ?? gameState).monsterDeck,
                            cardResolution: {
                                ...resolution,
                                phase: nextPhase,
                                pendingEffects: pending,
                                resolvedEffects: resolved,
                                spawnedMonsterId
                            }
                        };
                    }
                }

                return {
                    ...gameState,
                    cardResolution: {
                        ...resolution,
                        phase: pending.length === 0 ? 'complete' : 'resolving',
                        pendingEffects: pending,
                        resolvedEffects: resolved
                    }
                };
            }

            case 'complete': {
                let newState: GameState = { ...gameState };

                if (card && resolution.cardType === 'encounter') {
                    const discardPiles = { ...newState.discardPiles };
                    if (!discardPiles['encounter']) discardPiles['encounter'] = [];
                    if (!discardPiles['encounter'].includes(card.id)) {
                        discardPiles['encounter'] = [...discardPiles['encounter'], card.id];
                    }
                    newState = { ...newState, discardPiles };

                    const hero = newState.heroes.find(h => h.id === newState.currentHeroId);
                    if (hero) {
                        if (card.encounterType === 'environment') {
                            newState = { ...newState, activeEnvironmentCard: card.id };
                        } else if (card.encounterType === 'trap') {
                            const trapResult = this.placeTrap(newState, card, hero);
                            newState = trapResult.gameState;
                        }
                    }
                }

                return { ...newState, cardResolution: { phase: 'idle', cardId: null, cardType: null, targetEntityId: null, pendingEffects: [], resolvedEffects: [], result: null } };
            }

            default:
                return { ...gameState, cardResolution: { phase: 'idle', cardId: null, cardType: null, targetEntityId: null, pendingEffects: [], resolvedEffects: [], result: null } };
        }
    }

    private static spawnMonsterOnTile(gameState: GameState, tile: Tile): { monster: Monster | null; monsterDeck: string[] } {
        if (gameState.monsterDeck.length === 0) {
            console.error('[EncounterSystem] Monster deck is empty!');
            return { monster: null, monsterDeck: gameState.monsterDeck };
        }

        const deck = [...gameState.monsterDeck];
        const monsterTemplateId = deck.shift();
        if (!monsterTemplateId) return { monster: null, monsterDeck: deck };

        const template = DataLoader.getInstance().getMonsterById(monsterTemplateId);
        if (!template) {
            console.error(`[EncounterSystem] Failed to find monster template: ${monsterTemplateId}`);
            return { monster: null, monsterDeck: deck };
        }

        const uniqueId = `monster_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const newMonster: Monster = {
            ...template,
            id: uniqueId,
            templateId: template.id,
            position: {
                x: tile.x,
                z: tile.z,
                sqX: 2,
                sqZ: 2
            },
            isExhausted: false,
            conditions: [],
            hp: template.hp,
            maxHp: template.maxHp
        };

        return { monster: newMonster, monsterDeck: deck };
    }
}
