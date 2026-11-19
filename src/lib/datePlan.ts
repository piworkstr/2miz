import type { PartnerCat } from './perks';

// Date planlayıcı: bütçe, tür ve süreye göre adım adım bir program kurar. Sunucu ve yapay zekâ yok;
// adımlar aşağıdaki hazır havuzdan, toplam bütçeyi aşmayacak biçimde seçilir. Fiyatlar iki kişi için yaklaşık tutardır.
export type DateType = 'romantik' | 'eglenceli' | 'macera' | 'sakin';
export type DateDur = 'short' | 'half' | 'full';
export const DATE_TYPES: Record<DateType, { label: string; icon: string }> = {
  romantik: { label: 'Romantik', icon: 'heart' },
  eglenceli: { label: 'Eğlenceli', icon: 'happy' },
  macera: { label: 'Macera', icon: 'compass' },
  sakin: { label: 'Sakin', icon: 'leaf' },
};
export const DATE_DURS: Record<DateDur, { label: string; mins: number; start: number; steps: [number, number] }> = {
  short: { label: '1-2 saat', mins: 110, start: 18 * 60, steps: [3, 3] },
  half: { label: 'Yarım gün', mins: 240, start: 14 * 60, steps: [4, 5] },
  full: { label: 'Tam gün', mins: 480, start: 10 * 60 + 30, steps: [6, 7] },
};
export const BUDGETS = [500, 1000, 2000];

type Slot = 'start' | 'mid' | 'end';
type Act = {
  id: string;
  name: string;
  mins: number;
  cost: number;
  types: DateType[];
  slot: Slot[];
  cat?: PartnerCat; // anlaşmalı mekan türü (varsa kampanyası adımın altında görünür)
  kind?: 'question' | 'photo';
  long?: true; // yalnız yarım gün ve tam günde
  morn?: true; // sabah işi: yalnız tam günde (10:30 başlar)
  eve?: true; // akşam işi: yarım günde (14:00-18:00) çıkmaz
};
const R: DateType = 'romantik';
const E: DateType = 'eglenceli';
const M: DateType = 'macera';
const S: DateType = 'sakin';
const ALL: DateType[] = [R, E, M, S];

