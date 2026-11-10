import type { Lang } from './i18n';
import type { ThemeId } from './theme';

export type LoveLanguage = 'soz' | 'zaman' | 'hediye' | 'temas' | 'hizmet';

export const LOVE_LANGUAGES: Record<LoveLanguage, { name: string; description: string; theme: ThemeId }> = {
  soz: {
    name: 'İltifat',
    description: 'Güzel sözler, "seni seviyorum"lar ve takdir edilmek seni en çok mutlu eden şey.',
    theme: 'asko',
  },
  zaman: {
    name: 'Birlikte zaman',
    description: 'Telefonsuz, bölünmeden, sadece ikinize ait zaman senin için her şeyden değerli.',
    theme: 'standart',
  },
  hediye: {
    name: 'Hediye',
    description: 'Fiyatı değil düşüncesi önemli: aklına gelinmiş olmak, küçük sürprizler.',
    theme: 'standart',
  },
  temas: {
    name: 'Fiziksel temas',
    description: 'Sarılmak, el ele tutuşmak, yan yana oturmak sana sevildiğini en iyi hissettiren şey.',
    theme: 'asko',
  },
  hizmet: {
    name: 'Yardım etmek',
    description: 'Laf değil iş: senin için bir şeyi halletmesi, yükünü paylaşması.',
    theme: 'agir',
  },
};

type Question = { q: string; options: { text: string; lang: LoveLanguage }[] };

export const QUESTIONS: Question[] = [
  {
    q: 'Sevgilin seni en çok ne yapınca mutlu eder?',
    options: [
      { text: '"Seninle gurur duyuyorum" dediğinde', lang: 'soz' },
      { text: 'Telefonu bırakıp sadece seninle ilgilendiğinde', lang: 'zaman' },
      { text: 'Aklına gelip küçük bir şey aldığında', lang: 'hediye' },
      { text: 'Sarılıp elini tuttuğunda', lang: 'temas' },
      { text: 'Senin yerine bir işini hallettiğinde', lang: 'hizmet' },
    ],
  },
  {
    q: 'Kötü bir gün geçirdin. En çok neye ihtiyacın var?',
    options: [
      { text: 'Beni teselli eden güzel sözlere', lang: 'soz' },
      { text: 'Yanımda oturup beni dinlemesine', lang: 'zaman' },
      { text: 'Sevdiğim bir şeyle kapıda belirmesine', lang: 'hediye' },
      { text: 'Uzun bir sarılmaya', lang: 'temas' },
      { text: 'O akşamın işlerini onun halletmesine', lang: 'hizmet' },
    ],
  },
  {
    q: 'Seni en çok ne kırar?',
    options: [
      { text: 'Hiç iltifat etmemesi', lang: 'soz' },
      { text: 'Birlikteyken aklının başka yerde olması', lang: 'zaman' },
      { text: 'Özel günleri unutması', lang: 'hediye' },
      { text: 'Mesafeli ve soğuk durması', lang: 'temas' },
      { text: 'Söz verdiği işi yapmaması', lang: 'hizmet' },
    ],
  },
  {
    q: 'Hayalindeki yıl dönümü nasıl?',
    options: [
      { text: 'Bana yazdığı uzun bir mektup', lang: 'soz' },
      { text: 'Sadece ikimizin olduğu bir hafta sonu', lang: 'zaman' },
      { text: 'Düşünülmüş, anlamlı bir hediye', lang: 'hediye' },
      { text: 'Kucak kucağa bir film gecesi', lang: 'temas' },
      { text: 'Her şeyi benim için önceden ayarlamış olması', lang: 'hizmet' },
    ],
  },
  {
    q: 'Sen sevgini en çok nasıl gösterirsin?',
    options: [
      { text: 'Söyleyerek, mesaj atarak', lang: 'soz' },
      { text: 'Ona vakit ayırarak', lang: 'zaman' },
      { text: 'Sürprizler yaparak', lang: 'hediye' },
      { text: 'Dokunarak, sarılarak', lang: 'temas' },
      { text: 'Ona yardım ederek', lang: 'hizmet' },
    ],
  },
];

