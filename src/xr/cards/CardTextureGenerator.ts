import * as THREE from 'three';
import { Card } from '../../game/types';

// Texture cache to prevent regenerating canvas/image textures per card instance
const textureCache = new Map<string, { front: THREE.Texture; back: THREE.Texture }>();

const CARD_WIDTH = 512;
const CARD_HEIGHT = 720;
const textureLoader = new THREE.TextureLoader();

/**
 * Resolves the real card scan image URL for a given card.
 */
export function getCardImagePath(card: Card): string | null {
  if (card.image) {
    // If card already specifies an image path
    const cleanImg = card.image.replace(/^\/?card-images\//, '/assets/cards/').replace(/^\/?cards\//, '/assets/cards/');
    return cleanImg;
  }

  const id = card.id?.toLowerCase() ?? '';
  const name = card.name?.toLowerCase().replace(/[^a-z0-9]/g, '') ?? '';
  const type = card.type?.toLowerCase() ?? '';

  // 1. Direct match for powers (e.g. cleric_healing_word, rogue_sneak_attack, etc.)
  if (id.includes('_')) {
    return `/assets/cards/${id}.png`;
  }

  // 2. Blessings, Fortunes, Items, Traps, Environments, Events
  const normalizedId = id.replace(/_/g, '-');
  if (normalizedId.startsWith('item-') || normalizedId.startsWith('fortune-') || normalizedId.startsWith('blessing-') || normalizedId.startsWith('env-') || normalizedId.startsWith('event-') || normalizedId.startsWith('evtatk-') || normalizedId.startsWith('trp-')) {
    return `/assets/cards/${normalizedId}.png`;
  }

  // 3. Fallbacks based on card type
  if (card.treasureType === 'item' || type === 'item') {
    return `/assets/cards/item-${name}.png`;
  }
  if (card.treasureType === 'fortune') {
    return `/assets/cards/fortune-${name}.png`;
  }
  if (card.treasureType === 'blessing') {
    return `/assets/cards/blessing-${name}.png`;
  }
  if (card.encounterType === 'environment') {
    return `/assets/cards/env-${name}.png`;
  }
  if (card.encounterType === 'event') {
    return `/assets/cards/event-${name}.png`;
  }
  if (card.encounterType === 'trap') {
    return `/assets/cards/trp-${name}.png`;
  }

  return null;
}

/**
 * Resolves the card back image URL.
 */
export function getCardBackImagePath(card: Card): string {
  if (card.type === 'treasure' || card.treasureType) {
    return '/assets/cards/Treasure-back.png';
  }
  if (card.type === 'encounter' || card.encounterType) {
    return '/assets/cards/Encounter-back.png';
  }
  return '/assets/cards/Encounter-back.png';
}

/**
 * Helper to wrap text into lines for HTML5 2D Canvas rendering
 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): number {
  const words = text.split(' ');
  let line = '';
  let currentY = y;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;
    if (testWidth > maxWidth && n > 0) {
      ctx.fillText(line, x, currentY);
      line = words[n] + ' ';
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, currentY);
  return currentY + lineHeight;
}

/**
 * Draws the fallback front face of a physical card onto a 2D canvas.
 */
function drawCardFront(card: Card): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // Background Parchment Gradient
  const bgGrad = ctx.createLinearGradient(0, 0, 0, CARD_HEIGHT);
  bgGrad.addColorStop(0, '#1c1524');
  bgGrad.addColorStop(0.3, '#14101d');
  bgGrad.addColorStop(1, '#0c0a12');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  // Outer Border & Gothic Frame
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#c5a059'; // Gold trim
  ctx.strokeRect(12, 12, CARD_WIDTH - 24, CARD_HEIGHT - 24);

  ctx.lineWidth = 2;
  ctx.strokeStyle = '#6e5428';
  ctx.strokeRect(18, 18, CARD_WIDTH - 36, CARD_HEIGHT - 36);

  // Header Banner Color based on card type
  let bannerColor = '#4a2574'; // Encounter default (Violet)
  let bannerText = (card.type || 'CARD').toUpperCase();

  if (card.powerType === 'at-will') {
    bannerColor = '#1e5e3a'; // Emerald green
    bannerText = 'AT-WILL POWER';
  } else if (card.powerType === 'daily') {
    bannerColor = '#7a1c1c'; // Ruby red
    bannerText = 'DAILY POWER';
  } else if (card.powerType === 'utility') {
    bannerColor = '#1d4872'; // Sapphire blue
    bannerText = 'UTILITY POWER';
  } else if (card.type === 'treasure') {
    bannerColor = '#785b14'; // Gold / amber
    bannerText = (card.treasureType || 'TREASURE').toUpperCase();
  } else if (card.type === 'encounter') {
    bannerColor = '#4a154b';
    bannerText = (card.encounterType || 'ENCOUNTER').toUpperCase();
  }

  // Header Banner
  ctx.fillStyle = bannerColor;
  ctx.fillRect(24, 24, CARD_WIDTH - 48, 64);
  ctx.strokeRect(24, 24, CARD_WIDTH - 48, 64);

  // Type Tag
  ctx.fillStyle = '#f5dfa3';
  ctx.font = 'bold 16px serif';
  ctx.textAlign = 'center';
  ctx.fillText(bannerText, CARD_WIDTH / 2, 44);

  // Card Title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px serif';
  ctx.fillText(card.name || 'Unknown Card', CARD_WIDTH / 2, 72);

  let currentY = 115;

  // Stats Box (if attack / damage / range exists)
  if (card.attackBonus !== undefined || card.damage !== undefined || card.range !== undefined) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(32, currentY, CARD_WIDTH - 64, 42);
    ctx.strokeStyle = 'rgba(197, 160, 89, 0.4)';
    ctx.strokeRect(32, currentY, CARD_WIDTH - 64, 42);

    const stats: string[] = [];
    if (card.attackBonus !== undefined) stats.push(`ATK: +${card.attackBonus}`);
    if (card.damage !== undefined) stats.push(`DMG: ${card.damage}`);
    if (card.range !== undefined) stats.push(`RNG: ${card.range === 0 ? 'Adjacent' : `${card.range} Tile`}`);
    if (card.target) stats.push(`TGT: ${card.target}`);

    ctx.fillStyle = '#f5dfa3';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(stats.join('   |   '), CARD_WIDTH / 2, currentY + 26);

    currentY += 58;
  }

  // Description Rules Text
  ctx.fillStyle = '#e8e2d5';
  ctx.font = '18px serif';
  ctx.textAlign = 'left';
  const description = card.description || 'No description available.';
  currentY = wrapText(ctx, description, 40, currentY + 10, CARD_WIDTH - 80, 26);

  // Flavor Text (Italics at bottom)
  if (card.flavorText) {
    ctx.fillStyle = '#9e9282';
    ctx.font = 'italic 16px serif';
    wrapText(ctx, `"${card.flavorText}"`, 40, CARD_HEIGHT - 90, CARD_WIDTH - 80, 22);
  }

  // Bottom Footer Decorative Bar
  ctx.fillStyle = '#c5a059';
  ctx.fillRect(CARD_WIDTH / 2 - 40, CARD_HEIGHT - 32, 80, 2);

  return canvas;
}

