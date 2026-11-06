export type ThemeId = 'standart' | 'agir' | 'asko';

type Colors = {
  bg: string;
  card: string;
  text: string;
  muted: string;
  border: string;
  primary: string;
  primarySoft: string;
  onPrimary: string;
  onPrimarySoft: string;
  success: string;
  successSoft: string;
  tabBar: string;
};

type Copy = {
  hello: (name: string) => string;
  dateLine: (date: string, partner: string) => string;
  streak: string;
  points: string;
  sharedLabel: string;
  sharedHint: string;
  accept: string;
  decline: string;
  waiting: (partner: string) => string;
  sharedTask: string;
  myTask: string;
  partnerTask: string;
  selfieSoon: string;
  notePlaceholder: string;
  noteRequired: string;
  complete: string;
  completed: string;
  partnerDone: (p: string) => string;
  partnerNotDone: (p: string) => string;
  reward: (n: number) => string;
  surpriseTitle: string;
  surpriseHint: string;
  surpriseLabel: string;
  surpriseBtn: string;
  surpriseAgain: string;
  tabs: { today: string; chat: string; album: string; coupons: string; us: string };
  date: {
    today: string;
    selfieHint: string;
    weAreOnDate: string;
    plan: string;
    partnerSaysToday: (p: string) => string;
    confirmToday: string;
    partnerPlanned: (p: string, day: string) => string;
    confirm: string;
    waiting: (p: string) => string;
    upcoming: string;
    pickDay: string;
    cancel: string;
  };
};

export type Theme = {
  id: ThemeId;
  name: string;
  tagline: string;
  colors: Colors;
  fonts: {
    title: string; // büyük başlıklar
    display: string; // görev başlıkları
    note: string; // el yazısı notlar (albümle aynı kalsın diye her temada Caveat)
    body?: string; // undefined = sistem fontu
    button?: string;
  };
  radius: { card: number; button: number; pill: number };
  upper: boolean; // başlık ve butonlar büyük harf mi
  accentBar: boolean; // kartın solunda renkli şerit
  titleSize: number;
  displaySize: number;
  copy: Copy;
};

const standart: Theme = {
  id: 'standart',
  name: 'Standart',
  tagline: 'Sade, sıcak, el yazısı dokunuşlu',
  colors: {
    bg: '#FFF8F3',
    card: '#FFFFFF',
    text: '#2B1D22',
    muted: '#8A7479',
    border: '#F0E2DC',
    primary: '#E8516A',
    primarySoft: '#FDE7EA',
    onPrimary: '#FFFFFF',
    onPrimarySoft: '#E8516A',
    success: '#2E8B6A',
    successSoft: '#E3F4EC',
    tabBar: '#FFFFFF',
  },
  fonts: { title: 'Caveat_700Bold', display: 'Caveat_700Bold', note: 'Caveat_500Medium' },
  radius: { card: 16, button: 26, pill: 10 },
  upper: false,
  accentBar: false,
  titleSize: 38,
  displaySize: 30,
  copy: {
    hello: (n) => `Merhaba ${n}`,
    dateLine: (d, p) => `${d} · ${p} ile`,
    streak: 'gün seri',
    points: 'puan',
    sharedLabel: 'Bugünün ortak görevi',
    sharedHint: 'Bunu birlikte yapmak ister misin? Biriniz istemezse ikinize de ayrı görev gelir.',
    accept: 'Birlikte yapalım',
    decline: 'Başka görev istiyorum',
    waiting: (p) => `Sen hazırsın. ${p} cevap verince görev başlayacak.`,
    sharedTask: 'Ortak görev',
    myTask: 'Senin görevin',
    partnerTask: 'Partnerinin görevi',
    selfieSoon: 'Selfie çekimi bir sonraki güncellemede burada olacak.',
    notePlaceholder: 'Bugünden küçük bir not...',
    noteRequired: 'Bugüne küçük bir not bırak.',
    complete: 'Görevi tamamla',
    completed: 'Tamamladın',
    partnerDone: (p) => `${p} görevini tamamladı`,
    partnerNotDone: (p) => `${p} henüz tamamlamadı`,
    reward: (n) => `Bugünü birlikte tamamladınız! +${n} puan`,
    surpriseTitle: 'Bonus görev',
    surpriseHint: 'Bugün bir anı daha biriktirmek isterseniz ekstra bir görev çekin.',
    surpriseLabel: 'Bonus görev',
    surpriseBtn: 'Bonus görev çek',
    surpriseAgain: 'Başka bir tane',
    tabs: { today: 'Bugün', chat: 'Mesajlar', album: 'Albüm', coupons: 'Kuponlar', us: 'İkimiz' },
    date: {
      today: 'Bugün date günü!',
      selfieHint: 'İkinizin aynı karede olduğu bir selfie çekin, albüme özel bir sayfa olarak girecek.',
      weAreOnDate: "Bugün date'teyiz",
      plan: 'Date planla',
      partnerSaysToday: (p) => `${p} bugün date'te olduğunuzu söylüyor.`,
      confirmToday: 'Evet, birlikteyiz',
      partnerPlanned: (p, d) => `${p} ${d} için date planladı.`,
      confirm: 'Onayla',
      waiting: (p) => `${p} onaylayınca date günü kesinleşecek.`,
      upcoming: "Planlanan date'ler",
      pickDay: 'Hangi gün?',
      cancel: 'Vazgeç',
    },
  },
};

