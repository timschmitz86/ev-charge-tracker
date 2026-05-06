import sharp from 'sharp';
import { readFile } from 'fs/promises';

async function generateIcons() {
  console.log('Reading icon.svg...');
  const svgBuffer = await readFile('./public/icon.svg');
  
  console.log('Generating apple-touch-icon.png (180x180 for iOS)...');
  await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toFile('./public/apple-touch-icon.png');
  
  console.log('Generating pwa-192x192.png...');
  await sharp(svgBuffer)
    .resize(192, 192)
    .png()
    .toFile('./public/pwa-192x192.png');
  
  console.log('Generating pwa-512x512.png...');
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile('./public/pwa-512x512.png');
  
  console.log('✓ Icons generated successfully!');
}

generateIcons().catch(console.error);