/**
 * Draws the fallback authentic Castle Ravenloft back of a physical card.
 */
function drawCardBack(cardType: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // Deep Gothic Background
  const bgGrad = ctx.createRadialGradient(
    CARD_WIDTH / 2,
    CARD_HEIGHT / 2,
    50,
    CARD_WIDTH / 2,
    CARD_HEIGHT / 2,
    CARD_HEIGHT / 1.5
  );
  bgGrad.addColorStop(0, '#261320');
  bgGrad.addColorStop(0.7, '#130914');
  bgGrad.addColorStop(1, '#080309');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  // Ornate Double Gold Border
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#c5a059';
  ctx.strokeRect(16, 16, CARD_WIDTH - 32, CARD_HEIGHT - 32);

  ctx.lineWidth = 3;
  ctx.strokeStyle = '#6e5428';
  ctx.strokeRect(26, 26, CARD_WIDTH - 52, CARD_HEIGHT - 52);

  // Diamond filigree
  ctx.beginPath();
  ctx.moveTo(CARD_WIDTH / 2, 70);
  ctx.lineTo(CARD_WIDTH - 70, CARD_HEIGHT / 2);
  ctx.lineTo(CARD_WIDTH / 2, CARD_HEIGHT - 70);
  ctx.lineTo(70, CARD_HEIGHT / 2);
  ctx.closePath();
  ctx.strokeStyle = 'rgba(197, 160, 89, 0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Crest Title
  ctx.fillStyle = '#f5dfa3';
  ctx.font = 'bold 26px serif';
  ctx.textAlign = 'center';
  ctx.fillText('CASTLE', CARD_WIDTH / 2, CARD_HEIGHT / 2 - 40);
  ctx.font = 'bold 30px serif';
  ctx.fillText('RAVENLOFT', CARD_WIDTH / 2, CARD_HEIGHT / 2 - 6);

  // Deck Label
  ctx.fillStyle = '#c5a059';
  ctx.font = 'bold 18px serif';
  ctx.letterSpacing = '3px';
  const label = cardType.toUpperCase().includes('TREASURE')
    ? 'TREASURE DECK'
    : cardType.toUpperCase().includes('ENCOUNTER')
    ? 'ENCOUNTER DECK'
    : 'HERO POWER';
  ctx.fillText(label, CARD_WIDTH / 2, CARD_HEIGHT / 2 + 36);

  return canvas;
}

