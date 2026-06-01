import { Card, Effect, Entity, GameState, Hero, ActiveBlessing, TileEffect, DeckSentinel, Monster } from '../types';
import { CombatSystem } from './CombatSystem';
import { ConditionSystem } from './ConditionSystem';
import { ExperienceSystem } from './ExperienceSystem';
import { PowerSystem } from './PowerSystem';
import { DataLoader } from '../dataLoader';

const SENTINEL_MOMENTS_RESPIRE: DeckSentinel = 'sentinel_moments_respite';

/**
 * Treasure System - Manages Blessings, Fortunes, and Items (Cards 151–200).
 * All methods are pure functions — GameState and Hero are never mutated in place.
 *
 * Rules:
 * - Blessings (151–155):  Played immediately, last until end of drawing hero's NEXT turn,
 *                          benefit all heroes while active.
 * - Fortunes (156–175):   Played immediately, immediate one-time effect, discarded.
 * - Items (176–200):      Assigned to one hero permanently, provide passive or activatable effects.
 */
export class TreasureSystem {

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private static addToDiscard(
    piles: GameState['discardPiles'],
    key: string,
    cardId: string
  ): GameState['discardPiles'] {
    const pile = piles[key] ?? [];
    return { ...piles, [key]: [...pile, cardId] };
  }

  private static applyEffect(
    effect: Effect,
    hero: Hero,
    target: Entity | null,
    gameState: GameState
  ): { updatedHero: Hero; updatedTarget: Entity | null } {
    switch (effect.type) {
      case 'damage':
        if (target) {
          return { updatedHero: hero, updatedTarget: CombatSystem.applyDamage(target, typeof effect.value === 'number' ? effect.value : 0) };
        }
        return { updatedHero: hero, updatedTarget: target };

      case 'heal':
        if (effect.value) {
          return { updatedHero: CombatSystem.applyHealing(hero, typeof effect.value === 'number' ? effect.value : 0), updatedTarget: target };
        }
        return { updatedHero: hero, updatedTarget: target };

      case 'status_effect':
        if (target && effect.statusEffect) {
          return {
            updatedHero: hero,
            updatedTarget: ConditionSystem.applyCondition(target, effect.statusEffect as any, hero.id, effect.duration ?? 1)
          };
        }
        return { updatedHero: hero, updatedTarget: target };

      case 'flip_power':
        if (effect.value !== undefined) {
          PowerSystem.resetPower(hero, String(effect.value));
          return { updatedHero: hero, updatedTarget: target };
        }
        return { updatedHero: hero, updatedTarget: target };

      case 'draw_card':
        return { updatedHero: hero, updatedTarget: target };

      case 'passive':
        return { updatedHero: hero, updatedTarget: target };

      default:
        return { updatedHero: hero, updatedTarget: target };
    }
  }

  // ---------------------------------------------------------------------------
  // Treasure draw
  // ---------------------------------------------------------------------------

  /**
   * Draws a treasure card from the top of the deck.
   * Only one treasure per turn maximum.
   * Returns the card and a new GameState with the deck and counter updated.
   */
  public static drawTreasureCard(
    gameState: GameState,
    hero: Hero
  ): { card: Card | null; newState: GameState; message: string } {
    if (gameState.treasuresDrawnThisTurn >= 1) {
      return {
        card: null,
        newState: gameState,
        message: 'Already drawn a treasure card this turn. Maximum one per turn.'
      };
    }

    if (gameState.treasureDeck.length === 0) {
      return { card: null, newState: gameState, message: 'Treasure deck is empty' };
    }

    const deck = [...gameState.treasureDeck];
    const cardId = deck.pop();
    if (!cardId) {
      return { card: null, newState: gameState, message: 'Failed to draw treasure card' };
    }

    const rawCard = DataLoader.getInstance().getCardById(cardId);
    const card: Card = rawCard ? { ...rawCard } : {
      id: cardId,
      type: 'treasure',
      name: 'Treasure (Unknown)',
      description: 'A mysterious artifact found in the dungeon.',
      effects: [],
      treasureType: 'item'
    };

    if (!card.treasureType) {
      if (card.type === 'consumable') card.treasureType = 'fortune';
      else card.treasureType = 'item';
    }

    return {
      card,
      newState: { ...gameState, treasureDeck: deck, treasuresDrawnThisTurn: gameState.treasuresDrawnThisTurn + 1 },
      message: `${hero.name} draws treasure: ${card.name}`
    };
  }