const agir: Theme = {
  id: 'agir',
  name: 'Ağır Abi',
  tagline: 'Koyu, net, lafı dolandırmaz',
  colors: {
    bg: '#15171A',
    card: '#202328',
    text: '#EDEDED',
    muted: '#8C8F94',
    border: '#33363B',
    primary: '#D4A24C',
    primarySoft: '#2A2C31',
    onPrimary: '#15171A',
    onPrimarySoft: '#EDEDED',
    success: '#7BC79A',
    successSoft: '#1F2B24',
    tabBar: '#1C1E22',
  },
  fonts: {
    title: 'Oswald_500Medium',
    display: 'Oswald_500Medium',
    note: 'Caveat_500Medium',
    button: 'Oswald_500Medium',
  },
  radius: { card: 2, button: 2, pill: 0 },
  upper: true,
  accentBar: true,
  titleSize: 30,
  displaySize: 22,
  copy: {
    hello: () => 'Selam reis',
    dateLine: (d, p) => `${d} · ${p} ile`,
    streak: 'gün seri. bozma.',
    points: 'puan',
    sharedLabel: 'Bugünün işi',
    sharedHint: 'Lafı dolandırma. Ya yaparsınız ya da ikinize ayrı iş çıkar.',
    accept: 'Yaparız',
    decline: 'Başka iş ver',
    waiting: (p) => `Sen tamamsın. ${p} cevap verecek.`,
    sharedTask: 'Ortak iş',
    myTask: 'Senin işin',
    partnerTask: 'Onun işi',
    selfieSoon: 'Selfie kısmı bir sonraki güncellemede.',
    notePlaceholder: 'Kısa bir not düş',
    noteRequired: 'Bir iki kelime yaz, yeter.',
    complete: 'İş tamam',
    completed: 'Halledildi',
    partnerDone: (p) => `${p} işini bitirdi`,
    partnerNotDone: (p) => `${p} daha bitirmedi`,
    reward: (n) => `Günü kapattınız. +${n} puan`,
    surpriseTitle: 'Ekstra iş',
    surpriseHint: 'Günün işi bitti mi? Bir tane daha çek.',
    surpriseLabel: 'Ekstra iş',
    surpriseBtn: 'Ekstra iş çek',
    surpriseAgain: 'Başkası',
    tabs: { today: 'Bugün', chat: 'Telsiz', album: 'Arşiv', coupons: 'Fişler', us: 'Ekip' },
    date: {
      today: 'Bugün date var',
      selfieHint: 'Aynı karede bir selfie. Albüme özel sayfa olarak girer.',
      weAreOnDate: "Date'teyiz",
      plan: 'Date ayarla',
      partnerSaysToday: (p) => `${p}: bugün date var.`,
      confirmToday: 'Doğru',
      partnerPlanned: (p, d) => `${p} ${d} için date ayarladı.`,
      confirm: 'Tamam',
      waiting: (p) => `${p} onaylayınca kesinleşir.`,
      upcoming: 'Ayarlanan date\'ler',
      pickDay: 'Hangi gün?',
      cancel: 'İptal',
    },
  },
};