// İngilizce: aynı sevgi dilleri, aynı sırayla (seçenek karışımı iki dilde de aynı kalsın).
const LOVE_LANGUAGES_EN: Record<LoveLanguage, { name: string; description: string }> = {
  soz: { name: 'Words of affirmation', description: 'Kind words, "I love you"s and feeling appreciated make you happiest.' },
  zaman: { name: 'Quality time', description: 'Phones down, no interruptions, time that belongs to just the two of you means everything.' },
  hediye: { name: 'Gifts', description: "It's the thought, not the price: being remembered, little surprises." },
  temas: { name: 'Physical touch', description: 'Hugs, holding hands, sitting close: that is when you feel most loved.' },
  hizmet: { name: 'Acts of service', description: 'Actions over words: taking something off your plate, sharing the load.' },
};

const QUESTIONS_EN: Question[] = [
  {
    q: 'What does your partner do that makes you happiest?',
    options: [
      { text: 'Says "I\'m proud of you"', lang: 'soz' },
      { text: 'Puts the phone away and is all yours', lang: 'zaman' },
      { text: 'Picks up a little something because they thought of you', lang: 'hediye' },
      { text: 'Hugs you and holds your hand', lang: 'temas' },
      { text: 'Takes care of a chore for you', lang: 'hizmet' },
    ],
  },
  {
    q: 'You had a rough day. What do you need most?',
    options: [
      { text: 'Kind words that lift me up', lang: 'soz' },
      { text: 'Them sitting with me and listening', lang: 'zaman' },
      { text: 'Them showing up with something I love', lang: 'hediye' },
      { text: 'A long hug', lang: 'temas' },
      { text: 'Them handling the evening chores', lang: 'hizmet' },
    ],
  },
  {
    q: 'What hurts you the most?',
    options: [
      { text: 'Never getting a compliment', lang: 'soz' },
      { text: 'Their mind being elsewhere when we are together', lang: 'zaman' },
      { text: 'Forgetting special days', lang: 'hediye' },
      { text: 'Them being distant and cold', lang: 'temas' },
      { text: 'Not doing what they promised', lang: 'hizmet' },
    ],
  },
  {
    q: 'What does your dream anniversary look like?',
    options: [
      { text: 'A long letter they wrote for me', lang: 'soz' },
      { text: 'A weekend that is just the two of us', lang: 'zaman' },
      { text: 'A thoughtful, meaningful gift', lang: 'hediye' },
      { text: 'A cuddly movie night', lang: 'temas' },
      { text: 'Them having planned everything for me', lang: 'hizmet' },
    ],
  },
  {
    q: 'How do you show love the most?',
    options: [
      { text: 'By saying it, sending messages', lang: 'soz' },
      { text: 'By making time for them', lang: 'zaman' },
      { text: 'With surprises', lang: 'hediye' },
      { text: 'With touch and hugs', lang: 'temas' },
      { text: 'By helping them out', lang: 'hizmet' },
    ],
  },
];

export function loveLanguage(id: LoveLanguage, lang: Lang): { name: string; description: string; theme: ThemeId } {
  const base = LOVE_LANGUAGES[id];
  return lang === 'en' ? { ...base, ...LOVE_LANGUAGES_EN[id] } : base;
}

export function questions(lang: Lang): Question[] {
  return lang === 'en' ? QUESTIONS_EN : QUESTIONS;
}

// Seçenek sırası her soruda karışsın ki cevaplar bir kalıba oturmasın (sabit karışım, her açılışta aynı).
export function shuffled<T>(arr: T[], seed: number): T[] {
  const out = [...arr];
  let s = seed + 7;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function scoreAnswers(answers: LoveLanguage[]): LoveLanguage {
  const counts: Record<LoveLanguage, number> = { soz: 0, zaman: 0, hediye: 0, temas: 0, hizmet: 0 };
  answers.forEach((a) => counts[a]++);
  // Eşitlikte, son soruda (sevgini nasıl gösterirsin) seçilen öne geçer.
  const max = Math.max(...Object.values(counts));
  const last = answers[answers.length - 1];
  if (last && counts[last] === max) return last;
  return (Object.keys(counts) as LoveLanguage[]).find((k) => counts[k] === max) ?? 'zaman';
}