/**
 * Returns cached Three.js textures for a card, using real scanned card art when available.
 */
export function getCardTextures(card: Card): { front: THREE.Texture; back: THREE.Texture } {
  const cacheKey = card.id || card.name || 'default';
  if (textureCache.has(cacheKey)) {
    return textureCache.get(cacheKey)!;
  }

  // Check for real scan art
  const realImagePath = getCardImagePath(card);
  let frontTexture: THREE.Texture;

  if (realImagePath) {
    frontTexture = textureLoader.load(
      realImagePath,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.generateMipmaps = true;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.needsUpdate = true;
      },
      undefined,
      () => {
        // Fallback to procedural canvas if scan is missing
        console.warn(`Card scan not found at ${realImagePath}, using procedural canvas.`);
        const fallbackCanvas = drawCardFront(card);
        const fallbackTex = new THREE.CanvasTexture(fallbackCanvas);
        fallbackTex.colorSpace = THREE.SRGBColorSpace;
        frontTexture.image = fallbackCanvas;
        frontTexture.needsUpdate = true;
      }
    );
    frontTexture.colorSpace = THREE.SRGBColorSpace;
  } else {
    const frontCanvas = drawCardFront(card);
    frontTexture = new THREE.CanvasTexture(frontCanvas);
    frontTexture.colorSpace = THREE.SRGBColorSpace;
  }

  // Real back texture
  const backImagePath = getCardBackImagePath(card);
  const backTexture = textureLoader.load(
    backImagePath,
    (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.needsUpdate = true;
    },
    undefined,
    () => {
      const fallbackBackCanvas = drawCardBack(card.type || 'power');
      const fallbackBackTex = new THREE.CanvasTexture(fallbackBackCanvas);
      fallbackBackTex.colorSpace = THREE.SRGBColorSpace;
      backTexture.image = fallbackBackCanvas;
      backTexture.needsUpdate = true;
    }
  );
  backTexture.colorSpace = THREE.SRGBColorSpace;

  const entry = { front: frontTexture, back: backTexture };
  textureCache.set(cacheKey, entry);
  return entry;
}
