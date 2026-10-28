import * as THREE from 'three';

let cachedCastleTexture: THREE.CanvasTexture | null = null;
const cachedTarokkaTextures = new Map<string, THREE.CanvasTexture>();

/**
 * Generates an evocative, high-res procedural silhouette of Castle Ravenloft
 * atop the crags of Barovia against a stormy moonlit sky.
 * Pure procedural 2D canvas with zero network dependencies.
 */
export function getCastleSilhouetteTexture(): THREE.CanvasTexture {
  if (cachedCastleTexture) return cachedCastleTexture;

  const width = 1024;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    const fallbackTex = new THREE.CanvasTexture(canvas);
    cachedCastleTexture = fallbackTex;
    return fallbackTex;
  }

  // Clear with transparent base
  ctx.clearRect(0, 0, width, height);

  // 1. Soft atmospheric moon halo
  const moonX = width * 0.52;
  const moonY = height * 0.30;
  const moonRadius = 90;

  const moonGlow = ctx.createRadialGradient(moonX, moonY, 10, moonX, moonY, 260);
  moonGlow.addColorStop(0, 'rgba(230, 240, 255, 0.95)');
  moonGlow.addColorStop(0.2, 'rgba(180, 200, 245, 0.5)');
  moonGlow.addColorStop(0.5, 'rgba(120, 80, 160, 0.25)');
  moonGlow.addColorStop(1, 'rgba(10, 5, 20, 0)');

  ctx.fillStyle = moonGlow;
  ctx.beginPath();
  ctx.arc(moonX, moonY, 260, 0, Math.PI * 2);
  ctx.fill();

  // Full Moon disc
  const moonDisc = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, moonRadius);
  moonDisc.addColorStop(0, '#ffffff');
  moonDisc.addColorStop(0.7, '#d6e5ff');
  moonDisc.addColorStop(0.95, '#a4b8df');
  moonDisc.addColorStop(1, 'rgba(140, 160, 200, 0.8)');

  ctx.fillStyle = moonDisc;
  ctx.beginPath();
  ctx.arc(moonX, moonY, moonRadius, 0, Math.PI * 2);
  ctx.fill();

  // 2. Distant clouds / fog drifts behind the spires
  ctx.fillStyle = 'rgba(40, 25, 55, 0.35)';
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.ellipse(width * (0.2 + i * 0.14), height * (0.35 + (i % 3) * 0.05), 180, 35, 0.08 * (i - 3), 0, Math.PI * 2);
    ctx.fill();
  }

  // 3. Jagged mountain crag base silhouette
  ctx.fillStyle = '#060309'; // Deep Barovian obsidian
  ctx.beginPath();
  ctx.moveTo(0, height);
  ctx.lineTo(0, height * 0.82);
  ctx.lineTo(width * 0.15, height * 0.76);
  ctx.lineTo(width * 0.28, height * 0.68);
  ctx.lineTo(width * 0.38, height * 0.58);
  ctx.lineTo(width * 0.45, height * 0.52);
  ctx.lineTo(width * 0.50, height * 0.50);
  ctx.lineTo(width * 0.56, height * 0.53);
  ctx.lineTo(width * 0.65, height * 0.62);
  ctx.lineTo(width * 0.78, height * 0.72);
  ctx.lineTo(width * 0.90, height * 0.80);
  ctx.lineTo(width, height * 0.85);
  ctx.lineTo(width, height);
  ctx.closePath();
  ctx.fill();

  // 4. Castle Ravenloft Spires & Ramparts Silhouette
  ctx.fillStyle = '#08040d';

  // Helper: Draw conical tower spire
  const drawTower = (x: number, baseW: number, topW: number, bottomY: number, topY: number, spireY: number) => {
    ctx.beginPath();
    // Tower body
    ctx.moveTo(x - baseW / 2, bottomY);
    ctx.lineTo(x - topW / 2, topY);
    // Battlements / crenellations
    ctx.lineTo(x - topW / 2 - 4, topY);
    ctx.lineTo(x - topW / 2 - 4, topY - 10);
    ctx.lineTo(x + topW / 2 + 4, topY - 10);
    ctx.lineTo(x + topW / 2 + 4, topY);
    ctx.lineTo(x + topW / 2, topY);
    ctx.lineTo(x + baseW / 2, bottomY);
    ctx.closePath();
    ctx.fill();

    // Conical Spire
    ctx.beginPath();
    ctx.moveTo(x - topW / 2 - 2, topY - 10);
    ctx.lineTo(x, spireY);
    ctx.lineTo(x + topW / 2 + 2, topY - 10);
    ctx.closePath();
    ctx.fill();
  };

  // Main Central Grand Spire (Highest Tower)
  drawTower(width * 0.51, 64, 46, height * 0.50, height * 0.22, height * 0.08);

  // High Keep Body
  ctx.fillRect(width * 0.44, height * 0.32, width * 0.14, height * 0.20);

  // Left Flanking Spire
  drawTower(width * 0.42, 48, 36, height * 0.52, height * 0.27, height * 0.15);

  // Right Flanking Spire
  drawTower(width * 0.60, 52, 38, height * 0.53, height * 0.29, height * 0.17);

  // Far-left Watchtower
  drawTower(width * 0.34, 40, 28, height * 0.62, height * 0.40, height * 0.29);

  // Far-right Watchtower
  drawTower(width * 0.68, 44, 30, height * 0.64, height * 0.42, height * 0.31);

  // Arched Gothic Bridge / Viaduct connecting cliff and keep
  ctx.beginPath();
  ctx.rect(width * 0.35, height * 0.54, width * 0.09, 16);
  ctx.fill();

  // 5. Glowing amber stained-glass windows in the keep & towers
  ctx.fillStyle = '#ffb338';
  ctx.shadowColor = '#ff8800';
  ctx.shadowBlur = 10;

  const drawWindow = (wx: number, wy: number, ww: number, wh: number) => {
    ctx.beginPath();
    ctx.rect(wx, wy, ww, wh - ww / 2);
    ctx.arc(wx + ww / 2, wy, ww / 2, Math.PI, 0);
    ctx.fill();
  };

  // High spire windows
  drawWindow(width * 0.51 - 4, height * 0.25, 8, 18);
  drawWindow(width * 0.51 - 4, height * 0.31, 8, 18);
  // Keep hall row of gothic windows
  for (let j = 0; j < 5; j++) {
    drawWindow(width * 0.46 + j * 16, height * 0.40, 6, 14);
  }
  // Side tower windows
  drawWindow(width * 0.42 - 3, height * 0.34, 6, 12);
  drawWindow(width * 0.60 - 3, height * 0.35, 6, 12);

  ctx.shadowBlur = 0;

  // 6. Low mist bank creeping across the mountain base
  const mistGrad = ctx.createLinearGradient(0, height * 0.65, 0, height);
  mistGrad.addColorStop(0, 'rgba(160, 130, 190, 0)');
  mistGrad.addColorStop(0.5, 'rgba(140, 110, 175, 0.45)');
  mistGrad.addColorStop(1, 'rgba(20, 12, 30, 0.9)');
  ctx.fillStyle = mistGrad;
  ctx.fillRect(0, height * 0.65, width, height * 0.35);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  cachedCastleTexture = tex;
  return tex;
}

