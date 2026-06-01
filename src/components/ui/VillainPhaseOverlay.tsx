import React, { useEffect, useState } from 'react';
import { Monster, Trap } from '../../game/types';
import { DataLoader } from '../../game/dataLoader';

interface VillainPhaseOverlayProps {
    activeVillainId: string | null;
    villainQueue: string[];
    monsters: Monster[];
    traps: Trap[];
    isVillainPhaseActive: boolean;
}

const VillainPhaseOverlay: React.FC<VillainPhaseOverlayProps> = ({
    activeVillainId,
    villainQueue,
    monsters,
    traps,
    isVillainPhaseActive,
}) => {
    const [displayVillainId, setDisplayVillainId] = useState<string | null>(activeVillainId);
    // Snapshot progress index at the moment of display — not read reactively —
    // to prevent the counter jumping while the card is still showing the previous villain.
    const [displayProgressIndex, setDisplayProgressIndex] = useState<number>(-1);
    const [displayQueueLength, setDisplayQueueLength] = useState<number>(0);
    const [isVisible, setIsVisible] = useState(false);
    const [opacity, setOpacity] = useState(0);

    const getVillainData = (id: string | null) => {
        if (!id) return null;
        const monster = monsters.find(m => m.id === id);
        if (monster) return { type: 'monster' as const, data: monster };
        const trap = traps.find(t => t.id === id);
        if (trap) return { type: 'trap' as const, data: trap };
        return null;
    };

    // Auto-advance behavior using useEffect
    useEffect(() => {
        if (!isVillainPhaseActive) {
            setOpacity(0);
            // Delay unmount to let the CSS fade-out transition complete (300ms)
            const hideTimer = setTimeout(() => setIsVisible(false), 350);
            return () => clearTimeout(hideTimer);
        }

        setIsVisible(true);

        if (activeVillainId !== null) {
            // Snapshot both the villain and its queue position together so the
            // progress text stays in sync with the card being displayed.
            const idx = villainQueue.indexOf(activeVillainId);
            setDisplayVillainId(activeVillainId);
            setDisplayProgressIndex(idx);
            setDisplayQueueLength(villainQueue.length);
            setOpacity(1);

            // Show for 2300ms then fade out before next monster activates
            const fadeOutTimer = setTimeout(() => {
                setOpacity(0);
            }, 2300);

            return () => clearTimeout(fadeOutTimer);
        } else {
            // When activeVillainId becomes null, fade out then hide
            setOpacity(0);
            const hideTimer = setTimeout(() => setIsVisible(false), 350);
            return () => clearTimeout(hideTimer);
        }
    }, [activeVillainId, isVillainPhaseActive]); // villainQueue intentionally omitted — snapshot only

    if (!isVisible) {
        return null;
    }

    const villainData = getVillainData(displayVillainId);
    if (!villainData) return null;

    const progressText = displayProgressIndex >= 0 && displayQueueLength > 0
        ? `Activating ${displayProgressIndex + 1} of ${displayQueueLength}`
        : '';

    // --- Resolve display data ---
    let name = '';
    let tokenImage = '';
    let tacticsText = '';
    let specialAbilityText = '';
    let headerLabel = 'MONSTER ACTIVATION';

    if (villainData.type === 'monster') {
        const m = villainData.data as Monster;
        name = m.name;
        tokenImage = `/assets/tokens/Token_Monster_${m.name.replace(/\s+/g, '')}.png`;
        tacticsText = m.tacticsText || 'Attacks the closest hero.';
        specialAbilityText = m.specialAbilityText || '';
    } else {
        const t = villainData.data as Trap;
        headerLabel = 'TRAP ACTIVATES';
        // Look up the real card to get the actual description
        const trapCard = DataLoader.getInstance().getCardById(t.cardId);
        name = trapCard?.name ?? t.cardId;
        tokenImage = `/assets/tokens/Token_Encounter_Generic.png`;
        tacticsText = trapCard?.description ?? 'The trap springs, striking at nearby heroes!';
    }

    // --- Styles ---
    const overlayStyle: React.CSSProperties = {
        position: 'fixed',
        bottom: '40px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        pointerEvents: 'none',
        opacity: opacity,
        transition: 'opacity 300ms ease-in-out',
    };

    const containerStyle: React.CSSProperties = {
        backgroundColor: 'rgba(20, 10, 30, 0.95)',
        border: '2px solid #8b0000',
        borderRadius: '8px',
        padding: '24px 32px',
        width: '600px',
        maxWidth: '90vw',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        boxShadow: '0 4px 30px rgba(100, 0, 0, 0.6), inset 0 0 20px rgba(0,0,0,0.8)',
    };

    const headerContainerStyle: React.CSSProperties = {
        display: 'flex',
        justifyContent: 'space-between',
        width: '100%',
        alignItems: 'center',
        borderBottom: '1px solid #5a1111',
        paddingBottom: '12px',
        marginBottom: '16px',
    };

    const titleStyle: React.CSSProperties = {
        fontFamily: 'Cinzel, serif',
        fontSize: '24px',
        fontWeight: 'bold',
        color: '#ff4444',
        textShadow: '0 0 10px rgba(255, 0, 0, 0.5)',
        letterSpacing: '2px',
    };

    const progressStyle: React.CSSProperties = {
        fontFamily: 'Cinzel, serif',
        fontSize: '14px',
        color: '#cccccc',
        letterSpacing: '1px',
    };

    const contentContainerStyle: React.CSSProperties = {
        display: 'flex',
        gap: '20px',
        width: '100%',
        alignItems: 'center',
    };

    const tokenStyle: React.CSSProperties = {
        width: '120px',
        height: '120px',
        borderRadius: '50%',
        border: '3px solid #333',
        boxShadow: '0 0 15px rgba(0,0,0,0.8)',
        objectFit: 'cover',
        flexShrink: 0,
    };

    const textContainerStyle: React.CSSProperties = {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        textAlign: 'left',
    };

    const nameStyle: React.CSSProperties = {
        fontFamily: 'MedievalSharp, cursive',
        fontSize: '28px',
        color: '#ffffff',
        textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)',
    };

    const tacticsStyle: React.CSSProperties = {
        fontFamily: 'MedievalSharp, cursive',
        fontSize: '16px',
        color: '#e0e0e0',
        lineHeight: '1.4',
    };

    const specialAbilityStyle: React.CSSProperties = {
        fontFamily: 'MedievalSharp, cursive',
        fontSize: '14px',
        color: '#f0d080',
        fontStyle: 'italic',
        marginTop: '4px',
    };

    return (
        <div style={overlayStyle}>
            <div style={containerStyle}>
                <div style={headerContainerStyle}>
                    <div style={titleStyle}>{headerLabel}</div>
                    {progressText && <div style={progressStyle}>{progressText}</div>}
                </div>
                
                <div style={contentContainerStyle}>
                    <img 
                        src={tokenImage} 
                        alt={name} 
                        style={tokenStyle}
                        onError={(e) => {
                            (e.target as HTMLImageElement).src = '/assets/tokens/Token_Monster_Generic.png';
                        }}
                    />
                    <div style={textContainerStyle}>
                        <div style={nameStyle}>{name}</div>
                        <div style={tacticsStyle}>"{tacticsText}"</div>
                        {specialAbilityText && (
                            <div style={specialAbilityStyle}>{specialAbilityText}</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VillainPhaseOverlay;