const POOL: Act[] = [
  // başlangıç
  { id: 'kahve', name: 'Kahve içmek', mins: 45, cost: 300, types: ALL, slot: ['start', 'mid'], cat: 'kafe' },
  { id: 'cay', name: 'Çay bahçesinde çay ve simit', mins: 40, cost: 150, types: [S, R], slot: ['start', 'mid'] },
  {
    id: 'kahvalti',
    name: 'Uzun bir kahvaltı',
    mins: 90,
    cost: 900,
    types: [R, S],
    slot: ['start'],
    cat: 'restoran',
    long: true,
    morn: true,
  },
  {
    id: 'evkahvalti',
    name: 'Evde birlikte kahvaltı hazırlamak',
    mins: 75,
    cost: 250,
    types: [S, R],
    slot: ['start'],
    long: true,
    morn: true,
  },
  { id: 'firin', name: 'Fırından sıcak poğaça alıp parkta yemek', mins: 35, cost: 150, types: [S, E, M], slot: ['start'], morn: true },
  { id: 'termos', name: 'Termosla çay yapıp yola çıkmak', mins: 20, cost: 50, types: [M, S], slot: ['start'], morn: true },
  // orta: ücretsiz ya da ucuz
  { id: 'sahil', name: 'Sahilde yürüyüş', mins: 60, cost: 0, types: [R, S], slot: ['mid', 'start'] },
  { id: 'park', name: 'Parkta el ele yürüyüş', mins: 45, cost: 0, types: [R, S], slot: ['mid', 'start'] },
  { id: 'eskisehir', name: 'Eski sokaklarda kaybolmak', mins: 60, cost: 0, types: [M, R, E], slot: ['mid'] },
  { id: 'kitapci', name: 'Kitapçıda birbirinize kitap seçmek', mins: 40, cost: 0, types: [S, R], slot: ['mid'] },
  { id: 'sahaf', name: 'Sahaf ve antikacı gezmek', mins: 45, cost: 0, types: [S, M], slot: ['mid'] },
  { id: 'pazar', name: 'Semt pazarını gezip meyve almak', mins: 45, cost: 150, types: [E, S], slot: ['mid'] },
  { id: 'bank', name: 'Bir bankta oturup insanları izlemek', mins: 25, cost: 0, types: [S, E], slot: ['mid'] },
  { id: 'calgi', name: 'Sokak müzisyeni dinlemek', mins: 25, cost: 50, types: [R, E], slot: ['mid'] },
  { id: 'manzara', name: 'Şehrin manzara noktasına çıkmak', mins: 50, cost: 0, types: [R, M], slot: ['mid', 'end'] },
  { id: 'vitrin', name: 'Çarşıda vitrin gezmek', mins: 40, cost: 0, types: [E, S], slot: ['mid'] },
  { id: 'hediye', name: 'Birbirinize 100 TL’lik sürpriz hediye almak', mins: 40, cost: 200, types: [E, R], slot: ['mid'] },
  { id: 'liste', name: 'Birlikte bir hayal listesi yazmak', mins: 30, cost: 0, types: [R, S], slot: ['mid'] },
  { id: 'mektup', name: 'Birbirinize kısa bir not yazıp okumak', mins: 25, cost: 0, types: [R, S], slot: ['mid'] },
  { id: 'calmalistesi', name: 'Ortak bir çalma listesi hazırlamak', mins: 30, cost: 0, types: [S, E, R], slot: ['mid'] },
  { id: 'oyun', name: 'Kutu oyunu ya da tavla oynamak', mins: 45, cost: 0, types: [E, S], slot: ['mid'] },
  // orta: ücretli
  { id: 'muze', name: 'Müze ya da sergi gezmek', mins: 75, cost: 300, types: [S, R, M], slot: ['mid'] },
  { id: 'sinema', name: 'Sinemada film izlemek', mins: 130, cost: 600, types: [E, S, R], slot: ['mid', 'end'], cat: 'sinema', long: true },
  { id: 'bowling', name: 'Bowling oynamak', mins: 60, cost: 700, types: [E], slot: ['mid'], cat: 'eglence' },
  { id: 'atari', name: 'Oyun salonunda kapışmak', mins: 45, cost: 400, types: [E], slot: ['mid'], cat: 'eglence' },
  { id: 'bilardo', name: 'Bilardo ya da langırt oynamak', mins: 45, cost: 300, types: [E], slot: ['mid'], cat: 'eglence' },
  { id: 'karaoke', name: 'Karaokede şarkı söylemek', mins: 60, cost: 600, types: [E], slot: ['mid', 'end'], cat: 'eglence', eve: true },
  { id: 'kacis', name: 'Kaçış odası', mins: 75, cost: 1200, types: [E, M], slot: ['mid'], cat: 'eglence' },
  { id: 'paten', name: 'Buz pateni ya da paten', mins: 60, cost: 600, types: [E, M], slot: ['mid'] },
  { id: 'bisiklet', name: 'Bisiklet kiralayıp tur atmak', mins: 75, cost: 300, types: [M, E], slot: ['mid'] },
  { id: 'vapur', name: 'Vapur ya da tekne turu', mins: 60, cost: 200, types: [R, M, S], slot: ['mid'] },
  { id: 'doga', name: 'Doğa yürüyüşü', mins: 120, cost: 0, types: [M], slot: ['mid'], long: true },
  { id: 'yenisemt', name: 'Hiç gitmediğiniz bir semte gitmek', mins: 90, cost: 150, types: [M], slot: ['mid'], long: true },
  { id: 'yakinkasaba', name: 'Yakın bir kasabaya kısa yolculuk', mins: 150, cost: 500, types: [M, R], slot: ['mid'], long: true },
  { id: 'kano', name: 'Kano ya da deniz bisikleti', mins: 60, cost: 600, types: [M, E], slot: ['mid'] },
  { id: 'tirmanis', name: 'Tırmanış duvarı denemek', mins: 75, cost: 800, types: [M], slot: ['mid'] },
  { id: 'gokart', name: 'Go-kart yarışı', mins: 45, cost: 1200, types: [M, E], slot: ['mid'], cat: 'eglence' },
  { id: 'atolye', name: 'Seramik ya da resim atölyesi', mins: 120, cost: 1500, types: [R, S, E], slot: ['mid'], long: true },
  { id: 'yemekkursu', name: 'Birlikte yemek atölyesi', mins: 150, cost: 2000, types: [R, E], slot: ['mid'], long: true },
  { id: 'spa', name: 'Hamam ya da masaj', mins: 90, cost: 2000, types: [S, R], slot: ['mid'], long: true },
  { id: 'piknik', name: 'Marketten alışveriş yapıp piknik', mins: 90, cost: 400, types: [R, S, M], slot: ['mid'], long: true },
  { id: 'ucurtma', name: 'Uçurtma uçurmak', mins: 45, cost: 150, types: [E, M], slot: ['mid'] },
  { id: 'tatli', name: 'Tatlı yemek', mins: 40, cost: 350, types: ALL, slot: ['mid', 'end'], cat: 'tatli' },
  { id: 'dondurma', name: 'Dondurma alıp yürümek', mins: 30, cost: 200, types: [E, R, S], slot: ['mid', 'end'], cat: 'tatli' },
  { id: 'sokak', name: 'Sokak lezzetleri turu', mins: 60, cost: 500, types: [E, M], slot: ['mid', 'end'] },
  // soru ve fotoğraf (her planda birer tane)
  { id: 'soru', name: 'Birbirinize 5 soru sorun', mins: 30, cost: 0, types: ALL, slot: ['mid'], kind: 'question' },
  { id: 'foto', name: 'Birlikte fotoğraf çekmek', mins: 20, cost: 0, types: ALL, slot: ['mid'], kind: 'photo' },
  { id: 'gunbatimi', name: 'Gün batımında fotoğraf', mins: 30, cost: 0, types: [R, S, M], slot: ['mid', 'end'], kind: 'photo' },
  { id: 'fotoavi', name: 'Fotoğraf avı: 5 komik kare', mins: 30, cost: 0, types: [E, M], slot: ['mid'], kind: 'photo' },
  // bitiş
  { id: 'yemek', name: 'Akşam yemeği', mins: 90, cost: 1300, types: ALL, slot: ['end'], cat: 'restoran' },
  { id: 'sikyemek', name: 'Şık bir restoranda akşam yemeği', mins: 110, cost: 2600, types: [R], slot: ['end'], cat: 'restoran', eve: true },
  { id: 'durum', name: 'Dürüm ya da tost yiyip yürümek', mins: 35, cost: 350, types: [E, M, S], slot: ['end', 'mid'] },
  { id: 'balik', name: 'Sahilde balık ekmek', mins: 40, cost: 400, types: [M, E, R], slot: ['end', 'mid'] },
  { id: 'evyemek', name: 'Evde birlikte yemek yapmak', mins: 90, cost: 450, types: [R, S], slot: ['end'] },
  {
    id: 'evfilm',
    name: 'Evde film gecesi ve patlamış mısır',
    mins: 120,
    cost: 150,
    types: [S, R, E],
    slot: ['end'],
    long: true,
    eve: true,
  },
  { id: 'yildiz', name: 'Yıldızları izlemek', mins: 40, cost: 0, types: [R, M, S], slot: ['end'], eve: true },
  { id: 'sahilcay', name: 'Sahilde çay içip sohbet', mins: 45, cost: 150, types: [R, S], slot: ['end', 'mid'] },
  { id: 'canli', name: 'Canlı müzik dinlemek', mins: 90, cost: 900, types: [E, R], slot: ['end'], cat: 'eglence', eve: true },
  { id: 'gecesurus', name: 'Gece şehir turu', mins: 45, cost: 100, types: [M, R], slot: ['end'], eve: true },
];

