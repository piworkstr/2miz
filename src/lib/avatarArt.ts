import { createAvatar } from '@dicebear/core';
import * as avataaars from '@dicebear/avataaars';
import { ART_H, ART_META, ART_W, type ArtLayerName } from './avatarAssets';

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

export type AvatarData = { kind: 'drawn'; opts: AvatarOpts } | { kind: 'photo'; photo: string } | { kind: 'art'; opts: ArtOpts };

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

// ---------------------------------------------------------------------------
// Çizgi avatar (yeni): Mert & Bahar çizimleriyle aynı suluboya stil, katmanlı.
// Katmanlar assets/avatar'da; sıralama: ten → yüz → sakal → saç → gözlük → başlık → üst giyim.

export type ArtOpts = {
  skin: string; // ten rengi (hex)
  face: ArtLayerName; // ruh hali yokken yüz
  hair: ArtLayerName | 'none';
  hairColor: string;
  beard: ArtLayerName | 'none';
  glasses: ArtLayerName | 'none';
  head: ArtLayerName | 'none'; // başörtüsü, şapka
  top: ArtLayerName;
  clothColor: string;
  bg: string;
};

export type ArtItem = { id: ArtLayerName | 'none'; label: string; f?: boolean; m?: boolean };
export const ART = {
  skin: ['#fce2c4', '#f3cfa8', '#e8b98c', '#d9a37a', '#c68642', '#a86b3c', '#8d5524', '#5c3a21'],
  hairColor: ['#1e1a18', '#3a2a22', '#795640', '#a0714f', '#c4934f', '#e0c080', '#a7412c', '#8e8a8c', '#e8e1e1', '#d98fa0'],
  clothColor: [
    '#f7f2ea',
    '#2b2b30',
    '#9db5cc',
    '#5c7fa8',
    '#2f5d8a',
    '#7aa36f',
    '#3f6b4f',
    '#e2b23a',
    '#e07a45',
    '#d65849',
    '#d98fa0',
    '#b98ad1',
    '#8e8a8c',
  ],
  bg: ['#ffd5dc', '#ffdfbf', '#fff3b0', '#d1f2d9', '#c0e8f9', '#d9d2f5', '#f4f0ec', '#e8516a'],
  face: [
    { id: 'f_notr', label: 'Sakin' },
    { id: 'f_nazik', label: 'Nazik' },
    { id: 'f_kadin', label: 'Kirpikli' },
    { id: 'f_erkek', label: 'Kalın kaş' },
    { id: 'f_goz', label: 'Göz kırpan' },
    { id: 'f_mutlu', label: 'Neşeli' },
  ] as ArtItem[],
  hair: [
    { id: 'none', label: 'Yok' },
    { id: 'h_yanayrik', label: 'Yan ayrık', m: true },
    { id: 'h_dalgali', label: 'Dalgalı', m: true },
    { id: 'h_sifir', label: 'Sıfır', m: true },
    { id: 'h_kivircik', label: 'Kıvırcık', m: true },
    { id: 'h_kakul', label: 'Kâkül', m: true },
    { id: 'h_geri', label: 'Geri taralı', m: true },
    { id: 'h_omuz', label: 'Omuz', m: true },
    { id: 'h_topuz_e', label: 'Topuz', m: true },
    { id: 'h_uzunduz', label: 'Uzun düz', f: true },
    { id: 'h_uzundalga', label: 'Uzun dalgalı', f: true },
    { id: 'h_kare', label: 'Küt', f: true },
    { id: 'h_atkuyrugu', label: 'At kuyruğu', f: true },
    { id: 'h_topuz', label: 'Topuz', f: true },
    { id: 'h_uzunkivircik', label: 'Kıvırcık', f: true },
    { id: 'h_pixie', label: 'Kısa', f: true },
    { id: 'h_orgu', label: 'Örgü', f: true },
  ] as ArtItem[],
  beard: [
    { id: 'none', label: 'Yok' },
    { id: 's_kirli', label: 'Kirli sakal' },
    { id: 's_sakal', label: 'Sakal' },
    { id: 's_biyik', label: 'Bıyık' },
    { id: 's_keci', label: 'Keçi sakal' },
  ] as ArtItem[],
  glasses: [
    { id: 'none', label: 'Yok' },
    { id: 'g_yuvarlak', label: 'Yuvarlak' },
    { id: 'g_kare', label: 'Köşeli' },
  ] as ArtItem[],
  head: [
    { id: 'none', label: 'Yok' },
    { id: 'k_basortu', label: 'Başörtüsü' },
    { id: 'k_sapka', label: 'Şapka' },
  ] as ArtItem[],
  top: [
    { id: 't_tisort', label: 'Tişört' },
    { id: 't_vyaka', label: 'V yaka' },
    { id: 't_kapson', label: 'Kapşonlu' },
    { id: 't_gomlek', label: 'Gömlek' },
    { id: 't_kazak', label: 'Kazak' },
    { id: 't_ceket', label: 'Ceket' },
    { id: 't_kot', label: 'Kot ceket' },
    { id: 't_bluz', label: 'Bluz' },
    { id: 't_tulum', label: 'Tulum' },
  ] as ArtItem[],
};

