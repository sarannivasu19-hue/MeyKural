/**
 * Build Multi-Resolution Sharp Images for MeyKural Full-Bleed Background
 * Upscales source using Sharp with Lanczos3 resampling kernel + mild adaptive unsharp masking.
 * Outputs widths 640, 960, 1280, 1920, 2560, and 3840 in AVIF (q60), WebP (q85), and JPEG (q88),
 * plus a tiny blurred placeholder.
 */
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const SOURCE_IMAGE = path.join(__dirname, '..', 'client', 'public', 'images', 'login-bg-clean.png');
const OUTPUT_DIR = path.join(__dirname, '..', 'client', 'public', 'images', 'bg');

const TARGET_WIDTHS = [640, 960, 1280, 1920, 2560, 3840];

async function buildImages() {
  console.log('🖼️ Starting image build with sharp (Lanczos3 + mild sharpen)...');
  if (!fs.existsSync(SOURCE_IMAGE)) {
    throw new Error(`Source image not found: ${SOURCE_IMAGE}`);
  }

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const meta = await sharp(SOURCE_IMAGE).metadata();
  console.log(`Source dimensions: ${meta.width}x${meta.height} (${meta.format})`);

  const summary = [];

  // 1. Generate tiny blurred placeholder (32px wide WebP)
  const placeholderPath = path.join(OUTPUT_DIR, 'bg-placeholder.webp');
  await sharp(SOURCE_IMAGE)
    .resize(32, Math.round(32 * meta.height / meta.width), { kernel: sharp.kernel.lanczos3 })
    .blur(3)
    .webp({ quality: 40 })
    .toFile(placeholderPath);
  const placeholderStat = fs.statSync(placeholderPath);
  console.log(`Generated placeholder: 32px WebP (${placeholderStat.size} bytes)`);

  // 2. Generate multi-resolution images
  for (const w of TARGET_WIDTHS) {
    const h = Math.round(w * meta.height / meta.width);

    // Prepare pipeline: Lanczos3 resize + mild sharpen for upscaling clarity
    const pipeline = sharp(SOURCE_IMAGE)
      .resize(w, h, {
        kernel: sharp.kernel.lanczos3,
        fit: 'cover'
      })
      .sharpen({
        sigma: 1.0,
        m1: 1.0,
        m2: 2.0
      });

    // AVIF (quality 60)
    const avifFile = path.join(OUTPUT_DIR, `bg-${w}.avif`);
    await pipeline.clone().avif({ quality: 60, effort: 4 }).toFile(avifFile);
    const avifSize = fs.statSync(avifFile).size;

    // WebP (quality 85)
    const webpFile = path.join(OUTPUT_DIR, `bg-${w}.webp`);
    await pipeline.clone().webp({ quality: 85, effort: 4 }).toFile(webpFile);
    const webpSize = fs.statSync(webpFile).size;

    // JPEG fallback (quality 88)
    const jpgFile = path.join(OUTPUT_DIR, `bg-${w}.jpg`);
    await pipeline.clone().jpeg({ quality: 88, mozjpeg: true }).toFile(jpgFile);
    const jpgSize = fs.statSync(jpgFile).size;

    summary.push({
      width: w,
      height: h,
      avif: `${Math.round(avifSize / 1024)} KB`,
      webp: `${Math.round(webpSize / 1024)} KB`,
      jpg: `${Math.round(jpgSize / 1024)} KB`
    });

    console.log(`  ✓ Built ${w}x${h} -> AVIF: ${Math.round(avifSize / 1024)} KB | WebP: ${Math.round(webpSize / 1024)} KB | JPG: ${Math.round(jpgSize / 1024)} KB`);
  }

  console.log('\n==================================================');
  console.log('Image Build Complete! Final Sizes:');
  console.table(summary);
  console.log('==================================================\n');
}

if (require.main === module) {
  buildImages().catch((err) => {
    console.error('Image build error:', err);
    process.exit(1);
  });
}

module.exports = { buildImages };