const asko: Theme = {
  id: 'asko',
  name: 'Aşko Kuşko',
  tagline: 'Pembe, yumuşacık, bol kalpli',
  colors: {
    bg: '#FFE6F1',
    card: '#FFFFFF',
    text: '#5A1E43',
    muted: '#B0628E',
    border: '#FFC2DD',
    primary: '#FF4F9A',
    primarySoft: '#FFE6F1',
    onPrimary: '#FFFFFF',
    onPrimarySoft: '#FF4F9A',
    success: '#E0457F',
    successSoft: '#FFF0F6',
    tabBar: '#FFFFFF',
  },
  fonts: {
    title: 'Baloo2_700Bold',
    display: 'Baloo2_700Bold',
    note: 'Caveat_500Medium',
    body: 'Baloo2_500Medium',
    button: 'Baloo2_700Bold',
  },
  radius: { card: 24, button: 22, pill: 14 },
  upper: false,
  accentBar: false,
  titleSize: 30,
  displaySize: 22,
  copy: {
    hello: () => 'Günaydın bal böceğim',
    dateLine: (d, p) => `${d} · ${p}'cığınla`,
    streak: 'günlük aşk',
    points: 'öpücük puanı',
    sharedLabel: 'Bugünün tatlı görevi',
    sharedHint: 'Birlikte yapalım mı? Biriniz istemezse ikinize de ayrı tatlı görevler gelir.',
    accept: 'Hı hı, yapalım',
    decline: 'Başka bir şey olsun',
    waiting: (p) => `Sen hazırsın tatlım, ${p} birazdan cevap verir.`,
    sharedTask: 'Ortak tatlı görev',
    myTask: 'Senin tatlı görevin',
    partnerTask: 'Sevgilinin görevi',
    selfieSoon: 'Selfie köşesi çok yakında burada olacak.',
    notePlaceholder: 'Kalbinden geçenleri yaz...',
    noteRequired: 'Minicik bir not bırak, olur mu?',
    complete: 'Yaptım!',
    completed: 'Yaptın, aferin sana',
    partnerDone: (p) => `${p} da yaptı, ay ne tatlı`,
    partnerNotDone: (p) => `${p} henüz yapmadı`,
    reward: (n) => `İkiniz de yaptınız! +${n} öpücük puanı`,
    surpriseTitle: 'Tatlı bonus',
    surpriseHint: 'Bir tatlı görev daha çekelim mi?',
    surpriseLabel: 'Tatlı bonus',
    surpriseBtn: 'Bonus çek',
    surpriseAgain: 'Bir tane daha',
    tabs: { today: 'Bugün', chat: 'Fısıltı', album: 'Anılar', coupons: 'Kuponlar', us: 'İkimiz' },
    date: {
      today: 'Bugün date günümüz!',
      selfieHint: 'Yanak yanağa bir selfie çekin, albümde kocaman özel bir sayfa olacak.',
      weAreOnDate: "Şu an date'teyiz",
      plan: 'Date planlayalım',
      partnerSaysToday: (p) => `${p} bugün date'te olduğunuzu söylüyor, ay ne tatlı.`,
      confirmToday: 'Evet evet!',
      partnerPlanned: (p, d) => `${p} ${d} için date planladı, kabul mü?`,
      confirm: 'Hı hı, olur',
      waiting: (p) => `${p} onaylayınca date günümüz kesinleşecek.`,
      upcoming: "Tatlı date'lerimiz",
      pickDay: 'Hangi gün tatlım?',
      cancel: 'Vazgeçtim',
    },
  },
};

export const THEMES: Record<ThemeId, Theme> = { standart, agir, asko };
export const THEME_LIST: Theme[] = [standart, agir, asko];

export function getTheme(id: string | undefined | null): Theme {
  return THEMES[(id as ThemeId) ?? 'standart'] ?? standart;
}

// Yazıyı temaya göre büyük harfe çevirir (Türkçe İ/ı kurallarıyla).
export function tx(theme: Theme, s: string): string {
  return theme.upper ? s.toLocaleUpperCase('tr-TR') : s;
}