  // ---------------------------------------------------------------------------
  // Blessings (Cards 151–155)
  // ---------------------------------------------------------------------------

  /**
   * Uses a blessing treasure card.
   * Blessings are played immediately, apply to ALL heroes, and last until the
   * end of the drawing hero's NEXT turn.
   * Returns a new GameState with effects applied and activeBlessing set.
   */
  public static useBlessing(
    gameState: GameState,
    card: Card,
    hero: Hero
  ): { newState: GameState; message: string; success: boolean } {
    if (card.treasureType !== 'blessing') {
      return { newState: gameState, message: 'Not a blessing card', success: false };
    }

    let updatedHeroes = [...gameState.heroes];

    for (const effect of card.effects) {
      updatedHeroes = updatedHeroes.map(h => {
        const { updatedHero } = TreasureSystem.applyEffect(effect, h, null, gameState);
        return updatedHero;
      });
    }

    const blessing: ActiveBlessing = {
      cardId: card.id,
      heroId: hero.id,
      expiresAfterTurnOf: hero.id,
      effects: card.effects,
      name: card.name,
    };

    return {
      newState: {
        ...gameState,
        heroes: updatedHeroes,
        activeBlessing: blessing,
        discardPiles: TreasureSystem.addToDiscard(gameState.discardPiles, 'treasure', card.id)
      },
      message: `Blessing ${card.name} activated! Effects apply to all heroes until the end of ${hero.name}'s next turn.`,
      success: true
    };
  }

  /**
   * Expires the active blessing — called at the START of the drawing hero's next turn.
   * Returns a new GameState with activeBlessing cleared.
   */
  public static expireBlessing(gameState: GameState): { newState: GameState; message: string } {
    const blessing = gameState.activeBlessing;
    if (!blessing) {
      return { newState: gameState, message: 'No active blessing to expire.' };
    }

    return {
      newState: {
        ...gameState,
        activeBlessing: null,
      },
      message: `Blessing ${blessing.name} has expired.`,
    };
  }

  /**
   * Checks if the active blessing should expire for the given hero turn start.
   * Returns a new GameState (possibly with blessing expired).
   */
  public static checkBlessingExpiry(
    gameState: GameState,
    heroId: string
  ): { newState: GameState; expired: boolean; message: string } {
    const blessing = gameState.activeBlessing;
    if (!blessing) {
      return { newState: gameState, expired: false, message: '' };
    }

    if (blessing.expiresAfterTurnOf === heroId) {
      return {
        ...TreasureSystem.expireBlessing(gameState),
        expired: true,
      };
    }

    return { newState: gameState, expired: false, message: '' };
  }

  // ---------------------------------------------------------------------------
  // Fortunes (Cards 156–175)
  // ---------------------------------------------------------------------------

  /**
   * Uses a fortune treasure card.
   * Special-case handlers for known fortune IDs, otherwise applies generic effects.
   */
  public static useFortune(
    gameState: GameState,
    card: Card,
    hero: Hero
  ): { newState: GameState; message: string; success: boolean } {
    if (card.treasureType !== 'fortune') {
      return { newState: gameState, message: 'Not a fortune card', success: false };
    }

    switch (card.id) {
      case 'fortune_action_surge':
        return TreasureSystem.processActionSurge(gameState, card, hero);
      case 'fortune_breath_of_life':
        return TreasureSystem.processBreathOfLife(gameState, card, hero);
      case 'fortune_level_up':
        return TreasureSystem.processFortuneLevelUp(gameState, card, hero);
      case 'fortune_short_rest':
        return TreasureSystem.processShortRest(gameState, card, hero);
      case 'fortune_moments_respite_encounter':
        return TreasureSystem.processMomentsRespite(gameState, card, hero, 'encounterDeck');
      case 'fortune_moments_respite_monster':
        return TreasureSystem.processMomentsRespite(gameState, card, hero, 'monsterDeck');
      default:
        return TreasureSystem.processGenericFortune(gameState, card, hero);
    }
  }

