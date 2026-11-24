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
  short: { label: '1-2 saat', mins: 110, start: 18 * 60, steps: [4, 4] },
  half: { label: 'Yarım gün', mins: 240, start: 14 * 60, steps: [5, 6] },
  full: { label: 'Tam gün', mins: 480, start: 10 * 60 + 30, steps: [8, 9] },
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
  warm?: true; // sıcak hava işi: kasım-mart arasında çıkmaz
};
// Yaşa göre uygunluk: [en az, en çok]. Çiftin yaş ortalaması aralığın dışındaysa o etkinlik geri plana düşer
// (tamamen yasaklanmaz; seçenek azsa yine çıkabilir). Listede olmayan etkinlik her yaşa uygundur.
const AGE: Record<string, [number, number]> = {
  milkshake: [0, 30],
  atari: [0, 32],
  trambolin: [0, 32],
  fotoavi: [0, 35],
  cesaret: [0, 35],
  vitrin: [0, 35],
  dans: [0, 40],
  scooter: [0, 38],
  paten: [0, 38],
  karaoke: [0, 42],
  lazer: [0, 40],
  kacis: [0, 45],
  macerapark: [0, 42],
  tirmanis: [0, 42],
  gokart: [0, 45],
  atv: [0, 48],
  durum: [0, 40],
  spa: [26, 99],
  sikyemek: [24, 99],
  sahaf: [27, 99],
  corba: [27, 99],
  pazar: [27, 99],
  cay: [24, 99],
  yemekkursu: [24, 99],
};
const ageOff = (id: string, age?: number) => {
  const g = AGE[id];
  return age && g ? age < g[0] || age > g[1] : false;
};
// Doğum tarihlerinden çiftin yaş ortalaması (biri girilmemişse diğeri; ikisi de yoksa undefined).
export function coupleAge(births: (string | undefined | null)[], now: number = Date.now()): number | undefined {
  const ages = births
    .map((b) => (b && /^\d{4}-\d{2}-\d{2}$/.test(b) ? (now - new Date(`${b}T00:00:00`).getTime()) / (365.25 * 86400000) : NaN))
    .filter((a) => a > 10 && a < 100);
  return ages.length ? Math.round(ages.reduce((x, y) => x + y, 0) / ages.length) : undefined;
}
const R: DateType = 'romantik';
const E: DateType = 'eglenceli';
const M: DateType = 'macera';
const S: DateType = 'sakin';

