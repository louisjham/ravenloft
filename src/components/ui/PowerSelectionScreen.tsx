import React, { useState } from 'react';
import type { Card, Hero, PowerSelection, PowerType } from '../../game/types';
import PowerSelectionSystem from '../../game/engine/PowerSelectionSystem';
import PowerCardDisplay from './PowerCardDisplay';
import { getPowerCard, getAllPowerCards } from '../../data/powerCardLoader';
import { useGameStore } from '../../store/gameStore';
import { OptionsOverlay } from './OptionsOverlay';

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
    const [showOptions, setShowOptions] = useState(false);

    const settings = useGameStore(s => s.settings);
    const setAIControlMode = useGameStore(s => s.setAIControlMode);

    const isPowerLocked = (cardId: string): boolean => {
        return ['fighter_dragons_breath', 'cleric_healing_word', 'wizard_fey_step', 'rogue_sneak_attack'].includes(cardId);
    };

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
        flexShrink: 0,
        zIndex: 10,
        position: 'relative',
        overflow: 'hidden',
        minHeight: '100px',
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
        width: '100%',
        maxWidth: '100%',
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
        border: '2px solid #d4af37',
        fontWeight: 'bold',
        textDecoration: 'underline',
    };

    const mainPanelStyle: React.CSSProperties = {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        flex: 1,
        overflow: 'hidden',
        position: 'relative',
        zIndex: 1,
        gap: '0',
    };

    const leftPanelStyle: React.CSSProperties = {
        padding: '16px',
        overflowY: 'auto',
        borderRight: '2px solid #444',
        minWidth: 0,
    };

    const rightPanelStyle: React.CSSProperties = {
        padding: '16px',
        overflowY: 'auto',
        minWidth: 0,
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
        maxWidth: '100%',
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
        flexShrink: 0,
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
        border: '2px solid #666',
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
                <button
                    id="power-selection-back-menu"
                    className="gothic-button"
                    style={{
                        position: 'absolute',
                        top: '16px',
                        left: '16px',
                        padding: '6px 14px',
                        fontSize: '0.8rem',
                        background: 'rgba(20, 10, 30, 0.85)',
                        border: '1px solid var(--color-gold)',
                        color: 'var(--color-gold)',
                        cursor: 'pointer',
                        zIndex: 20
                    }}
                    onClick={() => {
                        if (window.confirm('Return to the Main Menu? Your hero power choices will be lost.')) {
                            useGameStore.getState().quitToMainMenu();
                        }
                    }}
                >
                    ← Main Menu
                </button>

                <button
                    id="power-selection-options"
                    className="gothic-button"
                    style={{
                        position: 'absolute',
                        top: '16px',
                        right: '16px',
                        padding: '6px 14px',
                        fontSize: '0.8rem',
                        background: 'rgba(20, 10, 30, 0.85)',
                        border: '1px solid var(--color-gold)',
                        color: 'var(--color-gold)',
                        cursor: 'pointer',
                        zIndex: 20
                    }}
                    onClick={() => setShowOptions(true)}
                >
                    ⚙ Options
                </button>

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

                {/* Party AI Automation Presets */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: '#d4af37', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Party Mode:
                    </span>
                    {[
                        { id: 'solo', label: 'Solo (1 Hero + Companions)', desc: 'You control 1 hero; companions act automatically' },
                        { id: 'all_ai', label: 'Director (All AI)', desc: 'All heroes autonomous; you approve turn endings' },
                        { id: 'manual', label: 'All Manual', desc: 'Full manual control of each hero' }
                    ].map(m => {
                        const isSelected = (settings.aiControlMode ?? 'solo') === m.id;
                        return (
                            <button
                                key={m.id}
                                onClick={() => setAIControlMode(m.id as any, heroes[0]?.id)}
                                style={{
                                    padding: '4px 10px',
                                    fontSize: '0.72rem',
                                    background: isSelected ? 'var(--color-accent)' : 'rgba(0,0,0,0.4)',
                                    border: `1px solid ${isSelected ? 'var(--color-gold)' : '#555'}`,
                                    color: isSelected ? '#fff' : '#aaa',
                                    borderRadius: '3px',
                                    cursor: 'pointer',
                                    fontFamily: 'Cinzel, serif',
                                    boxShadow: isSelected ? '0 0 8px rgba(139,0,0,0.6)' : 'none'
                                }}
                                title={m.desc}
                            >
                                {m.label}
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
                                                        isDisabled={isDisabled || isPowerLocked(card.id)}
                                                        showDetails={isExpanded}
                                                        onSelect={(c) => {
                                                            if (isPowerLocked(c.id)) return;
                                                            setExpandedCardId(null);
                                                            onSelectPower(activeHeroId, c);
                                                        }}
                                                        onDeselect={(c) => {
                                                            if (isPowerLocked(c.id)) return;
                                                            onDeselectPower(activeHeroId, c.id);
                                                        }}
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
                            const locked = isPowerLocked(cardId);
                            return (
                                <PowerCardDisplay
                                    key={cardId}
                                    card={card}
                                    isSelected={true}
                                    isDisabled={locked}
                                    showDetails={false}
                                    onSelect={() => { }}
                                    onDeselect={(c) => {
                                        if (locked) return;
                                        onDeselectPower(activeHeroId, c.id);
                                    }}
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
            {showOptions && <OptionsOverlay onClose={() => setShowOptions(false)} />}
        </div>
    );
};

export default PowerSelectionScreen;