  /**
   * Generic fortune handler — applies the card's effects directly to the hero.
   */
  private static processGenericFortune(
    gameState: GameState,
    card: Card,
    hero: Hero
  ): { newState: GameState; message: string; success: boolean } {
    let updatedHero = hero;
    let hasEffect = false;

    for (const effect of card.effects) {
      const { updatedHero: newHero } = TreasureSystem.applyEffect(effect, updatedHero, null, gameState);
      if (newHero !== updatedHero) hasEffect = true;
      updatedHero = newHero;
    }

    const updatedHeroes = gameState.heroes.map(h => h.id === hero.id ? updatedHero : h);

    return {
      newState: {
        ...gameState,
        heroes: updatedHeroes,
        discardPiles: TreasureSystem.addToDiscard(gameState.discardPiles, 'treasure', card.id)
      },
      message: hasEffect
        ? `Fortune ${card.name} used and discarded.`
        : `Fortune ${card.name} used but had no effect.`,
      success: true
    };
  }

  /**
   * Action Surge: Resets hasAttackedThisTurn to false, allowing a second action.
   */
  private static processActionSurge(
    gameState: GameState,
    card: Card,
    hero: Hero
  ): { newState: GameState; message: string; success: boolean } {
    return {
      newState: {
        ...gameState,
        hasAttackedThisTurn: false,
        discardPiles: TreasureSystem.addToDiscard(gameState.discardPiles, 'treasure', card.id)
      },
      message: `${hero.name} uses Action Surge and may act again!`,
      success: true,
    };
  }

  /**
   * Breath of Life: Heals a downed hero (0 HP) immediately.
   * Targets the most injured hero if none is at exactly 0.
   */
  private static processBreathOfLife(
    gameState: GameState,
    card: Card,
    hero: Hero
  ): { newState: GameState; message: string; success: boolean } {
    const downedHero = gameState.heroes.find(h => h.hp <= 0 && !h.escaped);
    const target = downedHero ?? gameState.heroes.reduce((a, b) => a.hp < b.hp ? a : b);

    const healAmount = 2;
    const healedHero = CombatSystem.applyHealing(target, healAmount);
    const updatedHeroes = gameState.heroes.map(h =>
      h.id === healedHero.id ? healedHero : h
    );

    return {
      newState: {
        ...gameState,
        heroes: updatedHeroes,
        discardPiles: TreasureSystem.addToDiscard(gameState.discardPiles, 'treasure', card.id)
      },
      message: `Breath of Life restores ${healAmount} HP to ${healedHero.name}!`,
      success: true,
    };
  }

  /**
   * Level Up (fortune): Allows leveling up without a natural-20 roll.
   */
  private static processFortuneLevelUp(
    gameState: GameState,
    card: Card,
    hero: Hero
  ): { newState: GameState; message: string; success: boolean } {
    if (hero.level >= 2) {
      return {
        newState: {
          ...gameState,
          discardPiles: TreasureSystem.addToDiscard(gameState.discardPiles, 'treasure', card.id)
        },
        message: `${hero.name} is already at max level. Fortune discarded.`,
        success: true,
      };
    }

    if (!ExperienceSystem.canLevelUp(gameState, hero)) {
      return {
        newState: {
          ...gameState,
          discardPiles: TreasureSystem.addToDiscard(gameState.discardPiles, 'treasure', card.id)
        },
        message: `Not enough XP to level up. ${hero.name} needs 5 XP worth of monster cards. Fortune discarded.`,
        success: true,
      };
    }

    // Delegate XP spending and stat upgrades to ExperienceSystem.levelUpHero
    const levelResult = ExperienceSystem.levelUpHero(gameState, hero);
    if (!levelResult.success) {
      return {
        newState: {
          ...gameState,
          discardPiles: TreasureSystem.addToDiscard(gameState.discardPiles, 'treasure', card.id)
        },
        message: `Failed to level up: ${levelResult.message}`,
        success: true,
      };
    }

    // Also discard the fortune card
    const newState = {
      ...levelResult.newState,
      discardPiles: TreasureSystem.addToDiscard(levelResult.newState.discardPiles, 'treasure', card.id),
    };

    return {
      newState,
      message: levelResult.message,
      success: true,
    };
  }

