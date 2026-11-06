import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { albumPrintHtml, BLEED_MM, TRIM_MM } from '../src/lib/albumHtml';
import type { AlbumInput, AlbumPlan, AlbumSize } from '../src/lib/albumLayout';
import { EMBEDDED_FONTS } from './fonts';

// İç sayfalar ve kapak için ayrı, taşma paylı PDF üretir. Sayfa sayısı 4'ün katı olmalı.
export async function renderAlbum(plan: AlbumPlan, input: AlbumInput, size: AlbumSize, outDir: string) {
  if (plan.pages.length % 4 !== 0) throw new Error(`Sayfa sayısı 4'ün katı değil: ${plan.pages.length}`);
  fs.mkdirSync(outDir, { recursive: true });
  const [w, h] = TRIM_MM[size];
  const width = `${w + 2 * BLEED_MM}mm`;
  const height = `${h + 2 * BLEED_MM}mm`;
  const browser = await chromium.launch();
  try {
    for (const part of ['interior', 'cover'] as const) {
      const page = await browser.newPage();
      await page.setContent(albumPrintHtml(plan, input, size, part, EMBEDDED_FONTS), { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      const file = path.join(outDir, part === 'interior' ? 'ic-sayfalar.pdf' : 'kapak.pdf');
      await page.pdf({ path: file, width, height, printBackground: true, preferCSSPageSize: true });
      await page.close();
    }
  } finally {
    await browser.close();
  }
  const kinds = plan.pages.map((p) => p.kind);
  fs.writeFileSync(
    path.join(outDir, 'bilgi.txt'),
    [
      `Boyut: ${size === '21x21' ? '21 x 21 cm' : 'A4 (21 x 29,7 cm)'} + her kenarda ${BLEED_MM} mm taşma payı`,
      `İç sayfa: ${plan.pages.length} (4'ün katı)`,
      `Anı sayfası: ${plan.contentPages}, not sayfası: ${plan.fillers}`,
      `Dönem: ${plan.from} – ${plan.to}`,
      `Kapak: yalnızca ön kapak; sırt ve arka kapak matbaanın şablonuna göre eklenecek.`,
      '',
      `Sayfa sırası: ${kinds.join(', ')}`,
    ].join('\n'),
  );
}
