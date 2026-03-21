import React, { useState } from 'react';
import type { Card, Hero, PowerSelection, PowerType } from '../../game/types';
import PowerSelectionSystem from '../../game/engine/PowerSelectionSystem';
import PowerCardDisplay from './PowerCardDisplay';
import { getPowerCard, getAllPowerCards } from '../../data/powerCardLoader';

export interface PowerSelectionScreenProps {
    heroes: Hero[];
    powerSelections: PowerSelection[];
    onSelectPower: (heroId: string, card: Card) => void;
    onDeselectPower: (heroId: string, cardId: string) => void;
    onConfirmHero: (heroId: string) => void;
    onAutoSelect: (heroId: string) => void;
    onConfirmAll: () => void;
}

const PowerSelectionScreen: React.FC<PowerSelectionScreenProps> = ({
    heroes,
    powerSelections,
    onSelectPower,
    onDeselectPower,
    onConfirmHero,
    onAutoSelect,
    onConfirmAll,
}) => {
    // LOCAL STATE
    const [activeHeroId, setActiveHeroId] = useState<string>(heroes[0]?.id ?? '');
    const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

    // DERIVED VALUES (computed inside render)
    const activeHero = heroes.find(h => h.id === activeHeroId);
    const activeSelection = powerSelections.find(s => s.heroId === activeHeroId);
    const constraints = activeHero
        ? PowerSelectionSystem.getConstraints(activeHero.heroClass)
        : null;
    const availablePowers = activeHero
        ? PowerSelectionSystem.getAvailablePowers(activeHero.heroClass)
        : [];
    const allPowerCards = getAllPowerCards();

    const allConfirmed = heroes.every(h =>
        powerSelections.find(s => s.heroId === h.id)?.isConfirmed
    );

    // Guard
    if (!activeHero || !activeSelection || !constraints) {
        return null;
    }

    // Helper to get selected count by power type
    const getSelectedCountByType = (powerType: PowerType): number => {
        return activeSelection.selectedPowerIds
            .map(id => allPowerCards.find(c => c.id === id))
            .filter((c): c is Card => c !== undefined && c.powerType === powerType)
            .length;
    };

    // Group available powers by type
    const powerTypes: PowerType[] = ['at-will', 'daily', 'utility'];
    const groupedPowers = powerTypes.map(type => ({
        type,
        cards: availablePowers.filter(c => c.powerType === type),
    }));

    // Styles
    const containerStyle: React.CSSProperties = {
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        backgroundColor: '#1a1a2e',
        color: '#fff',
        fontFamily: 'Cinzel, serif',
    };

    const topBarStyle: React.CSSProperties = {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '16px',
        borderBottom: '2px solid #444',
    };

    const titleStyle: React.CSSProperties = {
        fontSize: '24px',
        fontWeight: 'bold',
        marginBottom: '12px',
        color: '#d4af37',
    };

    const heroButtonsStyle: React.CSSProperties = {
        display: 'flex',
        gap: '12px',
        flexWrap: 'wrap',
        justifyContent: 'center',
    };

    const heroButtonStyle: React.CSSProperties = {
        padding: '8px 16px',
        backgroundColor: '#2a2a4e',
        border: '2px solid #444',
        borderRadius: '4px',
        color: '#fff',
        cursor: 'pointer',
        fontSize: '14px',
        fontFamily: 'Cinzel, serif',
    };

    const activeHeroButtonStyle: React.CSSProperties = {
        ...heroButtonStyle,
        backgroundColor: '#3a3a6e',
        borderColor: '#d4af37',
        fontWeight: 'bold',
        textDecoration: 'underline',
    };

    const mainPanelStyle: React.CSSProperties = {
        display: 'flex',
        flexDirection: 'row',
        flex: 1,
        overflow: 'hidden',
    };

    const leftPanelStyle: React.CSSProperties = {
        flex: 1,
        padding: '16px',
        overflowY: 'auto',
        borderRight: '2px solid #444',
    };

    const rightPanelStyle: React.CSSProperties = {
        flex: 1,
        padding: '16px',
        overflowY: 'auto',
    };

    const sectionHeaderStyle: React.CSSProperties = {
        fontSize: '16px',
        fontWeight: 'bold',
        color: '#d4af37',
        marginTop: '16px',
        marginBottom: '8px',
        borderBottom: '1px solid #444',
        paddingBottom: '4px',
    };

    const cardsContainerStyle: React.CSSProperties = {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        marginBottom: '24px',
    };

    const cardWrapperStyle: React.CSSProperties = {
        position: 'relative',
    };

    const cardNameClickAreaStyle: React.CSSProperties = {
        cursor: 'pointer',
    };

    const selectedHeaderStyle: React.CSSProperties = {
        fontSize: '16px',
        fontWeight: 'bold',
        color: '#d4af37',
        marginBottom: '12px',
        borderBottom: '1px solid #444',
        paddingBottom: '4px',
    };

    const bottomBarStyle: React.CSSProperties = {
        display: 'flex',
        justifyContent: 'center',
        gap: '16px',
        padding: '16px',
        borderTop: '2px solid #444',
    };

    const buttonStyle: React.CSSProperties = {
        padding: '12px 24px',
        fontSize: '16px',
        fontFamily: 'Cinzel, serif',
        fontWeight: 'bold',
        border: '2px solid #d4af37',
        borderRadius: '4px',
        cursor: 'pointer',
        backgroundColor: '#2a2a4e',
        color: '#fff',
    };

    const disabledButtonStyle: React.CSSProperties = {
        ...buttonStyle,
        opacity: 0.5,
        cursor: 'not-allowed',
        borderColor: '#666',
    };

    const confirmButtonStyle: React.CSSProperties = {
        ...buttonStyle,
        backgroundColor: '#3a6a3a',
    };

    const startButtonStyle: React.CSSProperties = {
        ...buttonStyle,
        backgroundColor: '#6a3a3a',
    };

    // DIAGNOSTIC: Log layout info
    React.useEffect(() => {
        console.log('[PowerSelectionScreen] Render with activeHero:', activeHeroId);
        console.log('[PowerSelectionScreen] Available powers count:', availablePowers.length);
        console.log('[PowerSelectionScreen] Selected powers count:', activeSelection.selectedPowerIds.length);
    }, [activeHeroId, availablePowers.length, activeSelection.selectedPowerIds.length]);

    return (
        <div style={containerStyle}>
            {/* TOP BAR */}
            <div style={topBarStyle} id="power-top-bar">
                <div style={titleStyle}>Choose Your Powers</div>
                <div style={heroButtonsStyle}>
                    {heroes.map(hero => {
                        const selection = powerSelections.find(s => s.heroId === hero.id);
                        const isActive = hero.id === activeHeroId;
                        return (
                            <button
                                key={hero.id}
                                style={isActive ? activeHeroButtonStyle : heroButtonStyle}
                                onClick={() => setActiveHeroId(hero.id)}
                            >
                                {hero.heroClass || hero.id}
                                {selection?.isConfirmed && ' ✓'}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* MAIN PANEL */}
            <div style={mainPanelStyle}>
                {/* LEFT — Available Powers */}
                <div style={leftPanelStyle}>
                    {groupedPowers.map(({ type, cards }) => {
                        const selectedCount = getSelectedCountByType(type);
                        const maxForType = type === 'at-will' ? constraints.maxAtWill :
                            type === 'daily' ? constraints.maxDaily : constraints.maxUtility;
                        const typeLabel = type.toUpperCase();

                        return (
                            <div key={type}>
                                <div style={sectionHeaderStyle}>
                                    {typeLabel} ({selectedCount} of {maxForType} selected)
                                </div>
                                <div style={cardsContainerStyle}>
                                    {cards.map(card => {
                                        const isSelected = activeSelection.selectedPowerIds.includes(card.id);
                                        const isDisabled = !isSelected &&
                                            !PowerSelectionSystem.canSelectPower(
                                                card,
                                                activeSelection,
                                                constraints,
                                                allPowerCards
                                            );
                                        const isExpanded = expandedCardId === card.id;

                                        return (
                                            <div key={card.id} style={cardWrapperStyle} data-card-id={card.id}>
                                                <div
                                                    style={cardNameClickAreaStyle}
                                                    onClick={() => {
                                                        console.log('[PowerSelectionScreen] Card clicked:', card.name, 'expanded:', expandedCardId === card.id);
                                                        setExpandedCardId(
                                                            expandedCardId === card.id ? null : card.id
                                                        );
                                                    }}
                                                >
                                                    <PowerCardDisplay
                                                        card={card}
                                                        isSelected={isSelected}
                                                        isDisabled={isDisabled}
                                                        showDetails={isExpanded}
                                                        onSelect={(c) => {
                                                            setExpandedCardId(null);
                                                            onSelectPower(activeHeroId, c);
                                                        }}
                                                        onDeselect={(c) => onDeselectPower(activeHeroId, c.id)}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* RIGHT — Selected Powers */}
                <div style={rightPanelStyle}>
                    <div style={selectedHeaderStyle}>
                        Selected Powers ({activeSelection.selectedPowerIds.length} / {constraints.totalMax})
                    </div>
                    <div style={cardsContainerStyle}>
                        {activeSelection.selectedPowerIds.map(cardId => {
                            const card = getPowerCard(cardId);
                            return (
                                <PowerCardDisplay
                                    key={cardId}
                                    card={card}
                                    isSelected={true}
                                    isDisabled={false}
                                    showDetails={false}
                                    onSelect={() => { }}
                                    onDeselect={(c) => onDeselectPower(activeHeroId, c.id)}
                                />
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* BOTTOM BAR */}
            <div style={bottomBarStyle} id="power-bottom-bar">
                <button
                    style={activeSelection.isConfirmed ? disabledButtonStyle : buttonStyle}
                    disabled={activeSelection.isConfirmed}
                    onClick={() => {
                        console.log('[PowerSelectionScreen] Auto-Select clicked');
                        onAutoSelect(activeHeroId);
                    }}
                >
                    Auto-Select
                </button>

                {activeSelection.selectedPowerIds.length < constraints.totalMax ? (
                    <button style={disabledButtonStyle} disabled>
                        Select {constraints.totalMax - activeSelection.selectedPowerIds.length} more
                    </button>
                ) : (
                    <button
                        style={confirmButtonStyle}
                        onClick={() => {
                            console.log('[PowerSelectionScreen] Confirm clicked');
                            onConfirmHero(activeHeroId);
                        }}
                    >
                        Confirm
                    </button>
                )}

                {allConfirmed && (
                    <button
                        style={startButtonStyle}
                        onClick={() => {
                            console.log('[PowerSelectionScreen] Start Game clicked');
                            onConfirmAll();
                        }}
                    >
                        Start Game
                    </button>
                )}
            </div>
        </div>
    );
};

export default PowerSelectionScreen;