// Her etkinlik yalnızca gerçekten o türe ait olduğu türlerle etiketlenir: "macera" seçilince kahve ya da tatlı çıkmaz.
const POOL: Act[] = [
  // --- başlangıç ---
  { id: 'kahve', name: 'Kahve içmek', mins: 45, cost: 300, types: [R, S], slot: ['start', 'mid'], cat: 'kafe' },
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
  { id: 'firin', name: 'Fırından sıcak poğaça alıp parkta yemek', mins: 35, cost: 150, types: [S, E], slot: ['start'], morn: true },
  { id: 'termos', name: 'Termosa çay koyup yola çıkmak', mins: 20, cost: 50, types: [M], slot: ['start'], morn: true },
  { id: 'rastgele', name: 'Haritada rastgele bir nokta seçip oraya gitmek', mins: 35, cost: 100, types: [M], slot: ['start'] },
  {
    id: 'sondurak',
    name: 'İlk gelen otobüse binip bilmediğiniz bir durakta inmek',
    mins: 40,
    cost: 60,
    types: [M],
    slot: ['start', 'mid'],
  },
  { id: 'scooter', name: 'Scooter kiralayıp tur atmak', mins: 40, cost: 300, types: [M, E], slot: ['start', 'mid'], warm: true },
  { id: 'yazitura', name: 'Yazı turayla yön seçip yürümeye başlamak', mins: 20, cost: 0, types: [E, M], slot: ['start'] },
  { id: 'atistirma', name: 'Markette birbirinize sürpriz atıştırmalık seçmek', mins: 25, cost: 200, types: [E], slot: ['start'] },
  { id: 'milkshake', name: 'Milkshake ya da bubble tea içmek', mins: 30, cost: 350, types: [E], slot: ['start', 'mid'], cat: 'kafe' },
  // --- orta: romantik ve sakin ---
  { id: 'sahil', name: 'Sahilde yürüyüş', mins: 60, cost: 0, types: [R, S], slot: ['mid', 'start'] },
  { id: 'park', name: 'Parkta el ele yürüyüş', mins: 45, cost: 0, types: [R, S], slot: ['mid', 'start'] },
  { id: 'kitapci', name: 'Kitapçıda birbirinize kitap seçmek', mins: 40, cost: 0, types: [S, R], slot: ['mid'] },
  { id: 'sahaf', name: 'Sahaf ve antikacı gezmek', mins: 45, cost: 0, types: [S], slot: ['mid'] },
  { id: 'bank', name: 'Bir bankta oturup sohbet etmek', mins: 30, cost: 0, types: [S], slot: ['mid', 'end'] },
  { id: 'calgi', name: 'Sokak müzisyeni dinlemek', mins: 25, cost: 50, types: [R, E], slot: ['mid'] },
  { id: 'manzara', name: 'Şehrin manzara noktasına çıkmak', mins: 50, cost: 0, types: [R, M], slot: ['mid', 'end'] },
  { id: 'liste', name: 'Birlikte bir hayal listesi yazmak', mins: 30, cost: 0, types: [R, S], slot: ['mid'] },
  { id: 'mektup', name: 'Birbirinize kısa bir not yazıp okumak', mins: 25, cost: 0, types: [R], slot: ['mid'] },
  { id: 'calmalistesi', name: 'Ortak bir çalma listesi hazırlamak', mins: 30, cost: 0, types: [S, E], slot: ['mid'] },
  { id: 'muze', name: 'Müze ya da sergi gezmek', mins: 75, cost: 300, types: [S, R], slot: ['mid'] },
  { id: 'vapur', name: 'Vapur ya da tekne turu', mins: 60, cost: 200, types: [R, S, M], slot: ['mid'] },
  { id: 'atolye', name: 'Seramik ya da resim atölyesi', mins: 120, cost: 1500, types: [R, S], slot: ['mid'], long: true },
  { id: 'spa', name: 'Hamam ya da masaj', mins: 90, cost: 2000, types: [S, R], slot: ['mid'], long: true },
  { id: 'piknik', name: 'Marketten alışveriş yapıp piknik', mins: 90, cost: 400, types: [R, S], slot: ['mid'], long: true, warm: true },
  { id: 'cicek', name: 'Çiçekçiden birbirinize bir dal çiçek seçmek', mins: 20, cost: 200, types: [R], slot: ['mid'] },
  { id: 'at', name: 'At binmek', mins: 45, cost: 900, types: [M, R], slot: ['mid'] },
  // --- orta: eğlenceli ---
  { id: 'pazar', name: 'Semt pazarını gezip meyve almak', mins: 45, cost: 150, types: [E, S], slot: ['mid'] },
  { id: 'vitrin', name: 'Çarşıda birbirinize en komik kıyafeti seçmek', mins: 40, cost: 0, types: [E], slot: ['mid'] },
  { id: 'hediye', name: 'Birbirinize 100 TL’lik sürpriz hediye almak', mins: 40, cost: 200, types: [E, R], slot: ['mid'] },
  { id: 'oyun', name: 'Kutu oyunu ya da tavla oynamak', mins: 45, cost: 0, types: [E, S], slot: ['mid'] },
  { id: 'sinema', name: 'Sinemada film izlemek', mins: 130, cost: 600, types: [E, S, R], slot: ['mid', 'end'], cat: 'sinema', long: true },
  { id: 'bowling', name: 'Bowling oynamak', mins: 60, cost: 700, types: [E], slot: ['mid'], cat: 'eglence' },
  { id: 'atari', name: 'Oyun salonunda kapışmak', mins: 45, cost: 400, types: [E], slot: ['mid'], cat: 'eglence' },
  { id: 'bilardo', name: 'Bilardo ya da langırt oynamak', mins: 45, cost: 300, types: [E], slot: ['mid'], cat: 'eglence' },
  { id: 'karaoke', name: 'Karaokede şarkı söylemek', mins: 60, cost: 600, types: [E], slot: ['mid', 'end'], cat: 'eglence', eve: true },
  { id: 'paten', name: 'Buz pateni ya da paten', mins: 60, cost: 600, types: [E, M], slot: ['mid'] },
  { id: 'ucurtma', name: 'Uçurtma uçurmak', mins: 45, cost: 150, types: [E], slot: ['mid'], warm: true },
  { id: 'trambolin', name: 'Trambolin parkında zıplamak', mins: 60, cost: 700, types: [E, M], slot: ['mid'], cat: 'eglence' },
  { id: 'yemekkursu', name: 'Birlikte yemek atölyesi', mins: 150, cost: 2000, types: [R, E], slot: ['mid'], long: true },
  { id: 'tatli', name: 'Tatlı yemek', mins: 40, cost: 350, types: [R, S, E], slot: ['mid', 'end'], cat: 'tatli' },
  { id: 'dondurma', name: 'Dondurma alıp yürümek', mins: 30, cost: 200, types: [E, R, S], slot: ['mid', 'end'], cat: 'tatli', warm: true },
  // --- orta: macera ---
  { id: 'eskisokak', name: 'Eski sokaklarda kaybolmak', mins: 60, cost: 0, types: [M, R], slot: ['mid'] },
  { id: 'kesif', name: 'Haritasız keşif: her köşede yazı turayla yön seçmek', mins: 45, cost: 0, types: [M, E], slot: ['mid'] },
  { id: 'tepe', name: 'Yakındaki bir tepeye tırmanmak', mins: 60, cost: 0, types: [M], slot: ['mid'] },
  { id: 'ilk', name: 'İkinizin de hiç yapmadığı bir şeyi denemek', mins: 45, cost: 300, types: [M], slot: ['mid'] },
  { id: 'bisiklet', name: 'Bisiklet kiralayıp tur atmak', mins: 75, cost: 300, types: [M, E], slot: ['mid'], warm: true },
  { id: 'okculuk', name: 'Okçuluk denemek', mins: 45, cost: 500, types: [M, E], slot: ['mid'] },
  { id: 'kano', name: 'Kano ya da deniz bisikleti', mins: 60, cost: 600, types: [M], slot: ['mid'], warm: true },
  { id: 'tirmanis', name: 'Tırmanış duvarı denemek', mins: 75, cost: 800, types: [M], slot: ['mid'] },
  { id: 'macerapark', name: 'Macera parkında ip parkuru', mins: 90, cost: 800, types: [M], slot: ['mid'] },
  { id: 'lazer', name: 'Lazer tag ya da paintball', mins: 60, cost: 900, types: [M, E], slot: ['mid'], cat: 'eglence' },
  { id: 'kacis', name: 'Kaçış odası', mins: 75, cost: 1200, types: [E, M], slot: ['mid'], cat: 'eglence' },
  { id: 'gokart', name: 'Go-kart yarışı', mins: 45, cost: 1200, types: [M, E], slot: ['mid'], cat: 'eglence' },
  { id: 'atv', name: 'ATV turu', mins: 60, cost: 1500, types: [M], slot: ['mid'] },
  { id: 'doga', name: 'Doğa yürüyüşü', mins: 120, cost: 0, types: [M], slot: ['mid'], long: true },
  { id: 'yenisemt', name: 'Hiç gitmediğiniz bir semti keşfetmek', mins: 90, cost: 150, types: [M], slot: ['mid'], long: true },
  { id: 'yakinkasaba', name: 'Yakın bir kasabaya kısa yolculuk', mins: 150, cost: 500, types: [M, R], slot: ['mid'], long: true },
  { id: 'sokak', name: 'Sokak lezzetleri turu', mins: 60, cost: 500, types: [E, M], slot: ['mid', 'end'] },
  // --- soru ve fotoğraf (her planda birer tane, türe göre) ---
  { id: 'soru', name: 'Birbirinize 5 soru sorun', mins: 30, cost: 0, types: [R, S], slot: ['mid'], kind: 'question' },
  { id: 'cesaret', name: 'Doğruluk mu cesaret mi: 5 tur', mins: 30, cost: 0, types: [M, E], slot: ['mid'], kind: 'question' },
  { id: 'foto', name: 'Birlikte fotoğraf çekmek', mins: 20, cost: 0, types: [R, S], slot: ['mid'], kind: 'photo' },
  { id: 'gunbatimi', name: 'Gün batımında fotoğraf', mins: 30, cost: 0, types: [R, S], slot: ['mid', 'end'], kind: 'photo' },
  { id: 'fotoavi', name: 'Fotoğraf avı: 5 komik kare', mins: 30, cost: 0, types: [E], slot: ['mid'], kind: 'photo' },
  { id: 'zirve', name: 'Vardığınız yerde zafer fotoğrafı', mins: 15, cost: 0, types: [M], slot: ['mid'], kind: 'photo' },
  // --- bitiş ---
  { id: 'yemek', name: 'Akşam yemeği', mins: 90, cost: 1300, types: [R, S, E], slot: ['end'], cat: 'restoran' },
  { id: 'sikyemek', name: 'Şık bir restoranda akşam yemeği', mins: 110, cost: 2600, types: [R], slot: ['end'], cat: 'restoran', eve: true },
  { id: 'yenimutfak', name: 'Hiç denemediğiniz bir mutfaktan yemek', mins: 75, cost: 1100, types: [M, E], slot: ['end'], cat: 'restoran' },
  { id: 'durum', name: 'Dürüm ya da tost yiyip yürümek', mins: 35, cost: 350, types: [E, M], slot: ['end', 'mid'] },
  { id: 'balik', name: 'Sahilde balık ekmek', mins: 40, cost: 400, types: [M, E, R], slot: ['end', 'mid'], warm: true },
  { id: 'ates', name: 'Ateş yakıp mangal yapmak', mins: 90, cost: 500, types: [M], slot: ['end'], long: true, warm: true },
  { id: 'evyemek', name: 'Evde birlikte yemek yapmak', mins: 90, cost: 450, types: [R, S], slot: ['end'] },
  { id: 'corba', name: 'Sıcak bir çorba içip eve yürümek', mins: 40, cost: 300, types: [S], slot: ['end'] },
  { id: 'evfilm', name: 'Evde film gecesi ve patlamış mısır', mins: 120, cost: 150, types: [S, R], slot: ['end'], long: true, eve: true },
  { id: 'yildiz', name: 'Yıldızları izlemek', mins: 40, cost: 0, types: [R, M, S], slot: ['end'], eve: true, warm: true },
  { id: 'sahilcay', name: 'Sahilde çay içip sohbet', mins: 45, cost: 150, types: [R, S], slot: ['end', 'mid'] },
  { id: 'canli', name: 'Canlı müzik dinlemek', mins: 90, cost: 900, types: [E, R], slot: ['end'], cat: 'eglence', eve: true },
  { id: 'gecesurus', name: 'Gece şehir ışıklarını izlemek', mins: 45, cost: 100, types: [M, R], slot: ['end'], eve: true },
  { id: 'dans', name: 'Sevdiğiniz şarkıda sokakta dans etmek', mins: 15, cost: 0, types: [E, R], slot: ['end'] },
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
// Kasım-mart: açık havada üşüten işler (kano, piknik, dondurma…) çıkmaz.
const isCold = (now: number) => [10, 11, 0, 1, 2].includes(new Date(now).getMonth());
let cold = isCold(Date.now());
const fits = (a: Act, type: DateType, dur: DateDur) =>
  a.types.includes(type) && (dur !== 'short' || !a.long) && (dur === 'full' || !a.morn) && (dur !== 'half' || !a.eve) && !(cold && a.warm);

// avoid: az önce gösterilen planların adımları ("Başka plan oluştur" gerçekten başka plan versin diye geri plana itilir).
// age: çiftin yaş ortalaması; yaşa uymayan etkinlikler geri plana düşer.
export type PlanOpts = { avoid?: string[]; age?: number };
export function makePlan(type: DateType, dur: DateDur, budget: number, seed: number, now: number = Date.now(), opts: PlanOpts = {}): Plan {
  const avoid = new Set(opts.avoid ?? []);
  cold = isCold(now);
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
    const score = (a: Act) =>
      Math.abs(a.mins - share) / share +
      (0.6 * Math.abs(a.cost - target)) / Math.max(target, 150) +
      r() * 0.6 +
      (avoid.has(a.id) ? 6 : 0) +
      (ageOff(a.id, opts.age) ? 2.5 : 0);
    const a = cands.map((x) => [score(x), x] as const).sort((x, y) => x[0] - y[0])[0]?.[1] ?? null;
    if (a) {
      used.add(a.id);
      money -= a.cost;
      mins -= a.mins;
    }
    return a;
  };
  // Önce günün ana etkinliği seçilir (türün kendisi: macerada go-kart, sakinde müze…) ve bütçenin yarısı ona ayrılır;
  // sonra bitiş, soru ve fotoğraf. Kısa planda ayrı bir başlangıç adımı yoktur, doğrudan etkinlikle başlar.
  const main = pick((a) => a.slot.includes('mid') && !a.kind, 2.5, 0.5);
  const end = pick((a) => a.slot.includes('end') && !a.kind, count - 1, 0.6);
  const question = pick((a) => a.kind === 'question', count - 2, 0);
  const photo = pick((a) => a.kind === 'photo', count - 3, 0);
  const start = dur === 'short' ? null : pick((a) => a.slot.includes('start') && !a.kind, count - 4, 0.3);
  const mids: Act[] = main ? [main] : [];
  const midN = count - [start, end, question, photo, main].filter(Boolean).length;
  for (let i = 0; i < midN; i++) {
    const a = pick((x) => x.slot.includes('mid') && !x.kind, midN - i, 1 / (midN - i));
    if (a) mids.push(a);
  }
  // Sıra: başlangıç, ana etkinlik, soru, diğer etkinlikler, fotoğraf, bitiş.
  const middle: Act[] = [...mids];
  if (question) middle.splice(Math.min(middle.length, 1), 0, question);
  if (photo) middle.push(photo);
  const steps = [start, ...middle, end].filter((a): a is Act => !!a).map(toStep);
  return { type, dur, budget, start: D.start, steps, total: steps.reduce((s, x) => s + x.c, 0), seed };
}

// Tek adımı değiştir: aynı yerde durabilecek, bütçeye sığan başka bir etkinlik. Yoksa plan aynen döner.
export function swapStep(plan: Plan, index: number, seed: number, age?: number): Plan {
  const cur = plan.steps[index];
  const src = POOL.find((a) => a.id === cur.id);
  if (!src) return plan;
  const r = rng(seed);
  const used = new Set(plan.steps.map((s) => s.id));
  const room = plan.budget - (plan.total - cur.c);
  const slot: Slot = index === 0 ? 'start' : index === plan.steps.length - 1 ? 'end' : 'mid';
  const all = shuffle(
    POOL.filter(
      (a) =>
        !used.has(a.id) && fits(a, plan.type, plan.dur) && a.cost <= room && a.kind === src.kind && (a.kind ? true : a.slot.includes(slot)),
    ),
    r,
  );
  // Yaşa uyanlar varsa yalnız onlar.
  const fitAge = all.filter((a) => !ageOff(a.id, age));
  const cands = fitAge.length ? fitAge : all;
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