export const DEFAULT_ART: ArtOpts = {
  skin: '#fce2c4',
  face: 'f_notr',
  hair: 'h_yanayrik',
  hairColor: '#795640',
  beard: 'none',
  glasses: 'none',
  head: 'none',
  top: 't_tisort',
  clothColor: '#9db5cc',
  bg: '#ffd5dc',
};

export function randomArt(): ArtOpts {
  const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];
  const fem = Math.random() < 0.5;
  const hairs = ART.hair.filter((h) => (fem ? h.f : h.m));
  return {
    skin: pick(ART.skin.slice(0, 6)),
    face: pick(fem ? ['f_kadin', 'f_notr', 'f_nazik'] : ['f_erkek', 'f_notr', 'f_nazik']) as ArtLayerName,
    hair: pick(hairs).id,
    hairColor: pick(ART.hairColor.slice(0, 7)),
    beard: !fem && Math.random() < 0.35 ? pick(ART.beard.slice(1)).id : 'none',
    glasses: Math.random() < 0.25 ? pick(ART.glasses.slice(1)).id : 'none',
    head: 'none',
    top: pick(ART.top).id as ArtLayerName,
    clothColor: pick(ART.clothColor),
    bg: pick(ART.bg),
  };
}

// Ruh hali → yüz katmanı
export const MOOD_FACE: Record<MoodKey, ArtLayerName> = {
  mutlu: 'f_mutlu',
  asik: 'f_asik',
  ozledim: 'f_ozledim',
  heyecanli: 'f_heyecanli',
  yorgun: 'f_yorgun',
  uykulu: 'f_uykulu',
  uzgun: 'f_uzgun',
  sinirli: 'f_sinirli',
  hasta: 'f_hasta',
  ac: 'f_ac',
};

export type ArtLayer = { name: ArtLayerName; tint?: string };
// Çizim sırası. withTop=false: dünya karakteri (gövde ayrı çizim).
export function artLayers(o: ArtOpts, mood: MoodKey | null = null, withTop = true): ArtLayer[] {
  const out: ArtLayer[] = [{ name: 'base', tint: o.skin }, { name: mood ? MOOD_FACE[mood] : o.face }];
  if (o.beard !== 'none') out.push({ name: o.beard, tint: o.hairColor });
  if (o.hair !== 'none' && o.head !== 'k_basortu') out.push({ name: o.hair, tint: o.hairColor });
  if (o.glasses !== 'none') out.push({ name: o.glasses });
  if (o.head !== 'none') out.push({ name: o.head, tint: o.clothColor });
  if (withTop) out.push({ name: o.top, tint: o.clothColor });
  return out;
}

// Gövde seçimi (çiftçi tulumu kadın/erkek): sakal → erkek; kadın saçı → kadın.
export function artBody(o: ArtOpts): 'm' | 'f' {
  if (o.beard !== 'none') return 'm';
  if (o.head === 'k_basortu') return 'f';
  const h = ART.hair.find((x) => x.id === o.hair);
  if (h?.f) return 'f';
  if (o.face === 'f_kadin') return 'f';
  return 'm';
}

// Albüm / baskı HTML'i: katmanlar mutlak konumlu <img>; renklendirme CSS maskesiyle. src(name) dosyanın URL'sini verir.
export function artAvatarHtml(o: ArtOpts, src: (file: string) => string, mood: MoodKey | null = null): string {
  const parts = artLayers(o, mood, true).map((l) => {
    const L = ART_META[l.name];
    if (!L.tint) return `<img src="${src(l.name + '.webp')}" style="position:absolute;inset:0;width:100%;height:100%"/>`;
    const m = src(l.name + '.webp');
    return (
      `<div style="position:absolute;inset:0;background:${l.tint};-webkit-mask:url(${m}) center/100% 100% no-repeat;mask:url(${m}) center/100% 100% no-repeat"></div>` +
      `<img src="${src(l.name + '_r.webp')}" style="position:absolute;inset:0;width:100%;height:100%"/>`
    );
  });
  return `<div style="position:relative;width:100%;aspect-ratio:${ART_W}/${ART_H};background:${o.bg}">${parts.join('')}</div>`;
}
