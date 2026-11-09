import { createAvatar } from '@dicebear/core';
import * as avataaars from '@dicebear/avataaars';

// Saf avatar çizimi: uygulama ve Baskı Merkezi (Node) aynı kodu kullanır.
// Kişinin çizgi film avatarı (Avataaars, Pablo Stanley; ticari kullanıma serbest) ya da profil fotoğrafı.
export type AvatarOpts = {
  skin: string;
  top: string;
  hairColor: string;
  facialHair: string; // 'none' ya da sakal tipi
  accessories: string; // 'none' ya da gözlük
  clothing: string;
  clothesColor: string;
  bg: string;
  eyes?: string; // ruh hali yokkenki yüz
  eyebrows?: string;
  mouth?: string;
};

export type AvatarData = { kind: 'drawn'; opts: AvatarOpts } | { kind: 'photo'; photo: string };

export const OPTIONS = {
  skin: ['ffdbb4', 'edb98a', 'd08b5b', 'ae5d29', '614335', 'fd9841', 'f8d25c'],
  top: [
    'bob',
    'bun',
    'curly',
    'curvy',
    'straight01',
    'straight02',
    'straightAndStrand',
    'longButNotTooLong',
    'bigHair',
    'miaWallace',
    'frida',
    'fro',
    'froBand',
    'dreads',
    'dreads01',
    'dreads02',
    'frizzle',
    'shaggy',
    'shaggyMullet',
    'shortCurly',
    'shortFlat',
    'shortRound',
    'shortWaved',
    'sides',
    'theCaesar',
    'theCaesarAndSidePart',
    'shavedSides',
    'hijab',
    'turban',
    'hat',
    'winterHat1',
    'winterHat02',
    'winterHat03',
    'winterHat04',
  ],
  hairColor: ['2c1b18', '4a312c', '724133', 'a55728', 'b58143', 'd6b370', 'c93305', 'f59797', 'ecdcbf', 'e8e1e1'],
  facialHair: ['none', 'beardLight', 'beardMedium', 'beardMajestic', 'moustacheFancy', 'moustacheMagnum'],
  accessories: ['none', 'prescription01', 'prescription02', 'round', 'wayfarers', 'sunglasses', 'kurt'],
  clothing: [
    'hoodie',
    'shirtCrewNeck',
    'shirtScoopNeck',
    'shirtVNeck',
    'graphicShirt',
    'collarAndSweater',
    'blazerAndShirt',
    'blazerAndSweater',
    'overall',
  ],
  clothesColor: [
    'ff488e',
    'ff5c5c',
    'ffafb9',
    'ffffb1',
    'a7ffc4',
    'b1e2ff',
    '65c9ff',
    '5199e4',
    '25557c',
    '3c4f5c',
    '262e33',
    '929598',
    'e6e6e6',
    'ffffff',
  ],
  bg: ['ffd5dc', 'ffdfbf', 'fff3b0', 'd1f2d9', 'c0e8f9', 'd9d2f5', 'f4f0ec', 'e8516a'],
  eyes: ['default', 'happy', 'wink', 'winkWacky', 'side', 'squint', 'surprised', 'hearts', 'eyeRoll', 'closed'],
  eyebrows: [
    'defaultNatural',
    'default',
    'flatNatural',
    'raisedExcitedNatural',
    'raisedExcited',
    'upDownNatural',
    'upDown',
    'frownNatural',
    'angryNatural',
    'unibrowNatural',
  ],
  mouth: ['smile', 'default', 'twinkle', 'tongue', 'serious', 'eating', 'disbelief', 'grimace', 'concerned'],
} satisfies Record<keyof AvatarOpts, string[]>;

export const DEFAULT_OPTS: AvatarOpts = {
  skin: 'edb98a',
  top: 'shortWaved',
  hairColor: '2c1b18',
  facialHair: 'none',
  accessories: 'none',
  clothing: 'hoodie',
  clothesColor: 'ff488e',
  bg: 'ffd5dc',
  eyes: 'default',
  eyebrows: 'defaultNatural',
  mouth: 'smile',
};

