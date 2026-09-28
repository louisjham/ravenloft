import React, { useEffect, useState } from 'react';
import { VRButton, ARButton } from '@react-three/xr';

/**
 * XRControlsOverlay renders unobtrusive buttons to enter VR or AR Passthrough mode
 * when the user is on a compatible device (like Meta Quest 2 / Quest 3 / Quest Pro).
 * Also auto-enters VR when launched as an installed Meta Horizon Store PWA/TWA.
 */
export const XRControlsOverlay: React.FC = () => {
  const [isXRSupported, setIsXRSupported] = useState<boolean>(false);
  const [isVRSupported, setIsVRSupported] = useState<boolean>(false);
  const [isARSupported, setIsARSupported] = useState<boolean>(false);

  useEffect(() => {
    if ('xr' in navigator && (navigator as any).xr) {
      const xr = (navigator as any).xr;
      Promise.all([
        xr.isSessionSupported('immersive-vr').catch(() => false),
        xr.isSessionSupported('immersive-ar').catch(() => false),
      ]).then(([vr, ar]) => {
        setIsVRSupported(vr);
        setIsARSupported(ar);
        setIsXRSupported(vr || ar);
      });
    }
  }, []);

  // Auto-launch WebXR session if launched as an installed Meta Horizon Store PWA/TWA
  useEffect(() => {
    if (typeof window !== 'undefined' && 'getDigitalGoodsService' in window && isVRSupported) {
      const timer = setTimeout(() => {
        const vrBtn = document.querySelector('.xr-controls-container button') as HTMLButtonElement | null;
        if (vrBtn) {
          vrBtn.click();
        }
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [isVRSupported]);

  if (!isXRSupported) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'row',
        gap: '10px',
        pointerEvents: 'auto',
      }}
      className="xr-controls-container"
    >
      {isVRSupported && (
        <VRButton
          sessionInit={{
            optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking', 'layers'],
          }}
          style={{
            background: 'rgba(20, 10, 35, 0.85)',
            color: '#e0c068',
            border: '1px solid #e0c068',
            borderRadius: '6px',
            padding: '8px 16px',
            fontSize: '13px',
            fontFamily: 'inherit',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            transition: 'all 0.2s ease',
          }}
        />
      )}
      {isARSupported && (
        <ARButton
          sessionInit={{
            optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking', 'hit-test'],
          }}
          style={{
            background: 'rgba(20, 10, 35, 0.85)',
            color: '#68c0e0',
            border: '1px solid #68c0e0',
            borderRadius: '6px',
            padding: '8px 16px',
            fontSize: '13px',
            fontFamily: 'inherit',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            transition: 'all 0.2s ease',
          }}
        />
      )}
    </div>
  );
};

export default XRControlsOverlay;