  /**
   * Short Rest: Refreshes one used Daily or Utility power for the hero.
   */
  private static processShortRest(
    gameState: GameState,
    card: Card,
    hero: Hero
  ): { newState: GameState; message: string; success: boolean } {
    const flippedIds = hero.flippedPowerIds ?? [];
    if (flippedIds.length === 0) {
      return {
        newState: {
          ...gameState,
          discardPiles: TreasureSystem.addToDiscard(gameState.discardPiles, 'treasure', card.id)
        },
        message: `${hero.name} has no flipped powers to refresh. Short Rest discarded.`,
        success: true,
      };
    }

    const powerId = flippedIds[flippedIds.length - 1];
    const updatedHero = { ...hero, flippedPowerIds: flippedIds.filter(id => id !== powerId) };
    const updatedHeroes = gameState.heroes.map(h => h.id === hero.id ? updatedHero : h);

    const powerCard = DataLoader.getInstance().getCardById(powerId);

    return {
      newState: {
        ...gameState,
        heroes: updatedHeroes,
        discardPiles: TreasureSystem.addToDiscard(gameState.discardPiles, 'treasure', card.id)
      },
      message: `${hero.name} takes a Short Rest and refreshes ${powerCard?.name ?? powerId}!`,
      success: true,
    };
  }

  /**
   * Moment's Respite: Places a sentinel at the top of the specified deck,
   * nullifying the next draw from that deck.
   */
  private static processMomentsRespite(
    gameState: GameState,
    card: Card,
    hero: Hero,
    deckName: 'encounterDeck' | 'monsterDeck'
  ): { newState: GameState; message: string; success: boolean } {
    const currentDeck = [...(gameState[deckName] || [])];
    currentDeck.unshift(SENTINEL_MOMENTS_RESPIRE);

    const deckUpdate = { [deckName]: currentDeck };

    return {
      newState: {
        ...gameState,
        ...deckUpdate,
        discardPiles: TreasureSystem.addToDiscard(gameState.discardPiles, 'treasure', card.id)
      },
      message: `${hero.name} uses Moment's Respite! The next ${deckName === 'encounterDeck' ? 'Encounter' : 'Monster'} draw is skipped.`,
      success: true,
    };
  }

  /**
   * Checks if the top card of a deck is a Moment's Respite sentinel.
   * If so, removes and discards it, returning true (indicating the draw should be skipped).
   */
  public static checkAndDiscardRespite(
    gameState: GameState,
    deckName: 'encounterDeck' | 'monsterDeck' | 'treasureDeck'
  ): { gameState: GameState; wasRespite: boolean } {
    const deck = gameState[deckName];
    if (!deck || deck.length === 0) {
      return { gameState, wasRespite: false };
    }

    if (deck[0] === SENTINEL_MOMENTS_RESPIRE) {
      const updatedDeck = deck.slice(1);
      return {
        gameState: {
          ...gameState,
          [deckName]: updatedDeck,
        },
        wasRespite: true,
      };
    }

    return { gameState, wasRespite: false };
  }

  // ---------------------------------------------------------------------------
  // Items (Cards 176–200)
  // ---------------------------------------------------------------------------

  /**
   * Assigns an item treasure card to a hero.
   * Items are assigned to one hero permanently and cannot be transferred.
   */
  public static assignItem(
    gameState: GameState,
    card: Card,
    hero: Hero
  ): { newState: GameState; message: string; success: boolean } {
    if (card.treasureType !== 'item') {
      return { newState: gameState, message: 'Not an item card', success: false };
    }

    const updatedHero: Hero = { ...hero, items: [...hero.items, card.id] };
    const updatedHeroes = gameState.heroes.map(h => h.id === hero.id ? updatedHero : h);

    // Initialize charges for multi-use items (Necklace of Fireballs)
    const itemCharges = { ...(gameState.itemCharges ?? {}) };
    if (card.id === 'item_necklace_fireballs' && !itemCharges[card.id]) {
      itemCharges[card.id] = 3;
    }

    return {
      newState: {
        ...gameState,
        heroes: updatedHeroes,
        itemCharges,
      },
      message: `Item ${card.name} assigned to ${hero.name}.`,
      success: true
    };
  }

