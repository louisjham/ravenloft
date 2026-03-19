import React, { useEffect, useState } from 'react';
import { Monster, Trap } from '../../game/types';

interface VillainPhaseOverlayProps {
    activeVillainId: string | null
    villainQueue: string[]
    monsters: Monster[]
    traps: Trap[]
    isVillainPhaseActive: boolean
}

const VillainPhaseOverlay: React.FC<VillainPhaseOverlayProps> = ({
    activeVillainId,
    villainQueue,
    monsters,
    traps,
    isVillainPhaseActive,
}) => {
    const [displayVillainId, setDisplayVillainId] = useState<string | null>(activeVillainId);
    const [isVisible, setIsVisible] = useState(false);
    const [opacity, setOpacity] = useState(0);

    // Resolve villain name from monsters or traps
    const getVillainName = (id: string | null): string | null => {
        if (!id) return null;
        const monster = monsters.find(m => m.id === id);
        if (monster) return monster.name;
        const trap = traps.find(t => t.id === id);
        if (trap) {
            // For traps, we need to look up the card name from cardId
            // Since we don't have card data in props, return the cardId as fallback
            return trap.cardId;
        }
        return id;
    };

    // Get current progress position in queue
    const getProgressText = (): string => {
        if (!activeVillainId || villainQueue.length === 0) return '';
        const currentIndex = villainQueue.indexOf(activeVillainId);
        if (currentIndex === -1) return '';
        return `Activating ${currentIndex + 1} of ${villainQueue.length}`;
    };

    // Auto-advance behavior using useEffect
    useEffect(() => {
        if (!isVillainPhaseActive) {
            setIsVisible(false);
            setOpacity(0);
            return;
        }

        setIsVisible(true);

        if (activeVillainId !== null) {
            setDisplayVillainId(activeVillainId);
            setOpacity(1);

            // Show for 1200ms, then fade out before next
            const fadeOutTimer = setTimeout(() => {
                setOpacity(0);
            }, 1000);

            return () => clearTimeout(fadeOutTimer);
        } else {
            // When activeVillainId becomes null, fade out
            setOpacity(0);
            setIsVisible(false);
        }
    }, [activeVillainId, isVillainPhaseActive]);

    if (!isVisible) {
        return null;
    }

    const currentVillainName = getVillainName(displayVillainId);
    const progressText = getProgressText();

    const overlayStyle: React.CSSProperties = {
        position: 'fixed',
        bottom: '80px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        pointerEvents: 'none',
        opacity: opacity,
        transition: 'opacity 200ms ease-in-out',
    };

    const containerStyle: React.CSSProperties = {
        backgroundColor: 'rgba(20, 10, 30, 0.95)',
        border: '2px solid #8b0000',
        borderRadius: '8px',
        padding: '16px 32px',
        minWidth: '300px',
        textAlign: 'center',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.8)',
    };

    const headerStyle: React.CSSProperties = {
        fontFamily: 'Cinzel, serif',
        fontSize: '18px',
        fontWeight: 'bold',
        color: '#ff4444',
        marginBottom: '8px',
        textShadow: '0 0 10px rgba(255, 0, 0, 0.5)',
        letterSpacing: '2px',
    };

    const nameStyle: React.CSSProperties = {
        fontFamily: 'MedievalSharp, cursive',
        fontSize: '24px',
        color: '#ffffff',
        marginBottom: '8px',
        textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)',
    };

    const progressStyle: React.CSSProperties = {
        fontFamily: 'Cinzel, serif',
        fontSize: '14px',
        color: '#cccccc',
        letterSpacing: '1px',
    };

    return (
        <div style={overlayStyle}>
            <div style={containerStyle}>
                <div style={headerStyle}>VILLAIN PHASE</div>
                {currentVillainName && <div style={nameStyle}>{currentVillainName}</div>}
                {progressText && <div style={progressStyle}>{progressText}</div>}
            </div>
        </div>
    );
};

export default VillainPhaseOverlay;