// Soru adımı için: plana göre seçilen beş soru.
const QUESTIONS = [
  'Benimle ilgili ilk hatırladığın şey ne?',
  'Bu yıl birlikte yaptığımız en güzel şey neydi?',
  'Beş yıl sonra bir pazar sabahımız nasıl geçsin istersin?',
  'Sana kendini en çok sevilmiş hissettirdiğim an hangisiydi?',
  'Birlikte öğrenmek istediğin bir şey var mı?',
  'Benden duymayı en çok sevdiğin söz ne?',
  'Çocukken hayalini kurduğun ama hiç anlatmadığın bir şey var mı?',
  'Birlikte gitmek istediğin ilk üç yer neresi?',
  'Son zamanlarda seni en çok ne yordu, nasıl destek olabilirim?',
  'Bizim şarkımız hangisi olmalı?',
  'İlişkimizde en çok neyle gurur duyuyorsun?',
  'Bugün seni en çok ne güldürdü?',
  'Bende en çok hangi huyumu seviyorsun?',
  'Birlikte başlatmak istediğin küçük bir gelenek var mı?',
  'İlk buluşmamızı yeniden yaşasak neyi aynı bırakırdın?',
];

export type Step = { id: string; n: string; m: number; c: number; cat?: PartnerCat; k?: 'question' | 'photo' };
export type Plan = { type: DateType; dur: DateDur; budget: number; start: number; steps: Step[]; total: number; seed: number };

