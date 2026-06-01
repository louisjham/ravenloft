import React from 'react';
import { Card, PowerType, Effect } from '../../game/types';

export interface PowerCardDisplayProps {
    card: Card;
    isSelected: boolean;
    isDisabled: boolean;
    onSelect: (card: Card) => void;
    onDeselect: (card: Card) => void;
    showDetails: boolean;
    isFlipped?: boolean;
}

const formatEffect = (effect: Effect): string => {
    switch (effect.type) {
        case 'damage':
            return `Deal ${effect.value} damage`;
        case 'heal':
            return `Restore ${effect.value} HP`;
        case 'move':
            return `Move ${effect.value} tiles`;
        case 'attack_bonus':
            return `+${effect.value} Attack (${effect.duration} turns)`;
        case 'defense_bonus':
            return `+${effect.value} AC (${effect.duration} turns)`;
        case 'status_effect':
            return `Apply condition (${effect.duration} turns)`;
        case 'draw_card':
            return `Draw a card`;
        case 'flip_power':
            return `Flip a used power`;
        default:
            return effect.type;
    }
};

const getPowerBadgeConfig = (powerType: PowerType | undefined) => {
    switch (powerType) {
        case 'at-will':
            return { label: 'AT-WILL', color: '#2d6a2d' };
        case 'daily':
            return { label: 'DAILY', color: '#8b1a1a' };
        case 'utility':
            return { label: 'UTILITY', color: '#1a3a8b' };
        default:
            return null;
    }
};

export const PowerCardDisplay: React.FC<PowerCardDisplayProps> = ({
    card,
    isSelected,
    isDisabled,
    onSelect,
    onDeselect,
    showDetails,
    isFlipped,
}) => {
    const handleClick = () => {
        if (isFlipped) return;
        if (isSelected) {
            onDeselect(card);
        } else if (!isDisabled) {
            onSelect(card);
        }
    };

    const powerBadge = getPowerBadgeConfig(card.powerType);
    const isClickable = !isDisabled || isSelected;

    const containerStyle: React.CSSProperties = {
        position: 'relative',
        padding: '12px',
        backgroundColor: isFlipped ? '#2a1a1a' : '#1a1a2e',
        border: isSelected ? '2px solid gold' : isFlipped ? '2px solid #662222' : '2px solid #444',
        borderRadius: '8px',
        cursor: isFlipped ? 'default' : (isClickable ? 'pointer' : 'not-allowed'),
        opacity: isFlipped ? 0.4 : (isDisabled && !isSelected ? 0.5 : 1),
        minWidth: '200px',
        maxWidth: '280px',
    };

    const checkmarkStyle: React.CSSProperties = {
        position: 'absolute',
        top: '8px',
        right: '8px',
        color: 'gold',
        fontSize: '18px',
        fontWeight: 'bold',
    };

    const nameStyle: React.CSSProperties = {
        fontWeight: 'bold',
        fontSize: '16px',
        color: '#fff',
        marginBottom: '4px',
    };

    const badgeStyle: React.CSSProperties = {
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: '11px',
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: '8px',
        textTransform: 'uppercase',
    };

    const statStyle: React.CSSProperties = {
        fontSize: '13px',
        color: '#ccc',
        marginBottom: '2px',
    };

    const effectsHeaderStyle: React.CSSProperties = {
        fontSize: '13px',
        fontWeight: 'bold',
        color: '#aaa',
        marginTop: '8px',
        marginBottom: '4px',
    };

    const effectItemStyle: React.CSSProperties = {
        fontSize: '12px',
        color: '#bbb',
        marginBottom: '2px',
        paddingLeft: '8px',
    };

    const descriptionStyle: React.CSSProperties = {
        fontSize: '12px',
        color: '#888',
        marginTop: '8px',
        marginBottom: '4px',
    };

    const flavorTextStyle: React.CSSProperties = {
        fontSize: '11px',
        color: '#666',
        fontStyle: 'italic',
        marginTop: '6px',
    };

    const flippedBadgeStyle: React.CSSProperties = {
        ...badgeStyle,
        backgroundColor: '#662222',
        border: '1px solid #ff4444',
    };

    return (
        <div style={containerStyle} onClick={isFlipped ? undefined : (isClickable ? handleClick : undefined)}>
            {isSelected && <span style={checkmarkStyle}>✓</span>}

            {isFlipped && (
                <div style={flippedBadgeStyle}>FLIPPED</div>
            )}

            {!isFlipped && powerBadge && (
                <div style={{ ...badgeStyle, backgroundColor: powerBadge.color }}>
                    {powerBadge.label}
                </div>
            )}

            <div style={{ ...nameStyle, color: isFlipped ? '#884444' : '#fff' }}>
                {isFlipped ? '??? (Face Down)' : card.name}
            </div>

            {!isFlipped && showDetails && (
                <>
                    {card.attackBonus !== undefined && (
                        <div style={statStyle}>Attack: +{card.attackBonus}</div>
                    )}

                    {card.damage !== undefined && (
                        <div style={statStyle}>Damage: {card.damage}</div>
                    )}

                    {card.range !== undefined && (
                        <div style={statStyle}>Range: {card.range}</div>
                    )}

                    {card.effects && card.effects.length > 0 && (
                        <>
                            <div style={effectsHeaderStyle}>Effects:</div>
                            {card.effects.map((effect, index) => (
                                <div key={index} style={effectItemStyle}>
                                    {formatEffect(effect)}
                                </div>
                            ))}
                        </>
                    )}
                </>
            )}

            <div style={descriptionStyle}>{isFlipped ? 'Unavailable until refreshed' : card.description}</div>

            {!isFlipped && showDetails && card.flavorText && (
                <div style={flavorTextStyle}>{card.flavorText}</div>
            )}
        </div>
    );
};

export default PowerCardDisplay;
