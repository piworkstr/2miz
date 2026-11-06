import fs from 'node:fs';
import path from 'node:path';

// Baskıda yazı tipleri internete bağlı kalmasın diye dosyadan gömülür.
const root = path.resolve(__dirname, '..', 'node_modules', '@expo-google-fonts');
const face = (family: string, weight: number, file: string) =>
  `@font-face{font-family:'${family}';font-weight:${weight};src:url(data:font/ttf;base64,${fs.readFileSync(path.join(root, file)).toString('base64')}) format('truetype')}`;

export const EMBEDDED_FONTS = `<style>${[
  face('Caveat', 500, 'caveat/500Medium/Caveat_500Medium.ttf'),
  face('Caveat', 700, 'caveat/700Bold/Caveat_700Bold.ttf'),
  face('Baloo 2', 500, 'baloo-2/500Medium/Baloo2_500Medium.ttf'),
  face('Baloo 2', 700, 'baloo-2/700Bold/Baloo2_700Bold.ttf'),
].join('')}</style>`;