export type TarokkaMotif = 'mist' | 'raven' | 'artifact' | 'beast' | 'tempter';

/**
 * Generates an authentic gothic Tarokka card face with ornate gold filigree,
 * archetypal sigil, and mystical runes.
 */
export function getTarokkaCardTexture(motif: TarokkaMotif): THREE.CanvasTexture {
  if (cachedTarokkaTextures.has(motif)) {
    return cachedTarokkaTextures.get(motif)!;
  }

  const width = 512;
  const height = 768;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    const fallbackTex = new THREE.CanvasTexture(canvas);
    cachedTarokkaTextures.set(motif, fallbackTex);
    return fallbackTex;
  }

  // 1. Card base - Deep velvet obsidian with subtle crimson vignette
  const bgGrad = ctx.createRadialGradient(width / 2, height / 2, 40, width / 2, height / 2, width * 0.85);
  bgGrad.addColorStop(0, '#1c1028');
  bgGrad.addColorStop(0.7, '#100718');
  bgGrad.addColorStop(1, '#050208');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // 2. Ornate Double Gold Border Frame
  ctx.strokeStyle = '#c5a059';
  ctx.lineWidth = 4;
  ctx.strokeRect(20, 20, width - 40, height - 40);

  ctx.strokeStyle = 'rgba(197, 160, 89, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(30, 30, width - 60, height - 60);

  // Corner flourishes
  const drawCornerFlourish = (cx: number, cy: number, rot: number) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.strokeStyle = '#f5dfa3';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(24, 0);
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 24);
    ctx.moveTo(6, 6);
    ctx.arc(12, 12, 6, Math.PI, Math.PI * 1.5);
    ctx.stroke();
    ctx.restore();
  };

  drawCornerFlourish(30, 30, 0);
  drawCornerFlourish(width - 30, 30, Math.PI / 2);
  drawCornerFlourish(width - 30, height - 30, Math.PI);
  drawCornerFlourish(30, height - 30, -Math.PI / 2);

  // 3. Card Roman Numeral Header
  let numeral = 'I';
  let title = 'THE MISTS';
  let subtitle = 'HIGH DECK';

  if (motif === 'raven') {
    numeral = 'II';
    title = 'THE RAVEN';
    subtitle = 'CROWN';
  } else if (motif === 'artifact') {
    numeral = 'III';
    title = 'THE ARTIFACT';
    subtitle = 'SUN';
  } else if (motif === 'tempter') {
    numeral = 'IV';
    title = 'THE TEMPTER';
    subtitle = 'COIN';
  } else if (motif === 'beast') {
    numeral = 'V';
    title = 'THE BEAST';
    subtitle = 'SWORD';
  }

  ctx.fillStyle = '#f5dfa3';
  ctx.font = 'bold 24px serif';
  ctx.textAlign = 'center';
  ctx.fillText(numeral, width / 2, 68);

  // 4. Central Medallion Circle
  const cx = width / 2;
  const cy = height * 0.44;
  const r = 140;

  ctx.strokeStyle = '#c5a059';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(197, 160, 89, 0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, r - 8, 0, Math.PI * 2);
  ctx.stroke();

  // 5. Draw Motif Sigil Inside Center Medallion
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r - 10, 0, Math.PI * 2);
  ctx.clip();

  // Background radial aura for sigil
  const sigilAura = ctx.createRadialGradient(cx, cy, 10, cx, cy, r - 10);
  sigilAura.addColorStop(0, 'rgba(180, 80, 160, 0.4)');
  sigilAura.addColorStop(0.7, 'rgba(80, 30, 100, 0.2)');
  sigilAura.addColorStop(1, 'rgba(10, 5, 20, 0.6)');
  ctx.fillStyle = sigilAura;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

  ctx.fillStyle = '#f5dfa3';
  ctx.strokeStyle = '#f5dfa3';
  ctx.lineWidth = 3;

  if (motif === 'mist') {
    // Swirling concentric ethereal mist spirals
    for (let s = 1; s <= 4; s++) {
      ctx.beginPath();
      ctx.arc(cx + Math.sin(s) * 15, cy + Math.cos(s) * 15, 25 * s, 0.2 * s, Math.PI * 1.6 + 0.2 * s);
      ctx.stroke();
    }
  } else if (motif === 'raven') {
    // Gothic raven wings and head silhouette
    ctx.beginPath();
    ctx.moveTo(cx, cy - 50); // Beak
    ctx.lineTo(cx + 12, cy - 35);
    ctx.lineTo(cx + 60, cy - 45); // Right wing tip
    ctx.lineTo(cx + 40, cy);
    ctx.lineTo(cx + 70, cy + 30);
    ctx.lineTo(cx + 25, cy + 40);
    ctx.lineTo(cx, cy + 60); // Tail
    ctx.lineTo(cx - 25, cy + 40);
    ctx.lineTo(cx - 70, cy + 30);
    ctx.lineTo(cx - 40, cy);
    ctx.lineTo(cx - 60, cy - 45); // Left wing tip
    ctx.lineTo(cx - 12, cy - 35);
    ctx.closePath();
    ctx.fill();
  } else if (motif === 'artifact') {
    // Holy Sunburst Relic
    ctx.beginPath();
    ctx.arc(cx, cy, 32, 0, Math.PI * 2);
    ctx.fill();
    // 12 Radiating Sun Rays
    for (let ray = 0; ray < 12; ray++) {
      const angle = (ray * Math.PI) / 6;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * 40, cy + Math.sin(angle) * 40);
      ctx.lineTo(cx + Math.cos(angle) * (ray % 2 === 0 ? 85 : 65), cy + Math.sin(angle) * (ray % 2 === 0 ? 85 : 65));
      ctx.stroke();
    }
  } else if (motif === 'tempter') {
    // Gothic Chalice
    ctx.beginPath();
    ctx.arc(cx, cy - 20, 36, 0, Math.PI); // Cup bowl
    ctx.lineTo(cx + 6, cy + 25);
    ctx.lineTo(cx + 24, cy + 45); // Base
    ctx.lineTo(cx - 24, cy + 45);
    ctx.lineTo(cx - 6, cy + 25);
    ctx.closePath();
    ctx.fill();
  } else if (motif === 'beast') {
    // Crossed gothic daggers / wolf fang sigil
    ctx.beginPath();
    ctx.moveTo(cx, cy - 65);
    ctx.lineTo(cx + 18, cy + 35);
    ctx.lineTo(cx, cy + 22);
    ctx.lineTo(cx - 18, cy + 35);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();

  // 6. Bottom Title Ribbon
  ctx.fillStyle = '#f5dfa3';
  ctx.font = 'bold 26px "Cinzel", Georgia, serif';
  ctx.textAlign = 'center';
  ctx.letterSpacing = '3px';
  ctx.fillText(title, width / 2, height * 0.82);

  ctx.fillStyle = '#a08860';
  ctx.font = '14px sans-serif';
  ctx.fillText(subtitle, width / 2, height * 0.87);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  cachedTarokkaTextures.set(motif, tex);
  return tex;
}