export function randomOpts(): AvatarOpts {
  const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];
  return {
    skin: pick(OPTIONS.skin),
    top: pick(OPTIONS.top),
    hairColor: pick(OPTIONS.hairColor),
    facialHair: Math.random() < 0.3 ? pick(OPTIONS.facialHair.slice(1)) : 'none',
    accessories: Math.random() < 0.3 ? pick(OPTIONS.accessories.slice(1)) : 'none',
    clothing: pick(OPTIONS.clothing),
    clothesColor: pick(OPTIONS.clothesColor),
    bg: pick(OPTIONS.bg),
    eyes: pick(['default', 'happy', 'wink', 'side', 'squint']),
    eyebrows: pick(['defaultNatural', 'default', 'raisedExcitedNatural', 'flatNatural']),
    mouth: pick(['smile', 'default', 'twinkle', 'tongue']),
  };
}

// Ruh hali: avatarın yüz ifadesi değişir; fotoğraflı profilde köşede emoji çıkar. 24 saat geçerli.
export const MOODS = {
  mutlu: { emoji: '😊', label: 'Mutluyum', face: ['happy', 'smile', 'defaultNatural'] },
  asik: { emoji: '😍', label: 'Aşığım', face: ['hearts', 'smile', 'raisedExcitedNatural'] },
  ozledim: { emoji: '🥺', label: 'Seni özledim', face: ['default', 'concerned', 'sadConcernedNatural'] },
  heyecanli: { emoji: '🤩', label: 'Heyecanlıyım', face: ['surprised', 'smile', 'raisedExcitedNatural'] },
  yorgun: { emoji: '🥱', label: 'Yorgunum', face: ['squint', 'serious', 'sadConcerned'] },
  uykulu: { emoji: '😴', label: 'Uykum var', face: ['closed', 'default', 'defaultNatural'] },
  uzgun: { emoji: '😢', label: 'Üzgünüm', face: ['cry', 'sad', 'sadConcernedNatural'] },
  sinirli: { emoji: '😤', label: 'Sinirliyim', face: ['squint', 'serious', 'angryNatural'] },
  hasta: { emoji: '🤒', label: 'Hastayım', face: ['xDizzy', 'concerned', 'sadConcernedNatural'] },
  ac: { emoji: '🍕', label: 'Acıktım', face: ['default', 'eating', 'raisedExcitedNatural'] },
} as const;
export type MoodKey = keyof typeof MOODS;
export const MOOD_TTL = 24 * 60 * 60 * 1000;

export function activeMood(m?: { key: MoodKey; atMs: number } | null): MoodKey | null {
  return m && MOODS[m.key] && Date.now() - m.atMs < MOOD_TTL ? m.key : null;
}

const svgCache = new Map<string, string>();

// Hayal dünyalarındaki karakter için: daire kırpması olmadan, şeffaf zeminde baş ve omuzlar.
export function avatarBustSvg(o: AvatarOpts): string {
  const key = JSON.stringify(['bust', o]);
  const hit = svgCache.get(key);
  if (hit) return hit;
  let svg = createAvatar(avataaars, {
    seed: 'usdaily',
    backgroundColor: ['transparent'],
    skinColor: [o.skin],
    top: [o.top as never],
    topProbability: 100,
    hairColor: [o.hairColor],
    hatColor: [o.clothesColor],
    facialHair: o.facialHair === 'none' ? undefined : [o.facialHair as never],
    facialHairProbability: o.facialHair === 'none' ? 0 : 100,
    facialHairColor: [o.hairColor],
    accessories: o.accessories === 'none' ? undefined : [o.accessories as never],
    accessoriesProbability: o.accessories === 'none' ? 0 : 100,
    accessoriesColor: ['262e33'],
    clothing: [o.clothing as never],
    clothesColor: [o.clothesColor],
    clothingGraphic: ['pizza'],
    eyes: ['happy' as never],
    mouth: ['smile' as never],
    eyebrows: [(o.eyebrows ?? 'defaultNatural') as never],
  }).toString();
  svg = svg.replace(/<metadata[\s\S]*?<\/metadata>/, '');
  svgCache.set(key, svg);
  return svg;
}

