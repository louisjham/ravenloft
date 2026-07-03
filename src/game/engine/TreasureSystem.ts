import { Card, Effect, Entity, GameState, Hero, ActiveBlessing, TileEffect, DeckSentinel, Monster, DeckKey, FortuneXpEntry, PendingFortune, Tile } from '../types';
import { CombatSystem } from './CombatSystem';
import { ConditionSystem } from './ConditionSystem';
import { ExperienceSystem } from './ExperienceSystem';
import { PowerSystem } from './PowerSystem';
import { DataLoader } from '../dataLoader';
import { findBestLandingSquare } from './MonsterAI';

const SENTINEL_MOMENTS_RESPITE: DeckSentinel = 'sentinel_moments_respite';

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
            updatedTarget: ConditionSystem.applyCondition(target, effect.statusEffect!, hero.id, effect.duration ?? 1)
          };
        }
        return { updatedHero: hero, updatedTarget: target };

      case 'flip_power':
        if (effect.value !== undefined) {
          const updatedHero = PowerSystem.resetPower(hero, String(effect.value));
          return { updatedHero, updatedTarget: target };
        }
        return { updatedHero: hero, updatedTarget: target };

      case 'remove_conditions':
        // Handled in processGenericFortune for both 'self' and 'all_heroes' targets
        return { updatedHero: hero, updatedTarget: target };

      case 'draw_card':
        // TODO: draw_card effect is intentionally deferred to caller for now
        return { updatedHero: hero, updatedTarget: target };

      case 'passive':
        // Passive effects are handled by getHeroItemBonuses / processTurnStartPassiveEffects
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
    const cardId = deck.shift();
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

    const blessing: ActiveBlessing = {
      cardId: card.id,
      heroId: hero.id,
      drawnOnTurnCount: gameState.turnCount,
      effects: card.effects,
      name: card.name,
    };

    return {
      newState: {
        ...gameState,
        activeBlessings: [...(gameState.activeBlessings ?? []), blessing],
        discardPiles: TreasureSystem.addToDiscard(gameState.discardPiles, 'treasure', card.id)
      },
      message: `Blessing ${card.name} activated! Effects apply to all heroes until the end of ${hero.name}'s next turn.`,
      success: true
    };
  }

  /**
   * Expires active blessings — called at the END of a hero's turn.
   * Returns a new GameState with expired blessings cleared.
   */
  public static expireBlessing(gameState: GameState, expiredBlessings: ActiveBlessing[]): { newState: GameState; message: string } {
    if (!expiredBlessings || expiredBlessings.length === 0) {
      return { newState: gameState, message: 'No active blessing to expire.' };
    }

    const remainingBlessings = (gameState.activeBlessings ?? []).filter(b => !expiredBlessings.some(eb => eb.cardId === b.cardId && eb.heroId === b.heroId));

    return {
      newState: {
        ...gameState,
        activeBlessings: remainingBlessings,
      },
      message: `Blessing(s) expired: ${expiredBlessings.map(b => b.name).join(', ')}.`,
    };
  }

  /**
   * Checks if any active blessings should expire for the given hero turn end.
   * Returns a new GameState (possibly with blessings expired).
   */
  public static checkBlessingExpiry(
    gameState: GameState,
    heroId: string
  ): { newState: GameState; expired: boolean; message: string } {
    const blessings = gameState.activeBlessings ?? [];
    if (blessings.length === 0) {
      return { newState: gameState, expired: false, message: '' };
    }

    // A blessing expires if:
    // 1. The hero whose turn is ending is the one who drew it (heroId === b.heroId)
    // 2. AND the game has progressed past the turn it was drawn (gameState.turnCount > b.drawnOnTurnCount)
    // OR: The hero who drew it is dead. (Cleanup)
    const deadHeroIds = new Set(gameState.heroes.filter(h => h.hp <= 0).map(h => h.id));

    const expiredBlessings = blessings.filter(b => {
      if (deadHeroIds.has(b.heroId)) return true; // Purge dead hero blessings
      return b.heroId === heroId && gameState.turnCount > b.drawnOnTurnCount;
    });

    if (expiredBlessings.length > 0) {
      const expireResult = TreasureSystem.expireBlessing(gameState, expiredBlessings);
      return {
        newState: expireResult.newState,
        expired: true,
        message: expireResult.message,
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
      case 'fortune_breath_of_life_2':
      case 'fortune_breath_of_life_3':
        return TreasureSystem.processBreathOfLife(gameState, card, hero);
      case 'fortune_level_up':
        return TreasureSystem.processFortuneLevelUp(gameState, card, hero);
      case 'fortune_short_rest':
      case 'fortune_short_rest_2':
        return TreasureSystem.processShortRest(gameState, card, hero);
      case 'fortune_moments_respite':
        return TreasureSystem.processMomentsRespitePending(gameState, card, hero);
      // Legacy two-ID hack — kept for backward compatibility with saved states
      case 'fortune_moments_respite_encounter':
        return TreasureSystem.processMomentsRespite(gameState, card, hero, 'encounterDeck');
      case 'fortune_moments_respite_monster':
        return TreasureSystem.processMomentsRespite(gameState, card, hero, 'monsterDeck');
      case 'fortune_daze':
        return TreasureSystem.processDaze(gameState, card, hero);
      case 'fortune_distant_sounds':
        return TreasureSystem.processDistantSounds(gameState, card, hero);
      case 'fortune_eagle_eyes':
        return TreasureSystem.processEagleEyes(gameState, card, hero);
      case 'fortune_glimpse_of_the_future':
        return TreasureSystem.processGlimpseOfFuture(gameState, card, hero);
      case 'fortune_harrowed_experience':
      case 'fortune_harrowed_experience_2':
        return TreasureSystem.processHarrowedExperience(gameState, card, hero);
      case 'fortune_intimidating_bellow':
        return TreasureSystem.processIntimidatingBellow(gameState, card, hero);
      case 'fortune_lucky_find':
      case 'fortune_lucky_find_2':
        return TreasureSystem.processLuckyFind(gameState, card, hero);
      case 'fortune_shake_it_off':
        return TreasureSystem.processShakeItOff(gameState, card, hero);
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
    let updatedHeroes = gameState.heroes;

    for (const effect of card.effects) {
      if (effect.type === 'remove_conditions') {
        if (effect.target === 'all_heroes') {
          // Clear The Air: remove all conditions from ALL heroes
          updatedHeroes = updatedHeroes.map(h => ConditionSystem.clearAllConditions(h));
          updatedHero = updatedHeroes.find(h => h.id === hero.id) ?? updatedHero;
          hasEffect = true;
        } else {
          // self: clear conditions from just the drawing hero
          updatedHero = ConditionSystem.clearAllConditions(updatedHero);
          hasEffect = true;
        }
        continue;
      }

      const { updatedHero: newHero } = TreasureSystem.applyEffect(effect, updatedHero, null, gameState);
      if (newHero !== updatedHero) hasEffect = true;
      updatedHero = newHero;
    }

    // Merge any per-loop hero changes back into the heroes array
    updatedHeroes = updatedHeroes.map(h => h.id === hero.id ? updatedHero : h);

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
    const updatedHero: Hero = {
      ...hero,
      extraActionsThisTurn: (hero.extraActionsThisTurn ?? 0) + 1,
    };
    const updatedHeroes = gameState.heroes.map(h => h.id === hero.id ? updatedHero : h);
    return {
      newState: {
        ...gameState,
        heroes: updatedHeroes,
        discardPiles: TreasureSystem.addToDiscard(gameState.discardPiles, 'treasure', card.id)
      },
      message: `${hero.name} uses Action Surge! They may move their speed or make one additional attack.`,
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
    // Per card text: "Your Hero regains one hit point" — heals the drawing hero exactly 1 HP.
    const healAmount = 1;
    const healedHero = CombatSystem.applyHealing(hero, healAmount);
    const updatedHeroes = gameState.heroes.map(h => h.id === hero.id ? healedHero : h);

    return {
      newState: {
        ...gameState,
        heroes: updatedHeroes,
        discardPiles: TreasureSystem.addToDiscard(gameState.discardPiles, 'treasure', card.id)
      },
      message: `Breath of Life! ${hero.name} regains 1 HP.`,
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
   * Refreshes the most recently flipped power (last-in-first-out).
   * If the game rules should allow player choice instead, this would need
   * to return a pending-choice state resolved on the next action.
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
  /**
   * Moment's Respite (new single-card, player-choice version):
   * Sets pendingFortune so the UI can ask which deck to protect.
   * Resolution applies the sentinel via resolvePendingFortune.
   */
  private static processMomentsRespitePending(
    gameState: GameState,
    card: Card,
    _hero: Hero
  ): { newState: GameState; message: string; success: boolean } {
    const pending: PendingFortune = {
      kind: 'deckSentinelChoice',
      fortuneCardId: card.id,
    };
    return {
      newState: { ...gameState, pendingFortune: pending },
      message: `Moment's Respite! Choose which deck to protect: Encounter Deck or Monster Deck.`,
      success: true,
    };
  }

  /**
   * Moment's Respite (legacy two-ID handler — kept for backward compat).
   */
  private static processMomentsRespite(
    gameState: GameState,
    card: Card,
    hero: Hero,
    deckName: DeckKey
  ): { newState: GameState; message: string; success: boolean } {
    const currentDeck = [...(gameState[deckName] || [])];
    currentDeck.unshift(SENTINEL_MOMENTS_RESPITE);

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

  // ---------------------------------------------------------------------------
  // Fortune handlers: new implementations
  // ---------------------------------------------------------------------------

  /**
   * Daze: Sets pendingFortune so the player can choose which monster to daze.
   * When resolved, the monster gains skipActivations +1.
   */
  private static processDaze(
    gameState: GameState,
    card: Card,
    hero: Hero
  ): { newState: GameState; message: string; success: boolean } {
    const eligible = gameState.monsters
      .filter(m => m.hp > 0 && !m.isDefeated)
      .map(m => m.id);

    if (eligible.length === 0) {
      return {
        newState: {
          ...gameState,
          discardPiles: TreasureSystem.addToDiscard(gameState.discardPiles, 'treasure', card.id)
        },
        message: `Daze: no living monsters to target. Card discarded.`,
        success: true,
      };
    }

    // Auto-resolve if only one eligible monster
    if (eligible.length === 1) {
      const targetMonster = gameState.monsters.find(m => m.id === eligible[0])!;
      const updatedMonster: Monster = {
        ...targetMonster,
        skipActivations: (targetMonster.skipActivations ?? 0) + 1,
      };
      return {
        newState: {
          ...gameState,
          monsters: gameState.monsters.map(m => m.id === eligible[0] ? updatedMonster : m),
          discardPiles: TreasureSystem.addToDiscard(gameState.discardPiles, 'treasure', card.id)
        },
        message: `Daze! ${updatedMonster.name} will skip its next activation.`,
        success: true,
      };
    }

    const pending: PendingFortune = {
      kind: 'monsterPick',
      purpose: 'daze',
      eligible,
      fortuneCardId: card.id,
    };
    return {
      newState: { ...gameState, pendingFortune: pending },
      message: `Daze! Choose a monster to daze (it will skip its next activation).`,
      success: true,
    };
  }

  /**
   * Distant Sounds: Sets pendingFortune so the player can reorder the top 3
   * cards of the Monster Deck.
   */
  private static processDistantSounds(
    gameState: GameState,
    card: Card,
    _hero: Hero
  ): { newState: GameState; message: string; success: boolean } {
    const topCards = gameState.monsterDeck.slice(0, 3);

    if (topCards.length === 0) {
      return {
        newState: {
          ...gameState,
          discardPiles: TreasureSystem.addToDiscard(gameState.discardPiles, 'treasure', card.id)
        },
        message: `Distant Sounds: Monster Deck is empty. Card discarded.`,
        success: true,
      };
    }

    const pending: PendingFortune = {
      kind: 'deckReorder',
      deck: 'monster',
      topCards,
      fortuneCardId: card.id,
    };
    return {
      newState: { ...gameState, pendingFortune: pending },
      message: `Distant Sounds! Reorder the top ${topCards.length} cards of the Monster Deck.`,
      success: true,
    };
  }

  /**
   * Eagle Eyes: Gathers all unexplored edges and sets pendingFortune so the
   * player can choose where to reveal a tile (without drawing an encounter).
   */
  private static processEagleEyes(
    gameState: GameState,
    card: Card,
    _hero: Hero
  ): { newState: GameState; message: string; success: boolean } {
    const revealedTiles = gameState.tiles.filter(t => t.isRevealed);
    type EdgeInfo = { tileId: string; edge: 'north' | 'south' | 'east' | 'west' };
    const unexploredEdges: EdgeInfo[] = [];

    for (const tile of revealedTiles) {
      for (const conn of tile.connections) {
        if (conn.isOpen && !conn.connectedTileId) {
          unexploredEdges.push({ tileId: tile.id, edge: conn.edge });
        }
      }
    }

    if (unexploredEdges.length === 0 || gameState.dungeonDeck.length === 0) {
      return {
        newState: {
          ...gameState,
          discardPiles: TreasureSystem.addToDiscard(gameState.discardPiles, 'treasure', card.id)
        },
        message: `Eagle Eyes: no unexplored edges available. Card discarded.`,
        success: true,
      };
    }

    const pending: PendingFortune = {
      kind: 'tileEdgePick',
      edges: unexploredEdges,
      fortuneCardId: card.id,
    };
    return {
      newState: { ...gameState, pendingFortune: pending },
      message: `Eagle Eyes! Choose an unexplored edge to reveal a new tile (no encounter draw).`,
      success: true,
    };
  }

  /**
   * Glimpse Of The Future: Sets pendingFortune so the player can reorder the
   * top 3 cards of the Encounter Deck.
   */
  private static processGlimpseOfFuture(
    gameState: GameState,
    card: Card,
    _hero: Hero
  ): { newState: GameState; message: string; success: boolean } {
    const topCards = gameState.encounterDeck.slice(0, 3);

    if (topCards.length === 0) {
      return {
        newState: {
          ...gameState,
          discardPiles: TreasureSystem.addToDiscard(gameState.discardPiles, 'treasure', card.id)
        },
        message: `Glimpse Of The Future: Encounter Deck is empty. Card discarded.`,
        success: true,
      };
    }

    const pending: PendingFortune = {
      kind: 'deckReorder',
      deck: 'encounter',
      topCards,
      fortuneCardId: card.id,
    };
    return {
      newState: { ...gameState, pendingFortune: pending },
      message: `Glimpse Of The Future! Reorder the top ${topCards.length} cards of the Encounter Deck.`,
      success: true,
    };
  }

  /**
   * Harrowed Experience: Adds the card to fortuneXpEntries as 1 XP,
   * then discards it. The XP entry is spent alongside monster XP.
   */
  private static processHarrowedExperience(
    gameState: GameState,
    card: Card,
    hero: Hero
  ): { newState: GameState; message: string; success: boolean } {
    const entry: FortuneXpEntry = {
      cardId: card.id,
      source: 'fortune',
      amount: 1,
    };
    const fortuneXpEntries = [...(gameState.fortuneXpEntries ?? []), entry];
    return {
      newState: {
        ...gameState,
        fortuneXpEntries,
        discardPiles: TreasureSystem.addToDiscard(gameState.discardPiles, 'treasure', card.id)
      },
      message: `${hero.name} gains 1 XP from Harrowed Experience!`,
      success: true,
    };
  }

  /**
   * Intimidating Bellow: Sets pendingFortune so the player can choose which
   * monster to move at least 2 tiles away.
   */
  private static processIntimidatingBellow(
    gameState: GameState,
    card: Card,
    _hero: Hero
  ): { newState: GameState; message: string; success: boolean } {
    const eligible = gameState.monsters
      .filter(m => m.hp > 0 && !m.isDefeated && !m.isBoss)
      .map(m => m.id);

    if (eligible.length === 0) {
      return {
        newState: {
          ...gameState,
          discardPiles: TreasureSystem.addToDiscard(gameState.discardPiles, 'treasure', card.id)
        },
        message: `Intimidating Bellow: no eligible monsters. Card discarded.`,
        success: true,
      };
    }

    const pending: PendingFortune = {
      kind: 'monsterPick',
      purpose: 'move',
      eligible,
      fortuneCardId: card.id,
    };
    return {
      newState: { ...gameState, pendingFortune: pending },
      message: `Intimidating Bellow! Choose a monster to move at least 2 tiles away.`,
      success: true,
    };
  }

  /**
   * Lucky Find: Draws up to 3 treasure cards (bypassing the 1-per-turn limit
   * for the unchosen cards), then sets pendingFortune so the player picks one
   * to keep. The chosen card resolves normally; the others are discarded.
   * The kept card does NOT count against the per-turn treasure quota if the
   * quota was already consumed by the original Fortune draw.
   */
  private static processLuckyFind(
    gameState: GameState,
    card: Card,
    _hero: Hero
  ): { newState: GameState; message: string; success: boolean } {
    const drawCount = Math.min(3, gameState.treasureDeck.length);

    if (drawCount === 0) {
      return {
        newState: {
          ...gameState,
          discardPiles: TreasureSystem.addToDiscard(gameState.discardPiles, 'treasure', card.id)
        },
        message: `Lucky Find: Treasure Deck is empty. Card discarded.`,
        success: true,
      };
    }

    // Pull cards off the top of the treasure deck (no per-turn increment yet)
    const deck = [...gameState.treasureDeck];
    const drawn = deck.splice(0, drawCount);

    const pending: PendingFortune = {
      kind: 'treasureChoose',
      drawn,
      fortuneCardId: card.id,
    };
    return {
      newState: {
        ...gameState,
        treasureDeck: deck,
        pendingFortune: pending,
      },
      message: `Lucky Find! You drew ${drawCount} treasure cards. Choose one to keep; the rest are discarded.`,
      success: true,
    };
  }

  /**
   * Shake It Off: Lets one chosen hero remove one condition.
   * Auto-resolves if there is exactly one eligible hero with one condition.
   */
  private static processShakeItOff(
    gameState: GameState,
    card: Card,
    hero: Hero
  ): { newState: GameState; message: string; success: boolean } {
    const eligibleHeroes = gameState.heroes.filter(
      h => h.conditions.length > 0 && !h.escaped
    );

    if (eligibleHeroes.length === 0) {
      return {
        newState: {
          ...gameState,
          discardPiles: TreasureSystem.addToDiscard(gameState.discardPiles, 'treasure', card.id)
        },
        message: `Shake It Off: no heroes have conditions to remove. Card discarded.`,
        success: true,
      };
    }

    // Auto-resolve: exactly one hero with exactly one condition
    if (eligibleHeroes.length === 1 && eligibleHeroes[0].conditions.length === 1) {
      const target = eligibleHeroes[0];
      const conditionName = target.conditions[0].type;
      const clearedHero = ConditionSystem.removeCondition(target, conditionName as import('../types').ConditionType);
      return {
        newState: {
          ...gameState,
          heroes: gameState.heroes.map(h => h.id === target.id ? clearedHero : h),
          discardPiles: TreasureSystem.addToDiscard(gameState.discardPiles, 'treasure', card.id)
        },
        message: `Shake It Off! ${target.name} removes ${conditionName}.`,
        success: true,
      };
    }

    const pending: PendingFortune = {
      kind: 'heroConditionPick',
      heroIds: eligibleHeroes.map(h => h.id),
      fortuneCardId: card.id,
    };
    return {
      newState: { ...gameState, pendingFortune: pending },
      message: `Shake It Off! Choose a hero and a condition to remove.`,
      success: true,
    };
  }

  // ---------------------------------------------------------------------------
  // Public: resolve player choices for pending Fortunes (Step 18)
  // ---------------------------------------------------------------------------

  /**
   * Resolves a player's choice for a pending Fortune.
   * Called from the store action after the FortuneResolutionModal commits a decision.
   *
   * The `choice` parameter is a discriminated object whose shape matches the
   * `PendingFortune.kind` in the current `gameState.pendingFortune`.
   */
  public static async resolvePendingFortuneAsync(
    gameState: GameState,
    choice:
      | { kind: 'deckReorder'; newOrder: string[] }
      | { kind: 'monsterPick'; monsterId: string; destinationTileId?: string }
      | { kind: 'heroConditionPick'; heroId: string; conditionType: string }
      | { kind: 'treasureChoose'; keptCardId: string; drawingHeroId: string }
      | { kind: 'tileEdgePick'; tileId: string; edge: string }
      | { kind: 'deckSentinelChoice'; deck: 'monster' | 'encounter' }
      | { kind: 'tileRelocatePick'; destinationTileId: string }
      | { kind: 'atWillPowerPick'; powerCardId: string }
  ): Promise<{ newState: GameState; message: string }> {
    const pending = gameState.pendingFortune;
    if (!pending) {
      return { newState: gameState, message: 'No pending fortune to resolve.' };
    }

    // Clear pending up front; each branch will discard the card if appropriate
    const base: GameState = { ...gameState, pendingFortune: undefined };

    const card = DataLoader.getInstance().getCardById(pending.fortuneCardId);
    const discardKey = card?.type === 'encounter' ? 'encounter' : 'treasure';

    switch (choice.kind) {
      case 'deckReorder': {
        if (pending.kind !== 'deckReorder') break;
        const deckKey = pending.deck === 'monster' ? 'monsterDeck' : 'encounterDeck';
        const rest = base[deckKey].slice(pending.topCards.length);
        return {
          newState: {
            ...base,
            [deckKey]: [...choice.newOrder, ...rest],
            discardPiles: TreasureSystem.addToDiscard(base.discardPiles, discardKey, pending.fortuneCardId)
          },
          message: `${pending.deck === 'monster' ? 'Distant Sounds' : 'Glimpse Of The Future'}: deck reordered.`
        };
      }

      case 'monsterPick': {
        if (pending.kind !== 'monsterPick') break;
        const targetMonster = base.monsters.find(m => m.id === choice.monsterId);
        if (!targetMonster) break;

        if (pending.purpose === 'daze') {
          const updatedMonster: Monster = {
            ...targetMonster,
            skipActivations: (targetMonster.skipActivations ?? 0) + 1,
          };
          return {
            newState: {
              ...base,
              monsters: base.monsters.map(m => m.id === choice.monsterId ? updatedMonster : m),
              discardPiles: TreasureSystem.addToDiscard(base.discardPiles, discardKey, pending.fortuneCardId)
            },
            message: `Daze! ${targetMonster.name} will skip its next activation.`
          };
        }

        if (pending.purpose === 'move') {
          // Move the monster to a tile ≥2 tile-graph-distance away.
          // The destinationTileId is provided by the UI (FortuneResolutionModal validates distance).
          const destTile = base.tiles.find(t => t.id === choice.destinationTileId);
          if (!destTile) break;
          const updatedMonster: Monster = {
            ...targetMonster,
            position: { x: destTile.x, z: destTile.z, sqX: 1, sqZ: 1 }
          };
          return {
            newState: {
              ...base,
              monsters: base.monsters.map(m => m.id === choice.monsterId ? updatedMonster : m),
              discardPiles: TreasureSystem.addToDiscard(base.discardPiles, discardKey, pending.fortuneCardId)
            },
            message: `Intimidating Bellow! ${targetMonster.name} moves to tile (${destTile.x}, ${destTile.z}).`
          };
        }
        break;
      }

      case 'heroConditionPick': {
        if (pending.kind !== 'heroConditionPick') break;
        const targetHero = base.heroes.find(h => h.id === choice.heroId);
        if (!targetHero) break;
        const clearedHero = ConditionSystem.removeCondition(targetHero, choice.conditionType as import('../types').ConditionType);
        return {
          newState: {
            ...base,
            heroes: base.heroes.map(h => h.id === choice.heroId ? clearedHero : h),
            discardPiles: TreasureSystem.addToDiscard(base.discardPiles, discardKey, pending.fortuneCardId)
          },
          message: `Shake It Off! ${targetHero.name} removes ${choice.conditionType}.`
        };
      }

      case 'treasureChoose': {
        if (pending.kind !== 'treasureChoose') break;
        const { keptCardId, drawingHeroId } = choice;
        // Discard the unchosen cards
        let discardPiles = base.discardPiles;
        for (const drawnId of pending.drawn) {
          if (drawnId !== keptCardId) {
            discardPiles = TreasureSystem.addToDiscard(discardPiles, 'treasure', drawnId);
          }
        }
        // Also discard the Lucky Find card itself
        discardPiles = TreasureSystem.addToDiscard(discardPiles, discardKey, pending.fortuneCardId);

        // Resolve the kept card — don't increment treasuresDrawnThisTurn for Lucky Find's bonus
        const dataLoader = DataLoader.getInstance();
        const keptCard = dataLoader.getCardById(keptCardId) as Card | undefined;
        const drawingHero = base.heroes.find(h => h.id === drawingHeroId);
        let stateAfterKeep: GameState = { ...base, discardPiles };

        if (keptCard && drawingHero) {
          if (keptCard.treasureType === 'blessing') {
            const blessingResult = TreasureSystem.useBlessing(stateAfterKeep, keptCard, drawingHero);
            stateAfterKeep = blessingResult.newState;
          } else if (keptCard.treasureType === 'fortune') {
            const fortuneResult = TreasureSystem.useFortune(stateAfterKeep, keptCard, drawingHero);
            stateAfterKeep = fortuneResult.newState;
          } else {
            // Item: assign to hero
            const updatedHero = { ...drawingHero, items: [...drawingHero.items, keptCard.id] };
            stateAfterKeep = {
              ...stateAfterKeep,
              heroes: stateAfterKeep.heroes.map(h => h.id === drawingHeroId ? updatedHero : h)
            };
          }
        }

        return {
          newState: stateAfterKeep,
          message: `Lucky Find! ${drawingHero?.name ?? 'Hero'} keeps ${keptCard?.name ?? keptCardId}.`
        };
      }

      case 'tileEdgePick': {
        if (pending.kind !== 'tileEdgePick') break;
        // Eagle Eyes: discard fortune card and clear pending.
        // The tile placement is triggered by the caller (store action) after this returns,
        // passing skipEncounterDraw=true and the chosen edge from the UI's choice payload.
        return {
          newState: {
            ...base,
            discardPiles: TreasureSystem.addToDiscard(base.discardPiles, discardKey, pending.fortuneCardId)
          },
          message: `Eagle Eyes! Placing a tile at ${choice.tileId} ${choice.edge} edge (no encounter draw).`
        };
      }

      case 'deckSentinelChoice': {
        if (pending.kind !== 'deckSentinelChoice') break;
        const deckKey = choice.deck === 'monster' ? 'monsterDeck' : 'encounterDeck';
        const currentDeck = [...(base[deckKey] as string[])];
        currentDeck.unshift(SENTINEL_MOMENTS_RESPITE);
        return {
          newState: {
            ...base,
            [deckKey]: currentDeck,
            discardPiles: TreasureSystem.addToDiscard(base.discardPiles, discardKey, pending.fortuneCardId)
          },
          message: `Moment's Respite! The next ${choice.deck === 'monster' ? 'Monster' : 'Encounter'} draw is skipped.`
        };
      }

      case 'tileRelocatePick': {
        if (pending.kind !== 'tileRelocatePick') break;
        const targetTile = base.tiles.find(t => t.id === (choice as any).destinationTileId);
        const hero = base.heroes.find(h => h.id === pending.heroId);
        if (!targetTile || !hero) break;

        const heroTile = base.tiles.find(t => t.x === hero.position.x && t.z === hero.position.z);
        const updatedHeroes = base.heroes.map(h =>
          h.id === hero.id ? { ...h, position: { ...h.position, x: targetTile.x, z: targetTile.z, sqX: 2, sqZ: 2 } } : h
        );

        let updatedTiles = base.tiles.map(t => {
          let heroes = [...t.heroes];
          if (heroTile && t.id === heroTile.id) {
            heroes = heroes.filter(id => id !== hero.id);
          }
          if (t.id === targetTile.id) {
            heroes = [...new Set([...heroes, hero.id])];
          }
          return { ...t, heroes };
        });

        return {
          newState: {
            ...base,
            heroes: updatedHeroes,
            tiles: updatedTiles,
            discardPiles: TreasureSystem.addToDiscard(base.discardPiles, discardKey, pending.fortuneCardId)
          },
          message: `Relocated ${hero.name} to tile ${targetTile.name || targetTile.id} (${targetTile.x}, ${targetTile.z}).`
        };
      }

      case 'atWillPowerPick': {
        if (pending.kind !== 'atWillPowerPick') break;
        const attacker = base.heroes.find(h => h.id === pending.attackerHeroId);
        const target = base.heroes.find(h => h.id === pending.targetHeroId);
        if (!attacker || !target) break;

        const powerCard = DataLoader.getInstance().getCardById((choice as any).powerCardId);
        if (!powerCard) break;

        // Execute power asynchronously
        const powerResult = await PowerSystem.usePowerAsync(attacker, powerCard, target, base);

        return {
          newState: {
            ...powerResult.newState,
            discardPiles: TreasureSystem.addToDiscard(powerResult.newState.discardPiles, discardKey, pending.fortuneCardId)
          },
          message: `${attacker.name} attacks ${target.name} with ${powerCard.name}! ${powerResult.message}`
        };
      }
    }

    // Fallback: clear pending without effect
    return {
      newState: base,
      message: `Fortune resolution: no matching handler for ${choice.kind}.`
    };
  }

  /**
   * Checks if the top card of a deck is a Moment's Respite sentinel.

   * If so, removes and discards it, returning true (indicating the draw should be skipped).
   * Note: SENTINEL_MOMENTS_RESPITE is a deck marker string, not a real card ID.
   * It should never be passed to addToDiscard.
   */
  public static checkAndDiscardRespite(
    gameState: GameState,
    deckName: DeckKey
  ): { gameState: GameState; wasRespite: boolean } {
    const deck = gameState[deckName];
    if (!deck || deck.length === 0) {
      return { gameState, wasRespite: false };
    }

    if (deck[0] === SENTINEL_MOMENTS_RESPITE) {
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

    // Generic charges initialization from card data
    const itemCharges = { ...(gameState.itemCharges ?? {}) };
    if (card.charges !== undefined && !itemCharges[card.id]) {
      itemCharges[card.id] = card.charges;
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

    // Quest Items
    if (card.id === 'item_wooden_stake') {
      if (!target || target.type !== 'monster') {
        return { newState: gameState, message: 'Wooden Stake must target a monster.', success: false };
      }
      const targetMonster = target as Monster;
      const isVampire = targetMonster.monsterType?.toLowerCase()?.includes('vampire') || 
                        targetMonster.name?.toLowerCase()?.includes('vampire') ||
                        targetMonster.name?.toLowerCase()?.includes('strahd') ||
                        targetMonster.id?.toLowerCase()?.includes('vampire') ||
                        targetMonster.id?.toLowerCase()?.includes('strahd');
      if (!isVampire) {
        return { newState: gameState, message: 'Wooden Stake can only target Vampire-type monsters.', success: false };
      }
      const dx = Math.abs(hero.position.x - target.position.x);
      const dz = Math.abs(hero.position.z - target.position.z);
      if (dx + dz > 1) {
        return { newState: gameState, message: 'Wooden Stake target must be adjacent.', success: false };
      }

      const attackResult = CombatSystem.resolveAttack(
        hero,
        targetMonster,
        5, // attack bonus
        3, // damage
        0, // roll modifier
        undefined,
        gameState,
        1 // miss damage
      );

      let updatedTarget = CombatSystem.applyDamage(targetMonster, attackResult.damage, gameState) as Monster;
      updatedTarget = {
        ...updatedTarget,
        skipActivations: (updatedTarget.skipActivations ?? 0) + 1
      };

      let updatedHero = { ...hero };
      if (gameState.activeEnvironmentCard === 'enc_spirit_of_doom_env') {
        updatedHero = CombatSystem.applyDamage(updatedHero, 1) as Hero;
      }
      updatedHero = { ...updatedHero, items: updatedHero.items.filter(id => id !== card.id) };

      const updatedHeroes = gameState.heroes.map(h => h.id === hero.id ? updatedHero : h);
      const updatedMonsters = gameState.monsters.map(m => m.id === target.id ? updatedTarget : m);

      const hitStr = attackResult.hit ? 'HITS' : 'MISSES';
      const message = `${hero.name} attacks ${target.name} with Wooden Stake (+5 vs AC ${targetMonster.ac}) and ${hitStr} (Roll: ${attackResult.roll}, Total: ${attackResult.total}) for ${attackResult.damage} damage. Vampire does not activate on next phase.`;

      // Log to game history
      const currentCounter = gameState.logIdCounter ?? 0;
      const updatedLog = [
        ...(gameState.log || []),
        {
          id: String(currentCounter),
          timestamp: new Date().toISOString(),
          message,
          type: 'combat' as const
        }
      ].slice(-100);

      return {
        newState: {
          ...gameState,
          heroes: updatedHeroes,
          monsters: updatedMonsters,
          log: updatedLog,
          logIdCounter: currentCounter + 1
        },
        message,
        success: true
      };
    }

    if (card.id === 'item_silver_dagger') {
      if (!target || target.type !== 'monster') {
        return { newState: gameState, message: 'Silver Dagger must target a monster.', success: false };
      }
      const targetMonster = target as Monster;
      const isWerewolf = targetMonster.monsterType?.toLowerCase()?.includes('werewolf') || 
                         targetMonster.name?.toLowerCase()?.includes('werewolf') ||
                         targetMonster.id?.toLowerCase()?.includes('werewolf');
      if (!isWerewolf) {
        return { newState: gameState, message: 'Silver Dagger can only target Werewolf-type monsters.', success: false };
      }
      const dx = Math.abs(hero.position.x - target.position.x);
      const dz = Math.abs(hero.position.z - target.position.z);
      if (dx + dz > 2) {
        return { newState: gameState, message: 'Silver Dagger target must be within 2 tiles.', success: false };
      }

      const attackResult = CombatSystem.resolveAttack(
        hero,
        targetMonster,
        5, // attack bonus
        3, // damage
        0, // roll modifier
        undefined,
        gameState,
        1 // miss damage
      );

      let updatedTarget = CombatSystem.applyDamage(targetMonster, attackResult.damage, gameState) as Monster;
      updatedTarget = {
        ...updatedTarget,
        regenerationDisabled: true
      };

      let updatedHero = { ...hero };
      if (gameState.activeEnvironmentCard === 'enc_spirit_of_doom_env') {
        updatedHero = CombatSystem.applyDamage(updatedHero, 1) as Hero;
      }
      updatedHero = { ...updatedHero, items: updatedHero.items.filter(id => id !== card.id) };

      const updatedHeroes = gameState.heroes.map(h => h.id === hero.id ? updatedHero : h);
      const updatedMonsters = gameState.monsters.map(m => m.id === target.id ? updatedTarget : m);

      const hitStr = attackResult.hit ? 'HITS' : 'MISSES';
      const message = `${hero.name} attacks ${target.name} with Silver Dagger (+5 vs AC ${targetMonster.ac}) and ${hitStr} (Roll: ${attackResult.roll}, Total: ${attackResult.total}) for ${attackResult.damage} damage. Werewolf permanently loses regeneration.`;

      // Log to game history
      const currentCounter = gameState.logIdCounter ?? 0;
      const updatedLog = [
        ...(gameState.log || []),
        {
          id: String(currentCounter),
          timestamp: new Date().toISOString(),
          message,
          type: 'combat' as const
        }
      ].slice(-100);

      return {
        newState: {
          ...gameState,
          heroes: updatedHeroes,
          monsters: updatedMonsters,
          log: updatedLog,
          logIdCounter: currentCounter + 1
        },
        message,
        success: true
      };
    }

    if (card.id === 'item_feywalk_amulet') {
      if (!target) {
        return { newState: gameState, message: 'Feywalk Amulet must target an entity to teleport to.', success: false };
      }
      let updatedHero = { ...hero, position: { ...target.position } };
      if (gameState.activeEnvironmentCard === 'enc_spirit_of_doom_env') {
        updatedHero = CombatSystem.applyDamage(updatedHero, 1) as Hero;
      }
      updatedHero = { ...updatedHero, items: updatedHero.items.filter(id => id !== card.id) };
      const updatedHeroes = gameState.heroes.map(h => h.id === hero.id ? updatedHero : h);
      return {
        newState: { ...gameState, heroes: updatedHeroes },
        message: `${hero.name} used Feywalk Amulet and teleported to ${target.name}'s position at (${target.position.x}, ${target.position.z}).`,
        success: true
      };
    }

    if (card.id === 'item_torch') {
      const heroTile = gameState.tiles.find(t => t.x === hero.position.x && t.z === hero.position.z);
      if (!heroTile) {
        return { newState: gameState, message: 'Hero must be on a tile to use Torch.', success: false };
      }

      // 1. Identify monsters on the hero's tile
      const monstersOnTile = gameState.monsters.filter(m =>
        m.hp > 0 && !m.isDefeated && m.position.x === hero.position.x && m.position.z === hero.position.z
      );

      let tempState = { ...gameState };
      let logMessages: string[] = [];

      // Valid tiles within 1 tile of hero, sorted by distance descending (distance 1 first, then distance 0)
      const validTiles = tempState.tiles.filter(t => {
        const dist = Math.abs(t.x - hero.position.x) + Math.abs(t.z - hero.position.z);
        return dist <= 1;
      });
      const sortedTiles = [...validTiles].sort((a, b) => {
        const distA = Math.abs(a.x - hero.position.x) + Math.abs(a.z - hero.position.z);
        const distB = Math.abs(b.x - hero.position.x) + Math.abs(b.z - hero.position.z);
        if (distA !== distB) return distB - distA;
        return a.id.localeCompare(b.id);
      });

      let updatedMonsters = tempState.monsters;

      for (const monster of monstersOnTile) {
        tempState.monsters = updatedMonsters;
        // Resolve attack: +5 vs AC, 1 damage on hit, 0 on miss
        const attackResult = CombatSystem.resolveAttack(hero, monster, 5, 1, 0, undefined, tempState, 0);
        let updatedMonster = CombatSystem.applyDamage(monster, attackResult.damage, tempState) as Monster;

        const hitStr = attackResult.hit ? 'HITS' : 'MISSES';
        let movementLog = '';

        if (updatedMonster.hp > 0 && !updatedMonster.isDefeated) {
          // Find first tile with free landing square
          let chosenTile = null;
          let landingSq = null;

          for (const tile of sortedTiles) {
            const sq = findBestLandingSquare(updatedMonster, null, tile, false, tempState);
            const occupied = 
              tempState.heroes.some(h => h.position.x === tile.x && h.position.z === tile.z && h.position.sqX === sq.sqX && h.position.sqZ === sq.sqZ) ||
              updatedMonsters.some(m => m.id !== monster.id && !m.isDefeated && m.hp > 0 && m.position.x === tile.x && m.position.z === tile.z && m.position.sqX === sq.sqX && m.position.sqZ === sq.sqZ);
            if (!occupied) {
              chosenTile = tile;
              landingSq = sq;
              break;
            }
          }

          if (chosenTile && landingSq) {
            updatedMonster = {
              ...updatedMonster,
              position: { x: chosenTile.x, z: chosenTile.z, sqX: landingSq.sqX, sqZ: landingSq.sqZ }
            };
            movementLog = ` and places it on tile ${chosenTile.id} (${landingSq.sqX}, ${landingSq.sqZ})`;
          }
        }

        updatedMonsters = updatedMonsters.map(m => m.id === monster.id ? updatedMonster : m);
        logMessages.push(`${hero.name} attacks ${monster.name} with Torch (+5 vs AC ${monster.ac}) and ${hitStr} (Roll: ${attackResult.roll}, Total: ${attackResult.total}) for ${attackResult.damage} damage${movementLog}.`);
      }

      let updatedHero = { ...hero };
      if (tempState.activeEnvironmentCard === 'enc_spirit_of_doom_env') {
        updatedHero = CombatSystem.applyDamage(updatedHero, 1) as Hero;
      }
      updatedHero = { ...updatedHero, items: updatedHero.items.filter(id => id !== card.id) };

      const updatedHeroes = tempState.heroes.map(h => h.id === hero.id ? updatedHero : h);

      // Log to history
      let currentCounter = tempState.logIdCounter ?? 0;
      let newLogs = [...(tempState.log || [])];
      for (const msg of logMessages) {
        newLogs.push({
          id: String(currentCounter++),
          timestamp: new Date().toISOString(),
          message: msg,
          type: 'combat' as const
        });
      }

      return {
        newState: {
          ...tempState,
          heroes: updatedHeroes,
          monsters: updatedMonsters,
          log: newLogs.slice(-100),
          logIdCounter: currentCounter
        },
        message: logMessages.join(' ') || `${hero.name} used Torch.`,
        success: true
      };
    }

    if (card.id === 'item_wand_of_teleportation') {
      if (!target) {
        return { newState: gameState, message: 'Wand of Teleportation requires a target monster or tile.', success: false };
      }

      let targetTile: Tile | undefined;
      if (target.type === 'monster') {
        targetTile = gameState.tiles.find(t => t.x === target.position?.x && t.z === target.position?.z);
      } else {
        const maybeTile = target as any;
        targetTile = gameState.tiles.find(t => t.x === maybeTile.x && t.z === maybeTile.z);
      }

      if (!targetTile) {
        return { newState: gameState, message: 'Target tile must exist on the board.', success: false };
      }

      // Check if targetTile is within 1 tile of hero
      const dx = Math.abs(hero.position.x - targetTile.x);
      const dz = Math.abs(hero.position.z - targetTile.z);
      if (dx + dz > 1) {
        return { newState: gameState, message: 'Target tile must be within 1 tile of you.', success: false };
      }

      // 1. Find all monsters on targetTile
      const monstersOnTile = gameState.monsters.filter(m =>
        m.hp > 0 && !m.isDefeated && m.position.x === targetTile!.x && m.position.z === targetTile!.z
      );

      let tempState = { ...gameState };
      let logMessages: string[] = [];

      // Valid tiles within 3 tiles of hero, sorted by distance descending (farthest first)
      const validTiles = tempState.tiles.filter(t => {
        const dist = Math.abs(t.x - hero.position.x) + Math.abs(t.z - hero.position.z);
        return dist <= 3;
      });
      const sortedTiles = [...validTiles].sort((a, b) => {
        const distA = Math.abs(a.x - hero.position.x) + Math.abs(a.z - hero.position.z);
        const distB = Math.abs(b.x - hero.position.x) + Math.abs(b.z - hero.position.z);
        if (distA !== distB) return distB - distA;
        return a.id.localeCompare(b.id);
      });

      let updatedMonsters = tempState.monsters;

      for (const monster of monstersOnTile) {
        tempState.monsters = updatedMonsters;
        let updatedMonster = { ...monster };
        let chosenTile = null;
        let landingSq = null;

        for (const tile of sortedTiles) {
          const sq = findBestLandingSquare(updatedMonster, null, tile, false, tempState);
          const occupied = 
            tempState.heroes.some(h => h.position.x === tile.x && h.position.z === tile.z && h.position.sqX === sq.sqX && h.position.sqZ === sq.sqZ) ||
            updatedMonsters.some(m => m.id !== monster.id && !m.isDefeated && m.hp > 0 && m.position.x === tile.x && m.position.z === tile.z && m.position.sqX === sq.sqX && m.position.sqZ === sq.sqZ);
          if (!occupied) {
            chosenTile = tile;
            landingSq = sq;
            break;
          }
        }

        if (chosenTile && landingSq) {
          updatedMonster = {
            ...updatedMonster,
            position: { x: chosenTile.x, z: chosenTile.z, sqX: landingSq.sqX, sqZ: landingSq.sqZ }
          };
          logMessages.push(`${monster.name} is teleported to tile ${chosenTile.id} (${landingSq.sqX}, ${landingSq.sqZ}).`);
        }
        updatedMonsters = updatedMonsters.map(m => m.id === monster.id ? updatedMonster : m);
      }

      let updatedHero = { ...hero };
      if (tempState.activeEnvironmentCard === 'enc_spirit_of_doom_env') {
        updatedHero = CombatSystem.applyDamage(updatedHero, 1) as Hero;
      }
      updatedHero = { ...updatedHero, items: updatedHero.items.filter(id => id !== card.id) };

      const updatedHeroes = tempState.heroes.map(h => h.id === hero.id ? updatedHero : h);

      // Log to history
      let currentCounter = tempState.logIdCounter ?? 0;
      let newLogs = [...(tempState.log || [])];
      for (const msg of logMessages) {
        newLogs.push({
          id: String(currentCounter++),
          timestamp: new Date().toISOString(),
          message: `${hero.name} uses Wand of Teleportation: ${msg}`,
          type: 'system' as const
        });
      }

      const summaryMsg = `${hero.name} uses Wand of Teleportation on tile ${targetTile.id}. ` + logMessages.join(' ');

      return {
        newState: {
          ...tempState,
          heroes: updatedHeroes,
          monsters: updatedMonsters,
          log: newLogs.slice(-100),
          logIdCounter: currentCounter
        },
        message: summaryMsg,
        success: true
      };
    }

    if (card.id === 'item_dimensional_shackles') {
      if (!target || target.type !== 'monster') {
        return { newState: gameState, message: 'Dimensional Shackles must target a monster.', success: false };
      }
      const heroTile = gameState.tiles.find(t => t.heroes.includes(hero.id));
      const monsterTile = gameState.tiles.find(t => t.monsters.includes(target.id));
      if (!heroTile || !monsterTile || heroTile.id !== monsterTile.id) {
        return { newState: gameState, message: 'Dimensional Shackles can only target a monster on the hero\'s tile.', success: false };
      }
      const updatedTarget = ConditionSystem.applyCondition(target, 'immobilized', hero.id, 1);
      let updatedHero = { ...hero };
      if (gameState.activeEnvironmentCard === 'enc_spirit_of_doom_env') {
        updatedHero = CombatSystem.applyDamage(updatedHero, 1) as Hero;
      }
      updatedHero = { ...updatedHero, items: updatedHero.items.filter(id => id !== card.id) };
      const updatedHeroes = gameState.heroes.map(h => h.id === hero.id ? updatedHero : h);
      const updatedMonsters = gameState.monsters.map(m => m.id === target.id ? updatedTarget as Monster : m);
      return {
        newState: { ...gameState, heroes: updatedHeroes, monsters: updatedMonsters },
        message: `${hero.name} used Dimensional Shackles to immobilize ${target.name}.`,
        success: true
      };
    }

    if (card.id === 'item_holy_symbol_of_ravenkind') {
      const heroTile = gameState.tiles.find(t => t.heroes.includes(hero.id));
      const affectedTileIds = new Set<string>();
      if (heroTile) {
        affectedTileIds.add(heroTile.id);
        for (const conn of heroTile.connections) {
          if (conn.isOpen && conn.connectedTileId) {
            affectedTileIds.add(conn.connectedTileId);
          }
        }
      }
      const undeadMonsters = gameState.monsters.filter(m => {
        if (m.hp <= 0 || m.isDefeated) return false;
        const mTile = gameState.tiles.find(t => t.monsters.includes(m.id) || (t.x === m.position.x && t.z === m.position.z));
        if (!mTile || !affectedTileIds.has(mTile.id)) return false;
        const isUndead = m.isUndead === true;
        return isUndead;
      });

      let updatedMonsters = [...gameState.monsters];
      let logMessages: string[] = [];
      for (const monster of undeadMonsters) {
        const attackResult = CombatSystem.resolveAttack(hero, monster, 7, 1, 0, undefined, gameState);
        if (attackResult.hit) {
          const damaged = CombatSystem.applyDamage(monster, attackResult.damage);
          updatedMonsters = updatedMonsters.map(m => m.id === monster.id ? damaged as Monster : m);
          logMessages.push(`${hero.name} hits ${monster.name} with Holy Symbol of Ravenkind (+7 vs AC) for ${attackResult.damage} damage. (Roll: ${attackResult.roll})`);
        } else {
          logMessages.push(`${hero.name} misses ${monster.name} with Holy Symbol of Ravenkind (+7 vs AC). (Roll: ${attackResult.roll})`);
        }
      }

      let updatedHero = { ...hero };
      if (gameState.activeEnvironmentCard === 'enc_spirit_of_doom_env') {
        updatedHero = CombatSystem.applyDamage(updatedHero, 1) as Hero;
      }
      updatedHero = { ...updatedHero, items: updatedHero.items.filter(id => id !== card.id) };
      const updatedHeroes = gameState.heroes.map(h => h.id === hero.id ? updatedHero : h);
      return {
        newState: { ...gameState, heroes: updatedHeroes, monsters: updatedMonsters },
        message: `${hero.name} activated the Holy Symbol of Ravenkind. Attack results:\n` + logMessages.join('\n'),
        success: true
      };
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
      if (gameState.activeEnvironmentCard === 'enc_spirit_of_doom_env') {
        updatedHero = CombatSystem.applyDamage(updatedHero, 1) as Hero;
      }
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

    if (!target) {
      return {
        newState: { ...gameState, itemCharges: { ...(gameState.itemCharges ?? {}), [card.id]: newCharges } },
        message: 'No target selected. Necklace charge wasted.',
        success: false,
      };
    }

    if (target.type !== 'monster') {
      return {
        newState: { ...gameState, itemCharges: { ...(gameState.itemCharges ?? {}), [card.id]: newCharges } },
        message: 'Necklace of Fireballs can only target monsters.',
        success: false,
      };
    }

    let updatedMonsters = [...gameState.monsters];
    let logMessages: string[] = [];
    const monsterTarget = target as Monster;

    // AoE damage to all monsters on the target's tile
    const targetTile = gameState.tiles.find(t =>
      t.x === monsterTarget.position.x && t.z === monsterTarget.position.z
    );
    if (targetTile) {
      const monstersOnTile = gameState.monsters.filter(m =>
        m.position.x === targetTile.x && m.position.z === targetTile.z && m.hp > 0 && !m.isDefeated
      );
      for (const monster of monstersOnTile) {
        const damaged = CombatSystem.applyDamage(monster, 1);
        updatedMonsters = updatedMonsters.map(m => m.id === monster.id ? { ...damaged } as Monster : m);
        logMessages.push(`${monster.name} takes 1 fire damage`);
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

    let newState = { ...gameState };
    const glyphId = `glyph_${newState.logIdCounter}`;
    newState.logIdCounter = (newState.logIdCounter ?? 0) + 1;

    const glyph: TileEffect = {
      id: glyphId,
      tileId: heroTile.id,
      type: 'glyph_warding',
      heroId: hero.id,
      cardId: card.id,
      isExpended: false,
      description: 'Monsters cannot enter this tile (Glyph of Warding).',
    };

    const tileEffects = [...(newState.tileEffects ?? []), glyph];
    const updatedHero = { ...hero, items: hero.items.filter(id => id !== card.id) };
    const updatedHeroes = newState.heroes.map(h => h.id === hero.id ? updatedHero : h);

    return {
      newState: {
        ...newState,
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
   * Gets effective stats for a hero including base stats and item bonuses. (Read-only.)
   */
  public static getEffectiveStats(
    hero: Hero,
    allCards: Card[]
  ): { ac: number; attackBonus: number; damage: number; speed: number } {
    const bonuses = this.getHeroItemBonuses(hero, allCards);
    return {
      ac: hero.ac + bonuses.defenseBonus,
      attackBonus: (hero.attackBonus ?? 0) + bonuses.attackBonus,
      damage: (hero.damage ?? 1) + bonuses.damageBonus,
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
    deckName: DeckKey,
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
   * Only fires the first matching effect — assumes single-effect-per-tile.
   * If multiple effects per tile are needed, switch to filter + iterate.
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
      let tempState = { ...gameState };
      const logId = String(tempState.logIdCounter);
      tempState.logIdCounter = (tempState.logIdCounter ?? 0) + 1;

      return {
        newState: {
          ...tempState,
          tileEffects: tileEffects.map(te =>
            te.id === effect.id ? { ...te, isExpended: true } : te
          ),
          log: [
            ...tempState.log,
            {
              id: logId,
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
   * Scans for any newly defeated monsters (HP <= 0, but not yet marked as defeated or still owned by a hero).
   * Moves them to the experience pile, resets ownership, and awards a treasure card if it's the first defeat of the turn.
   */
  public static processDefeatedMonsters(gameState: GameState): GameState {
    let newState = { ...gameState };
    
    // Find monsters whose HP <= 0, but are not yet marked isDefeated OR still have an owner
    const defeatedMonsters = newState.monsters.filter(m => m.hp <= 0 && (!m.isDefeated || m.ownedByHeroId !== null));
    
    if (defeatedMonsters.length === 0) {
      return newState;
    }

    const currentHero = newState.heroes.find(h => h.id === newState.currentHeroId);
    let updatedMonsters = [...newState.monsters];
    let updatedExperiencePile = [...newState.experiencePile];
    let logs = [...newState.log];
    let currentCounter = newState.logIdCounter ?? 0;

    for (const m of defeatedMonsters) {
      // Mark as defeated and unowned
      updatedMonsters = updatedMonsters.map(mon => 
        mon.id === m.id ? { ...mon, isDefeated: true, ownedByHeroId: null } : mon
      );

      // Determine template ID (e.g. monster_skeleton_1 -> monster_skeleton)
      const parts = m.id.split('_');
      const xpCardId = m.templateId || (parts.length >= 2 ? `${parts[0]}_${parts[1]}` : m.id);
      const cleanXpCardId = xpCardId.startsWith('monster_') ? xpCardId : `monster_${m.monsterType.toLowerCase()}`;
      
      updatedExperiencePile.push(cleanXpCardId);
      
      logs.push({
        id: String(currentCounter),
        timestamp: new Date().toISOString(),
        message: `💀 ${m.name} is defeated! Added ${cleanXpCardId} to the experience pile (+${m.experienceValue || 1} XP).`,
        type: 'system' as const
      });
      currentCounter++;

      // Draw treasure card if it's the first monster defeated this turn and a hero did it
      // Only draw treasure for the first defeated monster per turn (rulebook: one treasure per turn)
      if (newState.treasuresDrawnThisTurn === 0 && currentHero) {
        // Run Moment's Respite check first
        const respiteResult = TreasureSystem.checkAndDiscardRespite({
          ...newState,
          monsters: updatedMonsters,
          experiencePile: updatedExperiencePile,
          logIdCounter: currentCounter
        }, 'treasureDeck');
        
        const drawResult = TreasureSystem.drawTreasureCard(respiteResult.gameState, currentHero);
        if (drawResult.card) {
          let tempState = drawResult.newState;
          if (drawResult.card.treasureType === 'blessing') {
            const blessingResult = TreasureSystem.useBlessing(tempState, drawResult.card, currentHero);
            tempState = blessingResult.newState;
          } else if (drawResult.card.treasureType === 'fortune') {
            const fortuneResult = TreasureSystem.useFortune(tempState, drawResult.card, currentHero);
            tempState = fortuneResult.newState;
          } else {
            const assignResult = TreasureSystem.assignItem(tempState, drawResult.card, currentHero);
            tempState = assignResult.newState;
          }
          
          updatedMonsters = tempState.monsters;
          updatedExperiencePile = tempState.experiencePile;
          
          newState = {
            ...newState,
            treasureDeck: tempState.treasureDeck,
            treasuresDrawnThisTurn: tempState.treasuresDrawnThisTurn,
            heroes: tempState.heroes,
            discardPiles: tempState.discardPiles,
            activeBlessings: tempState.activeBlessings,
            logIdCounter: tempState.logIdCounter ?? currentCounter,
          };
          
          currentCounter = tempState.logIdCounter ?? currentCounter;

          logs.push({
            id: String(currentCounter),
            timestamp: new Date().toISOString(),
            message: `🎁 First monster defeated this turn! ${drawResult.message}`,
            type: 'system' as const
          });
          currentCounter++;
        }
      }
    }

    return {
      ...newState,
      monsters: updatedMonsters,
      experiencePile: updatedExperiencePile,
      log: logs.slice(-100),
      logIdCounter: currentCounter
    };
  }

  /**
   * Returns a new GameState with the treasuresDrawnThisTurn counter reset to 0.
   */
  public static resetTreasuresDrawn(gameState: GameState): GameState {
    return { ...gameState, treasuresDrawnThisTurn: 0 };
  }
}
