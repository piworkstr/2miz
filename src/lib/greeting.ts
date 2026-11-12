import { doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { ThemeId } from './theme';

// Ana sayfadaki selamlama: günün saatine ve temaya göre, her gün farklı bir cümle.
// {x} yerine partnerinin sana taktığı hitaplardan biri gelir; yoksa temanın varsayılanı.
type Part = 'sabah' | 'gun' | 'aksam' | 'gece';

const PHRASES: Record<ThemeId, Record<Part, string[]>> = {
  standart: {
    sabah: ['Günaydın {x}', 'Güne güzel başla {x}', 'Günaydın {x}, bugün güzel geçecek'],
    gun: ['İyi günler {x}', 'Merhaba {x}', 'Nasıl gidiyor {x}?'],
    aksam: ['İyi akşamlar {x}', 'Akşamın güzel geçsin {x}', 'Hoş geldin {x}'],
    gece: ['İyi geceler {x}', 'Geç oldu {x}', 'Tatlı uykular {x}'],
  },
  agir: {
    sabah: ['Sabah oldu {x}', 'Günaydın {x}', 'Kalk {x}, iş var'],
    gun: ['Selam {x}', 'Naber {x}', 'Hayırlı işler {x}'],
    aksam: ['Akşam oldu {x}', 'İyi akşamlar {x}', 'Mesai bitti {x}'],
    gece: ['Gece mesaisi mi {x}?', 'Yat artık {x}', 'Hayırlı geceler {x}'],
  },
  asko: {
    sabah: ['Günaydın {x}', 'Günaydııın {x} ☀️', 'Uyandın mı {x}?'],
    gun: ['Tünaydın {x}', 'Selam {x}', 'Seni düşündüm {x}'],
    aksam: ['İyi akşamlar {x}', 'Akşamın tatlı olsun {x}', 'Özledim seni {x}'],
    gece: ['Tatlı rüyalar {x}', 'İyi geceler {x} 🌙', 'Uyumadın mı {x}?'],
  },
};

// İngilizcede her tema kendi karakteriyle (birebir çeviri değil).
const PHRASES_EN: Record<ThemeId, Record<Part, string[]>> = {
  standart: {
    sabah: ['Good morning {x}', 'Morning, {x}', 'Good morning {x}, today will be good'],
    gun: ['Good afternoon {x}', 'Hi {x}', "How's it going, {x}?"],
    aksam: ['Good evening {x}', 'Have a lovely evening {x}', 'Welcome back {x}'],
    gece: ['Good night {x}', "It's late, {x}", 'Sweet dreams {x}'],
  },
  agir: {
    sabah: ['Rise and shine {x}', 'Morning, {x}', 'Up, {x}. Work to do'],
    gun: ['Hey {x}', "What's up, {x}", 'Keep it moving {x}'],
    aksam: ['Evening, {x}', "Shift's over, {x}", 'Good evening {x}'],
    gece: ['Night shift, {x}?', 'Go to bed {x}', 'Night, {x}'],
  },
  asko: {
    sabah: ['Good morning {x}', 'Gooood morning {x} ☀️', 'Are you awake, {x}?'],
    gun: ['Hello {x}', 'Hi {x}', 'Thinking of you, {x}'],
    aksam: ['Good evening {x}', 'Sweet evening, {x}', 'Missing you {x}'],
    gece: ['Sweet dreams {x}', 'Good night {x} 🌙', 'Still awake, {x}?'],
  },
};

const DEFAULT_PET_EN: Record<ThemeId, string[] | null> = {
  standart: null,
  agir: ['boss', 'champ', 'chief'],
  asko: ['honey bun', 'sweetie', 'sugar'],
};

const DEFAULT_PET: Record<ThemeId, string[] | null> = {
  standart: null, // adın
  agir: ['reis', 'kral', 'usta'],
  asko: ['bal böceğim', 'tatlım', 'şekerim'],
};

function partOfDay(h: number): Part {
  if (h >= 5 && h < 11) return 'sabah';
  if (h >= 11 && h < 17) return 'gun';
  if (h >= 17 && h < 22) return 'aksam';
  return 'gece';
}

function hash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

export function greeting(
  theme: ThemeId,
  myName: string,
  petNames: string[] | undefined,
  now = new Date(),
  lang: 'tr' | 'en' = 'tr',
): string {
  const part = partOfDay(now.getHours());
  const seed = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${part}`;
  const list = (lang === 'en' ? PHRASES_EN : PHRASES)[theme][part];
  const pets = petNames?.filter((p) => p.trim()) ?? [];
  const pool = pets.length ? pets : ((lang === 'en' ? DEFAULT_PET_EN : DEFAULT_PET)[theme] ?? [myName]);
  const x = pool[hash(seed + 'x') % pool.length] || myName;
  return list[hash(seed) % list.length].replace('{x}', x).trim();
}

// Partnerine nasıl hitap ettiğin (en fazla 5). Onun ekranındaki selamlamada senin hitapların çıkar.
export const PET_MAX = 5;
export async function savePetNames(uid: string, names: string[]) {
  const clean = [...new Set(names.map((n) => n.trim().slice(0, 20)).filter(Boolean))].slice(0, PET_MAX);
  await updateDoc(doc(db, 'users', uid), { petNames: clean });
}