  /**
   * Uses an item treasure card (for active/consumable effects).
   * Returns a new GameState with effects applied and consumables removed from inventory.
   */
  public static useItem(
    gameState: GameState,
    card: Card,
    hero: Hero,
    target: Entity | null = null
  ): { newState: GameState; message: string; success: boolean } {
    if (card.treasureType !== 'item') {
      return { newState: gameState, message: 'Not an item card', success: false };
    }

    if (!hero.items.includes(card.id)) {
      return { newState: gameState, message: 'Hero does not own this item', success: false };
    }

    // Handle special item effects
    if (card.id === 'item_necklace_fireballs') {
      return TreasureSystem.useNecklaceOfFireballs(gameState, card, hero, target);
    }
    if (card.id === 'item_glyph_warding') {
      return TreasureSystem.placeGlyphOfWarding(gameState, card, hero);
    }

    let updatedHero = hero;
    let updatedTarget = target;

    for (const effect of card.effects) {
      if (effect.type === 'passive') continue;
      const result = TreasureSystem.applyEffect(effect, updatedHero, updatedTarget, gameState);
      updatedHero = result.updatedHero;
      updatedTarget = result.updatedTarget;
    }

    const isConsumable = card.type === 'consumable';
    if (isConsumable) {
      updatedHero = { ...updatedHero, items: updatedHero.items.filter(id => id !== card.id) };
    }

    let updatedHeroes = gameState.heroes.map(h => h.id === hero.id ? updatedHero : h);
    let updatedMonsters = [...gameState.monsters];

    if (updatedTarget && updatedTarget !== target) {
      if (updatedTarget.type === 'monster') {
        updatedMonsters = gameState.monsters.map(m =>
          m.id === updatedTarget!.id ? updatedTarget as Monster : m
        );
      } else if (updatedTarget.type === 'hero') {
        updatedHeroes = updatedHeroes.map(h =>
          h.id === updatedTarget!.id ? updatedTarget as Hero : h
        );
      }
    }

    return {
      newState: { ...gameState, heroes: updatedHeroes, monsters: updatedMonsters },
      message: `Item ${card.name} used by ${hero.name}.${isConsumable ? ' Item consumed.' : ''}`,
      success: true
    };
  }

  /**
   * Necklace of Fireballs: multi-use ranged fire attack (3 charges).
   * Deals 1 damage to all monsters on the target tile.
   */
  private static useNecklaceOfFireballs(
    gameState: GameState,
    card: Card,
    hero: Hero,
    target: Entity | null
  ): { newState: GameState; message: string; success: boolean } {
    const charges = gameState.itemCharges?.[card.id] ?? 3;
    if (charges <= 0) {
      return { newState: gameState, message: 'Necklace of Fireballs has no charges remaining.', success: false };
    }

    const newCharges = charges - 1;
    const itemCharges = { ...(gameState.itemCharges ?? {}), [card.id]: newCharges };

    let updatedMonsters = [...gameState.monsters];
    let logMessages: string[] = [];

    if (target) {
      // AoE damage to all monsters on the target's tile
      const targetTile = gameState.tiles.find(t =>
        t.x === (target as Monster).position.x && t.z === (target as Monster).position.z
      );
      if (targetTile) {
        const monstersOnTile = gameState.monsters.filter(m =>
          m.position.x === targetTile.x && m.position.z === targetTile.z && m.hp > 0 && !m.isDefeated
        );
        for (const monster of monstersOnTile) {
          const damaged = CombatSystem.applyDamage(monster as any, 1);
          updatedMonsters = updatedMonsters.map(m => m.id === monster.id ? { ...damaged } as Monster : m);
          logMessages.push(`${monster.name} takes 1 fire damage`);
        }
      }
    }

    // Remove item if all charges expended
    let updatedHero = hero;
    if (newCharges <= 0) {
      updatedHero = { ...updatedHero, items: updatedHero.items.filter(id => id !== card.id) };
    }
    const updatedHeroes = gameState.heroes.map(h => h.id === hero.id ? updatedHero : h);

    return {
      newState: {
        ...gameState,
        heroes: updatedHeroes,
        monsters: updatedMonsters,
        itemCharges,
      },
      message: `Necklace of Fireballs used! (${newCharges} charges remaining). ${logMessages.join('; ')}`,
      success: true,
    };
  }

