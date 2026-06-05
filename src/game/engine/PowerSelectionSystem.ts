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
        // Per-hero values can be added here later
        return {
            heroType,
            maxAtWill: 2,
            maxDaily: 1,
            maxUtility: 1,
            totalMax: 4,
        };
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
        if (selection.selectedPowerIds.includes(card.id)) {
            return false;
        }

        // Single pass: build Map<PowerType, count>
        const typeCounts = new Map<PowerType, number>();
        for (const id of selection.selectedPowerIds) {
            const c = allPowerCards.find((pc) => pc.id === id);
            if (c?.powerType) {
                typeCounts.set(c.powerType, (typeCounts.get(c.powerType) ?? 0) + 1);
            }
        }

        const atWillCount = typeCounts.get('at-will') ?? 0;
        const dailyCount = typeCounts.get('daily') ?? 0;
        const utilityCount = typeCounts.get('utility') ?? 0;

        if (card.powerType === 'at-will' && atWillCount >= constraints.maxAtWill) {
            return false;
        }
        if (card.powerType === 'daily' && dailyCount >= constraints.maxDaily) {
            return false;
        }
        if (card.powerType === 'utility' && utilityCount >= constraints.maxUtility) {
            return false;
        }

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
     * Returns { success, message, selection }. Validates per-type minimums and total.
     */
    public static confirmSelection(
        selection: PowerSelection,
        constraints: PowerSelectionConstraints,
        allPowerCards: Card[]
    ): { success: boolean; message: string; selection: PowerSelection } {
        const counts: Partial<Record<PowerType, number>> = {};
        for (const id of selection.selectedPowerIds) {
            const card = allPowerCards.find((c) => c.id === id);
            if (card?.powerType) {
                counts[card.powerType] = (counts[card.powerType] ?? 0) + 1;
            }
        }

        const atWillCount = counts['at-will'] ?? 0;
        if (atWillCount < constraints.maxAtWill) {
            return {
                success: false,
                message: `Select ${constraints.maxAtWill - atWillCount} more at-will power(s) before confirming.`,
                selection,
            };
        }

        const dailyCount = counts['daily'] ?? 0;
        if (dailyCount < constraints.maxDaily) {
            return {
                success: false,
                message: `Select ${constraints.maxDaily - dailyCount} more daily power(s) before confirming.`,
                selection,
            };
        }

        const utilityCount = counts['utility'] ?? 0;
        if (utilityCount < constraints.maxUtility) {
            return {
                success: false,
                message: `Select ${constraints.maxUtility - utilityCount} more utility power(s) before confirming.`,
                selection,
            };
        }

        if (selection.selectedPowerIds.length < constraints.totalMax) {
            const remaining = constraints.totalMax - selection.selectedPowerIds.length;
            return {
                success: false,
                message: `Select ${remaining} more power(s) before confirming.`,
                selection,
            };
        }

        return {
            success: true,
            message: 'Selection confirmed.',
            selection: { ...selection, isConfirmed: true },
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
        let atWillCount = 0;
        let dailyCount = 0;
        let utilityCount = 0;

        const addByType = (type: PowerType, max: number) => {
            for (const card of shuffled) {
                if (selectedIds.length >= constraints.totalMax) break;
                if (!selected.has(card.id) && card.powerType === type) {
                    const typeCount = type === 'at-will' ? atWillCount : type === 'daily' ? dailyCount : utilityCount;
                    if (typeCount >= max) break;
                    selectedIds.push(card.id);
                    selected.add(card.id);
                    if (type === 'at-will') atWillCount++;
                    else if (type === 'daily') dailyCount++;
                    else utilityCount++;
                }
            }
        };

        addByType('at-will', constraints.maxAtWill);
        addByType('daily', constraints.maxDaily);
        addByType('utility', constraints.maxUtility);

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

            // Unconfirmed heroes keep their existing powers
            return hero;
        });
    }
}
