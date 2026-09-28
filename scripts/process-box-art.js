import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const uiDir = path.resolve('public/ui');
const newTopScan = path.join(uiDir, 'box_art (2).webp');
const destTop = path.join(uiDir, 'box_art.webp');
const destBottom = path.join(uiDir, 'box_bottom.webp');

async function processBoxArt() {
  console.log('Processing scanned box art...');

  if (fs.existsSync(newTopScan)) {
    console.log('Updating box_art.webp with new scan: box_art (2).webp');
    fs.copyFileSync(newTopScan, destTop);
  }

  const topMeta = await sharp(destTop).metadata();
  console.log(`Box top dimensions: ${topMeta.width}x${topMeta.height}`);

  const bottomMeta = await sharp(destBottom).metadata();
  console.log(`Box bottom dimensions: ${bottomMeta.width}x${bottomMeta.height}`);

  const W = topMeta.width;
  const H = topMeta.height;
  const stripHeight = Math.round(H * 0.18); // 18% edge slice
  const stripWidth = Math.round(W * 0.18);

  // Top edge strip (North)
  await sharp(destTop)
    .extract({ left: 0, top: 0, width: W, height: stripHeight })
    .webp({ quality: 90 })
    .toFile(path.join(uiDir, 'box_side_north.webp'));
  console.log('Created box_side_north.webp');

  // Bottom edge strip (South)
  await sharp(destTop)
    .extract({ left: 0, top: H - stripHeight, width: W, height: stripHeight })
    .webp({ quality: 90 })
    .toFile(path.join(uiDir, 'box_side_south.webp'));
  console.log('Created box_side_south.webp');

  // Left edge strip (West)
  await sharp(destTop)
    .extract({ left: 0, top: 0, width: stripWidth, height: H })
    .webp({ quality: 90 })
    .toFile(path.join(uiDir, 'box_side_west.webp'));
  console.log('Created box_side_west.webp');

  // Right edge strip (East)
  await sharp(destTop)
    .extract({ left: W - stripWidth, top: 0, width: stripWidth, height: H })
    .webp({ quality: 90 })
    .toFile(path.join(uiDir, 'box_side_east.webp'));
  console.log('Created box_side_east.webp');

  console.log('Box sides extracted successfully!');
}

processBoxArt().catch(err => {
  console.error('Error processing box art:', err);
  process.exit(1);
});
