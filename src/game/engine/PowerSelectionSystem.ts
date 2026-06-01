import type { Card, PowerType, Hero } from '../types';
import { getPowerCardsForHero, getPowerCardsByType } from '../../data/powerCardLoader';

export interface PowerSelectionConstraints {
    heroType: string;
    maxAtWill: number;
    maxDaily: number;
    maxUtility: number;
    totalMax: number;
}

export interface PowerSelection {
    heroId: string;
    selectedPowerIds: string[];
    isConfirmed: boolean;
}

/**
 * Pure static methods for power selection logic.
 * No mutation. No side effects.
 */
export default class PowerSelectionSystem {
    /**
     * Get constraints for a hero type.
     * MVP returns same values for all hero types.
     */
    public static getConstraints(heroType: string): PowerSelectionConstraints {
        switch (heroType) {
            // Per-hero values can be added here later
            default:
                return {
                    heroType,
                    maxAtWill: 2,
                    maxDaily: 1,
                    maxUtility: 1,
                    totalMax: 4,
                };
        }
    }

    /**
     * Get all available powers for a hero type.
     * Only includes cards with a powerType field.
     */
    public static getAvailablePowers(heroType: string): Card[] {
        return getPowerCardsForHero(heroType).filter(
            (card) => !!card.powerType
        );
    }

    /**
     * Check if a power can be selected given current selection and constraints.
     */
    public static canSelectPower(
        card: Card,
        selection: PowerSelection,
        constraints: PowerSelectionConstraints,
        allPowerCards: Card[]
    ): boolean {
        // Check if card already selected
        if (selection.selectedPowerIds.includes(card.id)) {
            return false;
        }

        // Count selected cards by powerType
        const atWillCount = selection.selectedPowerIds
            .map((id) => allPowerCards.find((c) => c.id === id))
            .filter((c): c is Card => c !== undefined && c.powerType === 'at-will').length;

        const dailyCount = selection.selectedPowerIds
            .map((id) => allPowerCards.find((c) => c.id === id))
            .filter((c): c is Card => c !== undefined && c.powerType === 'daily').length;

        const utilityCount = selection.selectedPowerIds
            .map((id) => allPowerCards.find((c) => c.id === id))
            .filter((c): c is Card => c !== undefined && c.powerType === 'utility').length;

        // Check type-specific limits
        if (card.powerType === 'at-will' && atWillCount >= constraints.maxAtWill) {
            return false;
        }
        if (card.powerType === 'daily' && dailyCount >= constraints.maxDaily) {
            return false;
        }
        if (card.powerType === 'utility' && utilityCount >= constraints.maxUtility) {
            return false;
        }

        // Check total limit
        if (selection.selectedPowerIds.length >= constraints.totalMax) {
            return false;
        }

        return true;
    }

    /**
     * Select a power if valid. Returns new selection object.
     */
    public static selectPower(
        card: Card,
        selection: PowerSelection,
        constraints: PowerSelectionConstraints,
        allPowerCards: Card[]
    ): PowerSelection {
        if (!this.canSelectPower(card, selection, constraints, allPowerCards)) {
            return selection;
        }

        return {
            ...selection,
            selectedPowerIds: [...selection.selectedPowerIds, card.id],
            isConfirmed: false, // Selecting a new power un-confirms
        };
    }

    /**
     * Deselect a power by ID. Returns new selection object.
     */
    public static deselectPower(
        cardId: string,
        selection: PowerSelection
    ): PowerSelection {
        if (!selection.selectedPowerIds.includes(cardId)) {
            return selection;
        }

        return {
            ...selection,
            selectedPowerIds: selection.selectedPowerIds.filter((id) => id !== cardId),
            isConfirmed: false, // Deselecting un-confirms
        };
    }

    /**
     * Confirm the current power selection.
     * Returns error object if not enough powers selected.
     */
    public static confirmSelection(
        selection: PowerSelection,
        constraints: PowerSelectionConstraints
    ): PowerSelection | { error: string } {
        if (selection.selectedPowerIds.length < constraints.totalMax) {
            const remaining = constraints.totalMax - selection.selectedPowerIds.length;
            return {
                error: `Select ${remaining} more power(s) before confirming.`,
            };
        }

        return {
            ...selection,
            isConfirmed: true,
        };
    }

    /**
     * Auto-select powers for a hero using Fisher-Yates shuffle.
     */
    public static autoSelectPowers(
        heroType: string,
        heroId: string,
        constraints: PowerSelectionConstraints
    ): PowerSelection {
        const allPowers = this.getAvailablePowers(heroType);

        // Fisher-Yates shuffle
        const shuffled = [...allPowers];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        const selectedIds: string[] = [];
        const selected = new Set<string>();

        // Helper to add cards by type
        const addByType = (type: PowerType, max: number) => {
            for (const card of shuffled) {
                if (selectedIds.length >= constraints.totalMax) break;
                if (!selected.has(card.id) && card.powerType === type && selectedIds.filter(
                    (id) => shuffled.find((c) => c.id === id)?.powerType === type
                ).length < max) {
                    selectedIds.push(card.id);
                    selected.add(card.id);
                }
            }
        };

        // Select by type
        addByType('at-will', constraints.maxAtWill);
        addByType('daily', constraints.maxDaily);
        addByType('utility', constraints.maxUtility);

        // Fill remaining slots with any unselected cards
        for (const card of shuffled) {
            if (selectedIds.length >= constraints.totalMax) break;
            if (!selected.has(card.id)) {
                selectedIds.push(card.id);
                selected.add(card.id);
            }
        }

        return {
            heroId,
            selectedPowerIds: selectedIds,
            isConfirmed: true,
        };
    }

    /**
     * Apply confirmed power selections to heroes.
     * Returns new Hero[] with selectedPowerIds set.
     */
    public static applySelectionsToHeroes(
        heroes: Hero[],
        selections: PowerSelection[]
    ): Hero[] {
        return heroes.map((hero) => {
            const selection = selections.find(
                (s) => s.heroId === hero.id && s.isConfirmed
            );

            if (selection) {
                return {
                    ...hero,
                    selectedPowerIds: selection.selectedPowerIds,
                };
            }

            return {
                ...hero,
                selectedPowerIds: [],
            };
        });
    }
}
