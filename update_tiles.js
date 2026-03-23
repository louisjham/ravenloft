const fs = require('fs');
const path = require('path');

const tilesJsonPath = path.join(__dirname, 'src', 'data', 'tiles.json');
const tilesDir = path.join(__dirname, 'public', 'assets', 'tiles');

const existingTiles = JSON.parse(fs.readFileSync(tilesJsonPath, 'utf8'));
const existingImages = existingTiles.map(t => path.basename(t.imageUrl));

const allImages = fs.readdirSync(tilesDir).filter(f => f.endsWith('.png'));
const newImages = allImages.filter(f => !existingImages.includes(f) && !f.includes('Back'));

function getConnections(filename) {
  // defaulting to north open if named or crypt
  let connections = [
    { edge: "north", isOpen: true },
    { edge: "south", isOpen: false },
    { edge: "east", isOpen: false },
    { edge: "west", "isOpen": false }
  ];

  if (filename.includes('x4')) {
    connections.forEach(c => c.isOpen = true);
  } else if (filename.includes('x3')) {
    connections[0].isOpen = true;
    connections[1].isOpen = true;
    connections[2].isOpen = true;
  } else if (filename.includes('x2')) {
    connections[0].isOpen = true;
    connections[1].isOpen = true;
  }
  return connections;
}

function getEncounterType(filename) {
  if (filename.includes('Black')) return 'black';
  return 'white';
}

function getTerrainType(filename) {
  if (filename.startsWith('Named_') || filename.startsWith('Crypt_')) return 'named_room';
  return 'corridor';
}

function getName(filename) {
  let name = filename.replace('.png', '').replace('Named_', '').replace('Crypt_', '').replace(/_/g, ' ');
  return name.replace(/([A-Z])/g, ' $1').trim();
}

const newlyGeneratedTiles = newImages.map((filename, index) => {
  return {
    id: `tile_${filename.replace('.png', '').toLowerCase()}`,
    name: getName(filename),
    x: 0,
    z: 0,
    terrainType: getTerrainType(filename),
    isRevealed: false,
    isStart: false,
    isExit: false,
    rotation: 0,
    connections: getConnections(filename),
    monsters: [],
    heroes: [],
    items: [],
    boneSquare: {
      sqX: 1,
      sqZ: 1
    },
    imageUrl: `/assets/tiles/${filename}`,
    encounterType: getEncounterType(filename)
  };
});

const finalTiles = [...existingTiles, ...newlyGeneratedTiles];

fs.writeFileSync(tilesJsonPath, JSON.stringify(finalTiles, null, 2));
console.log(`Added ${newlyGeneratedTiles.length} new tiles.`);
