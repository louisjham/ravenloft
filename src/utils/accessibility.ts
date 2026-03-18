/**
 * Accessibility utilities for Castle Ravenloft 3D.
 * Implements colorblind modes, screen reader announcements, and high contrast settings.
 */

import { useGameStore } from '../store/gameStore';

export interface AccessibilitySettings {
  colorblindMode: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';
  highContrast: boolean;
  screenReaderEnabled: boolean;
  textSize: 'small' | 'medium' | 'large';
}

// ARIA Live Region Management
export const announceToScreenReader = (message: string) => {
  const announcer = document.getElementById('aria-announcer');
  if (announcer) {
    announcer.textContent = message;
  }
};

// Colorblind-safe indicator labels
export const getIndicatorLabel = (type: 'hero' | 'monster' | 'trap') => {
  const mode = useGameStore.getState().settings.accessibility?.colorblindMode || 'none';
  
  if (mode === 'none') return '';
  
  const labels = {
    hero: 'H',
    monster: 'M',
    trap: 'T'
  };
  
  return labels[type];
};

// High contrast class generator
export const getAccessibilityClasses = () => {
  const settings = useGameStore.getState().settings.accessibility;
  return [
    settings?.highContrast ? 'high-contrast' : '',
    `text-${settings?.textSize || 'medium'}`,
    settings?.colorblindMode !== 'none' ? `cb-${settings?.colorblindMode}` : ''
  ].join(' ');
};

// Keyboard navigation mapping
export const KEY_BINDINGS = {
  MOVE_UP: 'ArrowUp',
  MOVE_DOWN: 'ArrowDown',
  MOVE_LEFT: 'ArrowLeft',
  MOVE_RIGHT: 'ArrowRight',
  ACTIVATE: 'Enter',
  CANCEL: 'Escape',
  HELP: 'f1',
  NEXT_UNIT: 'Tab'
};