  /**
   * Places a Glyph of Warding on the hero's current tile.
   * Monsters entering the tile trigger the glyph.
   */
  private static placeGlyphOfWarding(
    gameState: GameState,
    card: Card,
    hero: Hero
  ): { newState: GameState; message: string; success: boolean } {
    const heroTile = gameState.tiles.find(t =>
      t.x === hero.position.x && t.z === hero.position.z
    );
    if (!heroTile) {
      return { newState: gameState, message: 'Hero must be on a tile to place a glyph.', success: false };
    }

    const glyph: TileEffect = {
      id: `glyph_${crypto.randomUUID()}`,
      tileId: heroTile.id,
      type: 'glyph_warding',
      heroId: hero.id,
      cardId: card.id,
      isExpended: false,
      description: 'Monsters cannot enter this tile (Glyph of Warding).',
    };

    const tileEffects = [...(gameState.tileEffects ?? []), glyph];
    const updatedHero = { ...hero, items: hero.items.filter(id => id !== card.id) };
    const updatedHeroes = gameState.heroes.map(h => h.id === hero.id ? updatedHero : h);

    return {
      newState: {
        ...gameState,
        heroes: updatedHeroes,
        tileEffects,
      },
      message: `${hero.name} places a Glyph of Warding on ${heroTile.name}!`,
      success: true,
    };
  }

  // ---------------------------------------------------------------------------
  // Item Bonuses & Stat computation
  // ---------------------------------------------------------------------------

  /**
   * Computes all passive item bonuses for a hero.
   * Handles: attack_bonus, defense_bonus, damage_bonus, ac_bonus → defense,
   * speed_bonus → speedBonus.
   */
  public static getHeroItemBonuses(
    hero: Hero,
    allCards: Card[]
  ): { attackBonus: number; defenseBonus: number; damageBonus: number; speedBonus: number; specialAbilities: (string | undefined)[] } {
    const bonuses = { attackBonus: 0, defenseBonus: 0, damageBonus: 0, speedBonus: 0, specialAbilities: [] as (string | undefined)[] };

    for (const itemId of hero.items) {
      const card = allCards.find(c => c.id === itemId);
      if (!card) continue;

      for (const effect of card.effects) {
        if (effect.type === 'attack_bonus') {
          bonuses.attackBonus += typeof effect.value === 'number' ? effect.value : 0;
        } else if (effect.type === 'defense_bonus') {
          bonuses.defenseBonus += typeof effect.value === 'number' ? effect.value : 0;
        } else if (effect.type === 'damage_bonus') {
          bonuses.damageBonus += typeof effect.value === 'number' ? effect.value : 0;
        } else if (effect.type === 'ac_bonus') {
          bonuses.defenseBonus += typeof effect.value === 'number' ? effect.value : 0;
        } else if (effect.type === 'speed_bonus') {
          bonuses.speedBonus += typeof effect.value === 'number' ? effect.value : 0;
        } else if (effect.type === 'passive') {
          bonuses.specialAbilities.push(effect.passiveType);
        }
      }
    }

    return bonuses;
  }

  /**
   * Gets effective stats for a hero including item bonuses. (Read-only.)
   */
  public static getEffectiveStats(
    hero: Hero,
    allCards: Card[]
  ): { ac: number; attackBonus: number; damage: number; speed: number } {
    const bonuses = this.getHeroItemBonuses(hero, allCards);
    return {
      ac: hero.ac + bonuses.defenseBonus,
      attackBonus: bonuses.attackBonus,
      damage: bonuses.damageBonus,
      speed: hero.speed + bonuses.speedBonus,
    };
  }

