import React from 'react';
import { Card, PowerType } from '../../game/types';

export interface PowerCardDisplayProps {
    card: Card;
    isSelected: boolean;
    isDisabled: boolean;
    onSelect: (card: Card) => void;
    onDeselect: (card: Card) => void;
    showDetails: boolean;
}

const formatEffect = (effect: any): string => {
    switch (effect.type) {
        case 'attack':
            return `Attack for ${effect.value} damage`;
        case 'heal':
            return `Restore ${effect.value} HP`;
        case 'move':
            return `Move ${effect.value} tiles`;
        case 'buff':
            return `+${effect.value} to next roll (${effect.duration} turns)`;
        case 'damage':
            return `Deal ${effect.value} damage`;
        case 'condition':
            return `Apply condition (${effect.duration} turns)`;
        case 'push':
            return `Push target ${effect.value} tiles`;
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
}) => {
    const handleClick = () => {
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
        backgroundColor: '#1a1a2e',
        border: isSelected ? '2px solid gold' : '2px solid #444',
        borderRadius: '8px',
        cursor: isClickable ? 'pointer' : 'not-allowed',
        opacity: isDisabled && !isSelected ? 0.5 : 1,
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

    return (
        <div style={containerStyle} onClick={isClickable ? handleClick : undefined}>
            {isSelected && <span style={checkmarkStyle}>✓</span>}

            {powerBadge && (
                <div style={{ ...badgeStyle, backgroundColor: powerBadge.color }}>
                    {powerBadge.label}
                </div>
            )}

            <div style={nameStyle}>{card.name}</div>

            {showDetails && (
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

            <div style={descriptionStyle}>{card.description}</div>

            {showDetails && card.flavorText && (
                <div style={flavorTextStyle}>{card.flavorText}</div>
            )}
        </div>
    );
};

export default PowerCardDisplay;
