import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const outputDir = path.resolve('public/icons');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const sourceImage = path.resolve('public/ui/box_art.webp');

async function generateIcons() {
  console.log('Generating PWA & Meta Horizon Store icons...');
  
  // Base 1024x1024 square crop from center/top
  const base1024 = sharp(sourceImage)
    .resize(1024, 1024, {
      fit: 'cover',
      position: 'center',
    });

  // 1024x1024 store icon
  await base1024
    .clone()
    .png()
    .toFile(path.join(outputDir, 'icon-1024.png'));
  console.log('Created icon-1024.png');

  // 512x512 regular icon
  await base1024
    .clone()
    .resize(512, 512)
    .png()
    .toFile(path.join(outputDir, 'icon-512.png'));
  console.log('Created icon-512.png');

  // 192x192 regular icon
  await base1024
    .clone()
    .resize(192, 192)
    .png()
    .toFile(path.join(outputDir, 'icon-192.png'));
  console.log('Created icon-192.png');

  // 512x512 maskable icon (full-bleed background with 80% safe zone inner artwork)
  const innerArt = await sharp(sourceImage)
    .resize(410, 410, { fit: 'cover', position: 'center' })
    .toBuffer();

  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 14, g: 8, b: 20, alpha: 1 } // #0e0814 gothic dark background
    }
  })
    .composite([
      {
        input: innerArt,
        top: 51,
        left: 51,
      }
    ])
    .png()
    .toFile(path.join(outputDir, 'icon-512-maskable.png'));
  console.log('Created icon-512-maskable.png');

  console.log('All icons generated successfully!');
}

generateIcons().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
