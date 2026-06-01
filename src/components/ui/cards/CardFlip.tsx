import React, { useState, useEffect } from 'react';
import { Card } from '../../../game/types';
import CardFace from './CardFace';

interface CardFlipProps {
  card: Card;
  isFlipped: boolean; // false=face-down, true=face-up
  size: 'full' | 'compact' | 'mini';
  onFlipComplete?: () => void;
  onClick?: () => void;
}

const CardFlip: React.FC<CardFlipProps> = ({
  card,
  isFlipped,
  size,
  onFlipComplete,
  onClick
}) => {
  const [isAnimating, setIsAnimating] = useState(false);
  // Using showFront as requested, although 3D render handles both sides
  const [showFront, setShowFront] = useState(!isFlipped);

  useEffect(() => {
    setIsAnimating(true);
    const timer = setTimeout(() => {
      setShowFront(isFlipped);
      setIsAnimating(false);
      onFlipComplete?.();
    }, 150);
    return () => clearTimeout(timer);
  }, [isFlipped, onFlipComplete]);

  const getDimensions = () => {
    switch (size) {
      case 'full': return { width: '240px', height: '336px' };
      case 'compact': return { width: '180px', height: '252px' };
      case 'mini': return { width: '120px', height: '168px' };
    }
  };

  const dims = getDimensions();

  const outerContainerStyle: React.CSSProperties = {
    ...dims,
    perspective: '1000px',
    cursor: onClick ? 'pointer' : 'default',
  };

  const innerFlipperStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    position: 'relative',
    transformStyle: 'preserve-3d',
    transition: 'transform 0.3s ease',
    transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
  };

  const faceStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden', 
  };

  const frontFaceStyle: React.CSSProperties = {
    ...faceStyle,
    transform: 'rotateY(180deg)',
  };

  const backFaceStyle: React.CSSProperties = {
    ...faceStyle,
    transform: 'rotateY(0deg)',
  };

  return (
    <div style={outerContainerStyle} onClick={onClick}>
      <div style={innerFlipperStyle}>
        {/* Face-up (Front) side */}
        <div style={frontFaceStyle}>
          <CardFace 
            card={card} 
            isFaceDown={false} 
            isAnimating={isAnimating} 
            size={size} 
          />
        </div>
        
        {/* Face-down (Back) side */}
        <div style={backFaceStyle}>
          <CardFace 
            card={card} 
            isFaceDown={true} 
            isAnimating={isAnimating} 
            size={size} 
          />
        </div>
      </div>
    </div>
  );
};

export default CardFlip;
