import { Card, EncounterType, Entity, GameState, Hero, Monster, Tile, Trap, Direction, Rotation } from '../types';
import { DataLoader } from '../dataLoader';
import { CombatSystem } from './CombatSystem';
import { ConditionSystem } from './ConditionSystem';
import { TreasureSystem } from './TreasureSystem';
import { TileSystem } from './TileSystem';
import { AbilitySystem } from '../ai/AbilitySystem';


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

    public static processEnvironmentCard(
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
        if (card.id === 'enc_cowardly_flight') {
            const activeMonsters = gameState.monsters.filter(m => m.hp > 0 && !m.isDefeated);
            if (activeMonsters.length === 0) {
                const updatedDiscardPiles = {
                    ...gameState.discardPiles,
                    encounter: [...(gameState.discardPiles['encounter'] ?? []), card.id]
                };
                return {
                    success: true,
                    message: `Cowardly Flight discarded because no monsters are in play.`,
                    gameState: { ...gameState, discardPiles: updatedDiscardPiles }
                };
            }

            // Find closest monster
            const manhattanDistance = (p1: any, p2: any) => Math.abs(p1.x - p2.x) + Math.abs(p1.z - p2.z);
            let closestMonster = activeMonsters[0];
            let minDistance = manhattanDistance(activeHero.position, closestMonster.position);
            for (const monster of activeMonsters) {
                const dist = manhattanDistance(activeHero.position, monster.position);
                if (dist < minDistance) {
                    minDistance = dist;
                    closestMonster = monster;
                }
            }

            // Find unexplored edges (exploration points)
            const points = TileSystem.getExplorationPoints(gameState.tiles);
            if (points.length === 0) {
                const updatedDiscardPiles = {
                    ...gameState.discardPiles,
                    encounter: [...(gameState.discardPiles['encounter'] ?? []), card.id]
                };
                return {
                    success: true,
                    message: `Cowardly Flight discarded because there are no unexplored edges.`,
                    gameState: { ...gameState, discardPiles: updatedDiscardPiles }
                };
            }

            // Find point closest to active hero
            let closestPoint = points[0];
            let closestPointTile = gameState.tiles.find(t => t.id === closestPoint.tileId)!;
            let minPointDist = manhattanDistance(activeHero.position, { x: closestPointTile.x, z: closestPointTile.z });
            for (const pt of points) {
                const pointTile = gameState.tiles.find(t => t.id === pt.tileId)!;
                const dist = manhattanDistance(activeHero.position, { x: pointTile.x, z: pointTile.z });
                if (dist < minPointDist) {
                    minPointDist = dist;
                    closestPoint = pt;
                }
            }

            // Draw a tile from the bottom of the stack
            const drawResult = TileSystem.drawAndPlaceFromBottom(gameState, closestPoint);
            if (!drawResult.tile) {
                const updatedDiscardPiles = {
                    ...gameState.discardPiles,
                    encounter: [...(gameState.discardPiles['encounter'] ?? []), card.id]
                };
                return {
                    success: true,
                    message: `Cowardly Flight: No bottom tile could fit the unexplored edge. Discarded.`,
                    gameState: { ...gameState, discardPiles: updatedDiscardPiles }
                };
            }

            const parentTile = gameState.tiles.find(t => t.id === closestPoint.tileId)!;
            const targetCoords = TileSystem.getTargetCoords(parentTile.x, parentTile.z, closestPoint.edge);
            const rotation = drawResult.validRotations[0];

            const newTileInstance: Tile = {
                ...drawResult.tile,
                id: `${drawResult.tile.id}_${Math.random().toString(36).substr(2, 5)}`,
                x: targetCoords.x,
                z: targetCoords.z,
                rotation,
                isRevealed: true,
                monsters: [closestMonster.id],
                heroes: [],
                items: []
            };

            let updatedTiles = TileSystem.connectTiles(gameState.tiles, parentTile, newTileInstance, closestPoint.edge);

            updatedTiles = updatedTiles.map(t => {
                if (t.id === newTileInstance.id) return t;
                return {
                    ...t,
                    monsters: t.monsters.filter(id => id !== closestMonster.id)
                };
            });

            const updatedMonsters = gameState.monsters.map(m => {
                if (m.id === closestMonster.id) {
                    return {
                        ...m,
                        position: {
                            x: newTileInstance.x,
                            z: newTileInstance.z,
                            sqX: 1,
                            sqZ: 1
                        }
                    };
                }
                return m;
            });

            const updatedDiscardPiles = {
                ...gameState.discardPiles,
                encounter: [...(gameState.discardPiles['encounter'] ?? []), card.id]
            };

            return {
                success: true,
                message: `Cowardly Flight: ${closestMonster.name} fled to a new tile placed at (${newTileInstance.x}, ${newTileInstance.z}).`,
                gameState: {
                    ...gameState,
                    tiles: updatedTiles,
                    monsters: updatedMonsters,
                    dungeonDeck: drawResult.remainingDeck,
                    discardPiles: updatedDiscardPiles
                }
            };
        }

        if (card.id === 'enc_spirit_of_doom_event') {
            let updatedHeroes = [...gameState.heroes];
            let updatedTiles = [...gameState.tiles];
            const manhattanDistance = (p1: any, p2: any) => Math.abs(p1.x - p2.x) + Math.abs(p1.z - p2.z);

            for (const hero of updatedHeroes) {
                const currentTile = updatedTiles.find(t => t.heroes.includes(hero.id));
                if (!currentTile) continue;

                const monstersOnTile = gameState.monsters.filter(m => m.hp > 0 && !m.isDefeated && m.position.x === currentTile.x && m.position.z === currentTile.z);
                if (monstersOnTile.length > 0) {
                    continue;
                }

                const monsterTiles = updatedTiles.filter(t => {
                    const activeMonsters = gameState.monsters.filter(m => m.hp > 0 && !m.isDefeated && m.position.x === t.x && m.position.z === t.z);
                    return activeMonsters.length > 0;
                });

                if (monsterTiles.length > 0) {
                    let closestMonsterTile = monsterTiles[0];
                    let minDistance = manhattanDistance({ x: currentTile.x, z: currentTile.z }, { x: closestMonsterTile.x, z: closestMonsterTile.z });
                    for (const mt of monsterTiles) {
                        const dist = manhattanDistance({ x: currentTile.x, z: currentTile.z }, { x: mt.x, z: mt.z });
                        if (dist < minDistance) {
                            minDistance = dist;
                            closestMonsterTile = mt;
                        }
                    }

                    if (minDistance <= hero.speed) {
                        updatedTiles = updatedTiles.map(t => {
                            if (t.id === currentTile.id) {
                                return { ...t, heroes: t.heroes.filter(id => id !== hero.id) };
                            }
                            if (t.id === closestMonsterTile.id) {
                                return { ...t, heroes: [...t.heroes, hero.id] };
                            }
                            return t;
                        });
                        updatedHeroes = updatedHeroes.map(h => {
                            if (h.id === hero.id) {
                                return { ...h, position: { ...h.position, x: closestMonsterTile.x, z: closestMonsterTile.z } };
                            }
                            return h;
                        });
                    }
                }
            }

            let logMessages: string[] = [];
            updatedHeroes = updatedHeroes.map(hero => {
                const heroTile = updatedTiles.find(t => t.heroes.includes(hero.id));
                if (heroTile) {
                    const activeMonsters = gameState.monsters.filter(m => m.hp > 0 && !m.isDefeated && m.position.x === heroTile.x && m.position.z === heroTile.z);
                    if (activeMonsters.length === 0) {
                        const damaged = CombatSystem.applyDamage(hero, 1) as Hero;
                        logMessages.push(`${hero.name} takes 1 damage on tile with no monsters.`);
                        return damaged;
                    }
                }
                return hero;
            });

            const updatedDiscardPiles = {
                ...gameState.discardPiles,
                encounter: [...(gameState.discardPiles['encounter'] ?? []), card.id]
            };

            return {
                success: true,
                message: `Spirit of Doom resolved. ` + (logMessages.length > 0 ? logMessages.join(' ') : 'No heroes took damage.'),
                gameState: {
                    ...gameState,
                    tiles: updatedTiles,
                    heroes: updatedHeroes,
                    discardPiles: updatedDiscardPiles
                }
            };
        }

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
        const results: any[] = [];
        let updatedHeroes = [...gameState.heroes];

        for (const effect of card.effects) {
            if (effect.type === 'damage') {
                const attackBonus = effect.attackBonus ?? 7;
                const damage = effect.value || 1;

                 if (effect.target === 'all_heroes') {
                    for (const hero of updatedHeroes) {
                        const result = CombatSystem.resolveAttack(
                            { id: 'event', name: card.name, type: 'monster' as const, hp: 0, maxHp: 0, ac: 0, speed: 0, isExhausted: false, position: hero.position, conditions: [], usedPowers: [] },
                            hero,
                            attackBonus,
                            damage,
                            0,
                            undefined,
                            gameState
                        );
                        if (result.damage > 0) {
                            const updated = CombatSystem.applyDamage(hero, result.damage);
                            updatedHeroes = updatedHeroes.map(h => h.id === hero.id ? updated : h);
                        }
                        results.push({ heroId: hero.id, hit: result.hit, damage: result.damage });
                    }
                } else {
                    const result = CombatSystem.resolveAttack(
                        { id: 'event', name: card.name, type: 'monster' as const, hp: 0, maxHp: 0, ac: 0, speed: 0, isExhausted: false, position: activeHero.position, conditions: [], usedPowers: [] },
                        activeHero,
                        attackBonus,
                        damage,
                        0,
                        undefined,
                        gameState
                    );
                    if (result.damage > 0) {
                        const updated = CombatSystem.applyDamage(activeHero, result.damage);
                        updatedHeroes = updatedHeroes.map(h => h.id === activeHero.id ? updated : h);
                    }
                    results.push({ heroId: activeHero.id, hit: result.hit, damage: result.damage });
                }
            }
        }

        const updatedDiscardPiles = {
            ...gameState.discardPiles,
            encounter: [...(gameState.discardPiles['encounter'] ?? []), card.id]
        };

        return {
            success: true,
            message: `Event-attack card ${card.name} resolved.`,
            results,
            gameState: { ...gameState, heroes: updatedHeroes, discardPiles: updatedDiscardPiles }
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
        if (trap.isDisabled) {
            return { success: false, message: 'Trap is disabled', results: [], gameState };
        }

        const results: any[] = [];
        let updatedHeroes = [...gameState.heroes];

        const heroesOnTile = gameState.heroes.filter(h =>
            h.position.x === trap.position?.x && h.position.z === trap.position?.z
        );

        for (const hero of heroesOnTile) {
            for (const effect of card.effects) {
                if (effect.type === 'damage') {
                    const attackBonus = effect.attackBonus ?? 7;
                    const damage = effect.value || 1;

                    const result = CombatSystem.resolveAttack(
                        { id: 'trap', name: card.name, type: 'monster' as const, hp: 0, maxHp: 0, ac: 0, speed: 0, isExhausted: false, position: hero.position, conditions: [], usedPowers: [] },
                        hero,
                        attackBonus,
                        damage
                    );
                    if (result.damage > 0) {
                        const updated = CombatSystem.applyDamage(hero, result.damage);
                        updatedHeroes = updatedHeroes.map(h => h.id === hero.id ? updated : h);
                    }
                    results.push({ heroId: hero.id, hit: result.hit, damage: result.damage });
                } else if (effect.type === 'status_effect' && effect.statusEffect) {
                    const updated = ConditionSystem.applyCondition(hero, effect.statusEffect!, trap.id, effect.duration || 1);
                    updatedHeroes = updatedHeroes.map(h => h.id === hero.id ? updated : h);
                    results.push({ heroId: hero.id, statusEffect: effect.statusEffect });
                }
            }
        }

        return {
            success: true,
            message: `Trap ${card.name} activated.`,
            results,
            gameState: { ...gameState, heroes: updatedHeroes }
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
        const disableDC = card.disableDC || 10;

        if (roll >= disableDC) {
            const updatedTraps = gameState.traps.filter(t => t.id !== trap.id);
            const updatedDiscardPiles = {
                ...gameState.discardPiles,
                encounter: [...(gameState.discardPiles['encounter'] ?? []), card.id]
            };

            return {
                success: true,
                message: `${hero.name} disabled the trap! (Roll: ${roll}, DC: ${disableDC})`,
                disabled: true,
                gameState: { ...gameState, traps: updatedTraps, discardPiles: updatedDiscardPiles }
            };
        } else {
            return {
                success: false,
                message: `${hero.name} failed to disable the trap. (Roll: ${roll}, DC: ${disableDC})`,
                disabled: false,
                gameState
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
                    const spawnResult = this.spawnMonsterOnTile({ ...gameState, monsterDeck: currentDeck }, targetTile);
                    if (spawnResult.monster) {
                        updatedMonsters.push(spawnResult.monster);
                        result.spawnedMonsterId = spawnResult.monster.id;
                    }
                    currentDeck = spawnResult.monsterDeck;
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
                            ...gameState,
                            heroes: updatedHeroes,
                            monsters: updatedMonsters,
                            discardPiles: updatedDiscardPiles,
                            monsterDeck: effectResult.monsterDeck ?? gameState.monsterDeck,
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