// head: yalnızca baş ve boyun; omuz ve kıyafet yok. Dünya karakterlerinde gövde ayrı çizim (çiftçi tulumu vb.) olarak eklenir.
// avataaars'ta ten rengi tek bir yol: baş + boyun + omuzlar. Omuz kısmı boyun kütüğüyle değiştirilir, kıyafet grubu silinir.
export function avatarHeadSvg(o: AvatarOpts): string {
  const key = JSON.stringify(['head', o]);
  const hit = svgCache.get(key);
  if (hit) return hit;
  let svg = avatarBustSvg(o);
  svg = svg.replace(/v18\.4h-4a72 72 0 0 0-72 72v9h200v-9a72 72 0 0 0-72-72h-4v-18\.39/, 'v18.4h48v-18.39');
  const start = svg.indexOf('<g transform="translate(0 170)">');
  if (start >= 0) {
    // dengeli kapanışı bul
    const re = /<g\b|<\/g>/g;
    re.lastIndex = start;
    let depth = 0;
    let end = -1;
    for (let m = re.exec(svg); m; m = re.exec(svg)) {
      depth += m[0] === '</g>' ? -1 : 1;
      if (depth === 0) {
        end = m.index + m[0].length;
        break;
      }
    }
    if (end > 0) svg = svg.slice(0, start) + svg.slice(end);
  }
  svg = svg.replace(/viewBox="0 0 280 280"/, 'viewBox="0 0 280 200"');
  svgCache.set(key, svg);
  return svg;
}

// face: sadece yüzü yakından gösteren önizleme (göz/kaş/ağız seçimi için).
export function avatarSvg(o: AvatarOpts, mood: MoodKey | null = null, withBg = true, face = false): string {
  const key = JSON.stringify([o, mood, withBg, face]);
  const hit = svgCache.get(key);
  if (hit) return hit;
  const [eyes, mouth, eyebrows] = mood ? MOODS[mood].face : [o.eyes ?? 'default', o.mouth ?? 'smile', o.eyebrows ?? 'defaultNatural'];
  let svg = createAvatar(avataaars, {
    seed: 'usdaily',
    style: ['circle'],
    backgroundColor: withBg ? [o.bg] : ['transparent'],
    skinColor: [o.skin],
    top: [o.top as never],
    topProbability: 100,
    hairColor: [o.hairColor],
    hatColor: [o.clothesColor],
    facialHair: o.facialHair === 'none' ? undefined : [o.facialHair as never],
    facialHairProbability: o.facialHair === 'none' ? 0 : 100,
    facialHairColor: [o.hairColor],
    accessories: o.accessories === 'none' ? undefined : [o.accessories as never],
    accessoriesProbability: o.accessories === 'none' ? 0 : 100,
    accessoriesColor: ['262e33'],
    clothing: [o.clothing as never],
    clothesColor: [o.clothesColor],
    clothingGraphic: ['pizza'],
    eyes: [eyes as never],
    mouth: [mouth as never],
    eyebrows: [eyebrows as never],
  }).toString();
  // react-native-svg <metadata> etiketini tanımıyor.
  svg = svg.replace(/<metadata[\s\S]*?<\/metadata>/, '');
  if (face) svg = svg.replace('viewBox="0 0 280 280"', 'viewBox="80 70 120 120"');
  if (svgCache.size > 300) svgCache.clear();
  svgCache.set(key, svg);
  return svg;
}