  /**
   * Checks if a hero has a specific passive ability from items. (Read-only.)
   */
  public static hasPassiveAbility(hero: Hero, abilityType: string, allCards: Card[]): boolean {
    const bonuses = this.getHeroItemBonuses(hero, allCards);
    return bonuses.specialAbilities.includes(abilityType);
  }

  /**
   * Gets all item cards owned by a hero. (Read-only.)
   */
  public static getHeroItems(hero: Hero, allCards: Card[]): Card[] {
    return allCards.filter(card => hero.items.includes(card.id));
  }

  // ---------------------------------------------------------------------------
  // Ring of Regeneration — passive turn-start heal
  // ---------------------------------------------------------------------------

  /**
   * Processes passive item effects at the start of a hero's turn.
   * Currently handles: Ring of Regeneration (heal 1 HP at turn start).
   */
  public static processTurnStartPassiveEffects(
    gameState: GameState,
    hero: Hero
  ): { newState: GameState; message: string; didProc: boolean } {
    const allCards = DataLoader.getInstance().getAllCards();
    const hasRegen = TreasureSystem.hasPassiveAbility(hero, 'regeneration', allCards);

    if (!hasRegen) {
      return { newState: gameState, message: '', didProc: false };
    }

    const healedHero = CombatSystem.applyHealing(hero, 1);
    const updatedHeroes = gameState.heroes.map(h => h.id === hero.id ? healedHero : h);

    return {
      newState: { ...gameState, heroes: updatedHeroes },
      message: `♻️ ${hero.name}'s Ring of Regeneration restores 1 HP.`,
      didProc: true,
    };
  }

  // ---------------------------------------------------------------------------
  // Crystal Ball — deck preview
  // ---------------------------------------------------------------------------

  /**
   * Preview the top N cards of a deck without consuming them. (Read-only.)
   * Crystal Ball allows the player to see the top 1–3 cards of any deck.
   */
  public static previewDeck(
    gameState: GameState,
    deckName: 'encounterDeck' | 'monsterDeck' | 'treasureDeck' | 'dungeonDeck',
    count: number = 3
  ): { cards: Card[]; message: string } {
    const deck = gameState[deckName];
    if (!deck || deck.length === 0) {
      return { cards: [], message: `${deckName} is empty.` };
    }

    const visibleIds = deck.slice(0, Math.min(count, deck.length));
    const allCards = DataLoader.getInstance().getAllCards();
    const cards = visibleIds
      .map(id => allCards.find(c => c.id === id))
      .filter(Boolean) as Card[];

    return {
      cards,
      message: `Top ${cards.length} cards of ${deckName}: ${cards.map(c => c.name).join(', ')}`,
    };
  }

  // ---------------------------------------------------------------------------
  // Tile Effect (Glyph of Warding) checking
  // ---------------------------------------------------------------------------

  /**
   * Checks if a monster entering a tile triggers any tile effects.
   * Currently handles Glyph of Warding.
   * Returns a new GameState with any effects applied.
   */
  public static checkTileEffects(
    gameState: GameState,
    monster: Monster,
    targetTileId: string
  ): { newState: GameState; blocked: boolean } {
    const tileEffects = gameState.tileEffects ?? [];
    const effect = tileEffects.find(
      te => te.tileId === targetTileId && !te.isExpended
    );

    if (!effect) {
      return { newState: gameState, blocked: false };
    }

    if (effect.type === 'glyph_warding') {
      return {
        newState: {
          ...gameState,
          tileEffects: tileEffects.map(te =>
            te.id === effect.id ? { ...te, isExpended: true } : te
          ),
          log: [
            ...gameState.log,
            {
              id: crypto.randomUUID(),
              timestamp: new Date().toISOString(),
              message: `🌀 Glyph of Warding blocks ${monster.name} from entering the tile!`,
              type: 'event' as const,
            }
          ].slice(-100),
        },
        blocked: true,
      };
    }

    return { newState: gameState, blocked: false };
  }

  /**
   * Returns a new GameState with the treasuresDrawnThisTurn counter reset to 0.
   */
  public static resetTreasuresDrawn(gameState: GameState): GameState {
    return { ...gameState, treasuresDrawnThisTurn: 0 };
  }
}
