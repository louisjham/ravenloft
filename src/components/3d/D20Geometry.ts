import * as THREE from 'three';

export const FACE_TO_NUMBER = [
  1, 19, 17, 3, 2,  // top cap
  20, 18, 16, 4, 5, // upper band
  14, 8, 6, 12, 10, // lower band
  15, 7, 9, 13, 11  // bottom cap
];

let cachedGeometry: THREE.BufferGeometry | null = null;
let cachedFaceNormals: THREE.Vector3[] = [];

/**
 * Creates the d20 geometry with proper per-face UV mapping to the texture atlas.
 */
export function createD20Geometry(): { geometry: THREE.BufferGeometry, faceNormals: THREE.Vector3[] } {
  if (cachedGeometry) {
    return { geometry: cachedGeometry, faceNormals: cachedFaceNormals };
  }

  // Icosahedron with detail 0 gives 20 triangular faces
  const baseGeom = new THREE.IcosahedronGeometry(0.35, 0);
  const geometry = baseGeom.toNonIndexed(); // Important: un-share vertices so each face can have distinct UVs
  geometry.computeVertexNormals();

  const positionAttribute = geometry.attributes.position;
  const numVertices = positionAttribute.count;
  const numFaces = numVertices / 3;

  const uvs = new Float32Array(numVertices * 2);
  const faceNormals: THREE.Vector3[] = [];

  // 5 cols x 4 rows atlas
  const cols = 5;
  const rows = 4;
  const cw = 1.0 / cols;
  const ch = 1.0 / rows;

  for (let i = 0; i < numFaces; i++) {
    const v1 = new THREE.Vector3().fromBufferAttribute(positionAttribute, i * 3);
    const v2 = new THREE.Vector3().fromBufferAttribute(positionAttribute, i * 3 + 1);
    const v3 = new THREE.Vector3().fromBufferAttribute(positionAttribute, i * 3 + 2);

    // Compute face normal
    const edge1 = new THREE.Vector3().subVectors(v2, v1);
    const edge2 = new THREE.Vector3().subVectors(v3, v1);
    const normal = new THREE.Vector3().crossVectors(edge1, edge2).normalize();
    faceNormals.push(normal);

    // Map face index to a number 1-20
    // Real physical D20s have a specific layout, we approximate here
    const num = FACE_TO_NUMBER[i] || (i + 1);
    const idx = num - 1; // 0-19

    const c = idx % cols;
    const r = Math.floor(idx / cols);

    // Calculate UV coordinates for this cell (inverted Y because textures map bottom-up in WebGL by default, 
    // but CanvasTexture with flipY=false means 0,0 is top-left in canvas space, bottom-left in UV space... 
    // Let's stick to standard 0,0 bottom-left UVs)
    const uvX0 = c * cw;
    const uvY0 = (3 - r) * ch; // invert row for standard UV (0 is bottom)

    // Map an equilateral triangle inside the cell
    const margin = 0.05;
    
    // v1: bottom left
    uvs[(i * 3) * 2] = uvX0 + (cw * margin);
    uvs[(i * 3) * 2 + 1] = uvY0 + (ch * margin);
    
    // v2: bottom right
    uvs[(i * 3 + 1) * 2] = uvX0 + cw * (1 - margin);
    uvs[(i * 3 + 1) * 2 + 1] = uvY0 + (ch * margin);
    
    // v3: top center
    uvs[(i * 3 + 2) * 2] = uvX0 + (cw * 0.5);
    uvs[(i * 3 + 2) * 2 + 1] = uvY0 + ch * (1 - margin);
  }

  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

  cachedGeometry = geometry;
  cachedFaceNormals = faceNormals;

  return { geometry, faceNormals };
}

let cachedTexture: THREE.CanvasTexture | null = null;

export function createNumberTexture(): THREE.CanvasTexture {
  if (cachedTexture) return cachedTexture;

  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024; // Power of 2 is good for WebGL
  const ctx = canvas.getContext('2d');
  
  if (!ctx) throw new Error("Could not get 2d context");

  // Transparent background
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const cols = 5;
  const rows = 4;
  const cw = canvas.width / cols;
  const ch = canvas.height / rows;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 96px Arial';
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'black';
  ctx.fillStyle = 'white';

  for (let i = 1; i <= 20; i++) {
    const idx = i - 1;
    const c = idx % cols;
    const r = Math.floor(idx / cols);

    const x = c * cw + (cw / 2);
    const y = r * ch + (ch / 2) + 15; // slightly lower visual center due to triangle shape

    // Draw outline then fill
    ctx.strokeText(i.toString(), x, y);
    ctx.fillText(i.toString(), x, y);
    
    // Add the little underline for 6 and 9
    if (i === 6 || i === 9) {
      const w = ctx.measureText(i.toString()).width;
      ctx.beginPath();
      ctx.moveTo(x - w/2, y + 45);
      ctx.lineTo(x + w/2, y + 45);
      ctx.stroke();
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'white';
      ctx.stroke();
      ctx.lineWidth = 6;
      ctx.strokeStyle = 'black';
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false; // Match the UV math above

  cachedTexture = texture;
  return texture;
}

export function createD20Material(colorHex: string): THREE.MeshPhysicalMaterial {
  const tex = createNumberTexture();
  
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(colorHex),
    map: tex,
    emissiveMap: tex,
    emissive: new THREE.Color('#ffffff'),
    emissiveIntensity: 0.15,
    roughness: 0.08,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1,
    transmission: 0.12, // slightly transparent Lucite look
    thickness: 0.5,
    ior: 1.52,
    transparent: true,
    opacity: 0.92,
  });
}

/**
 * Returns the number showing on the top face given the die's current quaternion.
 */
export function getUpFaceNumber(quaternion: THREE.Quaternion): number {
  const { faceNormals } = createD20Geometry();
  
  let bestFaceIndex = 0;
  let maxDot = -Infinity;
  const up = new THREE.Vector3(0, 1, 0);

  // Apply the quaternion to each original face normal to see which points up
  for (let i = 0; i < faceNormals.length; i++) {
    const normal = faceNormals[i].clone().applyQuaternion(quaternion);
    const dot = normal.dot(up);
    
    if (dot > maxDot) {
      maxDot = dot;
      bestFaceIndex = i;
    }
  }

  return FACE_TO_NUMBER[bestFaceIndex] || (bestFaceIndex + 1);
}

/**
 * Generates a target quaternion that will orient the die so `targetNumber` is facing up.
 * Randomly rotates around the Y axis for variety.
 */
export function getQuaternionForNumber(targetNumber: number): THREE.Quaternion {
  const { faceNormals } = createD20Geometry();
  
  // Find face index for this number
  let faceIndex = FACE_TO_NUMBER.indexOf(targetNumber);
  if (faceIndex === -1) faceIndex = targetNumber - 1;

  const targetNormal = faceNormals[faceIndex].clone().normalize();
  const up = new THREE.Vector3(0, 1, 0);

  // Find quaternion that rotates targetNormal to [0,1,0]
  const qAlign = new THREE.Quaternion().setFromUnitVectors(targetNormal, up);

  // Add random Y-axis rotation so it doesn't always land looking identical
  const randomY = Math.random() * Math.PI * 2;
  const qRandomY = new THREE.Quaternion().setFromAxisAngle(up, randomY);

  return qRandomY.multiply(qAlign);
}