// Tohumlu rastgele sayı (aynı tohum aynı planı verir).
function rng(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const shuffle = <T>(list: T[], r: () => number) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const toStep = (a: Act): Step => ({
  id: a.id,
  n: a.name,
  m: a.mins,
  c: a.cost,
  ...(a.cat ? { cat: a.cat } : {}),
  ...(a.kind ? { k: a.kind } : {}),
});
const fits = (a: Act, type: DateType, dur: DateDur) =>
  a.types.includes(type) && (dur !== 'short' || !a.long) && (dur === 'full' || !a.morn) && (dur !== 'half' || !a.eve);

export function makePlan(type: DateType, dur: DateDur, budget: number, seed: number): Plan {
  const r = rng(seed);
  const D = DATE_DURS[dur];
  const count = D.steps[0] + Math.floor(r() * (D.steps[1] - D.steps[0] + 1));
  const pool = shuffle(
    POOL.filter((a) => fits(a, type, dur)),
    r,
  );
  const used = new Set<string>();
  let money = budget;
  let mins = D.mins;
  // Bir yuvaya en uygun etkinlik: bütçeye sığmalı; süresi o adıma düşen süre payına, tutarı bütçe payına yakın olmalı
  // (plan hem süreyi doldursun hem bütçeyi kullansın). Küçük bir rastgelelik her seferinde başka plan çıkarır.
  const pick = (ok: (a: Act) => boolean, left: number, moneyShare: number): Act | null => {
    const cands = pool.filter((a) => !used.has(a.id) && ok(a) && a.cost <= money);
    const share = Math.max(20, mins / Math.max(1, left));
    const target = money * moneyShare;
    const score = (a: Act) => Math.abs(a.mins - share) / share + (0.6 * Math.abs(a.cost - target)) / Math.max(target, 150) + r() * 0.6;
    const a = cands.map((x) => [score(x), x] as const).sort((x, y) => x[0] - y[0])[0]?.[1] ?? null;
    if (a) {
      used.add(a.id);
      money -= a.cost;
      mins -= a.mins;
    }
    return a;
  };
  const start = pick((a) => a.slot.includes('start') && !a.kind, count, 0.2);
  // Bitiş için bütçeden pay ayır: önce bitişi seç, sonra arayı doldur.
  const end = pick((a) => a.slot.includes('end') && !a.kind, count - 1, 0.6);
  const question = pick((a) => a.kind === 'question', count - 2, 0);
  const photo = pick((a) => a.kind === 'photo' && a.id !== end?.id, count - 3, 0);
  const mids: Act[] = [];
  const midN = count - [start, end, question, photo].filter(Boolean).length;
  for (let i = 0; i < midN; i++) {
    const a = pick((x) => x.slot.includes('mid') && !x.kind, midN - i, 1 / (midN - i));
    if (a) mids.push(a);
  }
  // Sıra: başlangıç, etkinlikler arasına soru ve fotoğraf, bitiş.
  const middle: Act[] = [...mids];
  if (question) middle.splice(Math.min(middle.length, 1), 0, question);
  if (photo) middle.push(photo);
  const steps = [start, ...middle, end].filter((a): a is Act => !!a).map(toStep);
  return { type, dur, budget, start: D.start, steps, total: steps.reduce((s, x) => s + x.c, 0), seed };
}

// Tek adımı değiştir: aynı yerde durabilecek, bütçeye sığan başka bir etkinlik. Yoksa plan aynen döner.
export function swapStep(plan: Plan, index: number, seed: number): Plan {
  const cur = plan.steps[index];
  const src = POOL.find((a) => a.id === cur.id);
  if (!src) return plan;
  const r = rng(seed);
  const used = new Set(plan.steps.map((s) => s.id));
  const room = plan.budget - (plan.total - cur.c);
  const slot: Slot = index === 0 ? 'start' : index === plan.steps.length - 1 ? 'end' : 'mid';
  const cands = shuffle(
    POOL.filter(
      (a) =>
        !used.has(a.id) && fits(a, plan.type, plan.dur) && a.cost <= room && a.kind === src.kind && (a.kind ? true : a.slot.includes(slot)),
    ),
    r,
  );
  // Süresi yakın olan öne.
  const next = cands.sort((x, y) => Math.abs(x.mins - cur.m) - Math.abs(y.mins - cur.m)).slice(0, 4)[
    Math.floor(r() * Math.min(4, cands.length))
  ];
  if (!next) return plan;
  const steps = plan.steps.map((s, i) => (i === index ? toStep(next) : s));
  return { ...plan, steps, total: steps.reduce((s, x) => s + x.c, 0) };
}

export const clock = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
export const stepTimes = (plan: Pick<Plan, 'start' | 'steps'>) => {
  let t = plan.start;
  return plan.steps.map((s) => {
    const at = t;
    t += s.m;
    return at;
  });
};
export const minsLabel = (m: number) =>
  m < 60 ? `${m} dk` : m % 60 === 0 ? `${m / 60} saat` : `${(m / 60).toFixed(1).replace('.', ',')} saat`;
export const costLabel = (c: number) => (c ? `${c.toLocaleString('tr-TR')} TL` : 'ücretsiz');
export const planTitle = (type: DateType, dur: DateDur) => `${DATE_TYPES[type].label} ${DATE_DURS[dur].label.toLocaleLowerCase('tr-TR')}`;
export const planSummary = (plan: Plan) => `${planTitle(plan.type, plan.dur)}: ${plan.steps.map((s) => s.n).join(', ')}`.slice(0, 140);
export function planQuestions(seed: number): string[] {
  return shuffle(QUESTIONS, rng(seed + 17)).slice(0, 5);
}
