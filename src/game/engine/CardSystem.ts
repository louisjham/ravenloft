import { Card, CardType } from '../types';

/**
 * Handles deck management: drawing, shuffling, and discard piles.
 */
export class CardSystem {
  private decks: Record<string, string[]> = {};
  private discardPiles: Record<string, string[]> = {};

  constructor(initialDecks: Record<string, string[]>) {
    this.decks = initialDecks;
    // Shuffle all initial decks
    Object.keys(this.decks).forEach(type => {
      this.shuffle(type as CardType);
    });
  }

  /**
   * Fisher-Yates shuffle.
   */
  public shuffle(type: string): void {
    const deck = this.decks[type];
    if (!deck) return;

    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
  }

  /**
   * Draws a card of a specific type. If deck is empty, reshuffles discard pile.
   */
  public drawCard(type: string): string | null {
    if (!this.decks[type] || this.decks[type].length === 0) {
      this.reshuffleDiscardIntoDeck(type);
    }

    return this.decks[type]?.pop() || null;
  }

  /**
   * Adds a card to the discard pile.
   */
  public discardCard(type: string, cardId: string): void {
    if (!this.discardPiles[type]) {
      this.discardPiles[type] = [];
    }
    this.discardPiles[type].push(cardId);
  }

  private reshuffleDiscardIntoDeck(type: string): void {
    const discards = this.discardPiles[type];
    if (!discards || discards.length === 0) return;

    this.decks[type] = [...discards];
    this.discardPiles[type] = [];
    this.shuffle(type);
  }

  public getDeck(type: string): string[] {
    return this.decks[type] || [];
  }

  public getDiscardPile(type: string): string[] {
    return this.discardPiles[type] || [];
  }
}
