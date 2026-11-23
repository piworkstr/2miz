import { collection, doc, increment, onSnapshot, runTransaction } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from './firebase';
import { dayKey } from './date';
import { BONUS_ITEMS, BONUS_MAX, bonusText, type FarmBonus } from './farmBonus';
import { srvNow } from './serverClock';
import type { Couple } from './session';

// Bizim Çiftlik: çiftin ortak çiftliği (2.5D). Amaç: birlikte emek vermek ve emeğin meyvesini birlikte görmek.
// Tarla ekilir, ürün gerçek zamanla büyür; hasat depoya gider, depo satılınca altın olur.
// Ortaklık: birinin ektiğini diğeri sularsa kalan süre yarıya iner ve o hasat "ortak hasat" sayılır.
// Büyük ürünlerin (gül, ayçiçeği, bal kabağı) hasadı iki kişilik sahnedir: Hasat günü.
// Hafta sonu pazar: tezgâhı ikiniz kurarsanız depo bir buçuk katına gider.
// Mevsim gerçek takvimi izler: baharda ekinler biraz hızlı büyür (kış artık yavaşlatmaz).
// Arazi 10x10; kapalı parseller parayla değil ortak hasat sayısıyla açılır (her 10 ortak hasatta bir parsel).

export const N = 28; // arazi 28x28: ortadaki 10x10 başlangıç çiftliği, çevresi parayla alınan yabani arazi (v4'te 22x22, v3'te 14x14'tü)
export const INNER = 10;
export const OFF = (N - INNER) / 2;
export const MIN = 60_000;
export const TILL = 10;
// Patika taşı: bir kare çimene yol döşemenin bedeli.
export const PAVE = 5;
// Çit ya da duvarın dibine çiçek ekmenin bedeli (kare başına).
export const BLOOM = 10;
export const HARVESTS_PER_PARCEL = 10;
export const MARKET_BONUS = 1.5;

export type CropId =
  | 'bugday'
  | 'havuc'
  | 'domates'
  | 'misir'
  | 'gul'
  | 'cilek'
  | 'aycicegi'
  | 'kabak'
  | 'pamuk'
  | 'patates'
  | 'sogan'
  | 'kavun'
  | 'karpuz'
  | 'sekerkamisi'
  | 'yulaf'
  | 'kahve'
  | 'nane';
export type AnimalId = 'tavuk' | 'koyun' | 'inek' | 'ari' | 'keci';
export type TreeId = 'elma' | 'kiraz' | 'armut' | 'zeytin' | 'avokado' | 'kakao' | 'limon' | 'hcevizi';
export type BuildingId = 'kumes' | 'agil' | 'kovan';
export type DecorId =
  | 'gulcali'
  | 'lavanta'
  | 'kusevi'
  | 'cam'
  | 'kusbanyo'
  | 'korkuluk'
  | 'elarabasi'
  | 'kulube'
  | 'piknikmasa'
  | 'sogut'
  | 'kampatesi'
  | 'hamak'
  | 'kalpcali'
  | 'kemer'
  | 'traktor'
  | 'kalpheykel'
  | 'asci'
  | 'firin'
  | 'yag'
  | 'meyvesuyu'
  | 'tatli'
  | 'cikolataci'
  | 'kahveci'
  | 'mandira'
  | 'atolye'
  | 'konserve'
  | 'posta'
  | 'lamba'
  | 'kopru'
  | 'golet'
  | 'salincak'
  | 'cardak'
  | 'sera'
  | 'degirmen'
  | 'cicek'
  | 'cit'
  | 'duvar'
  | 'citc'
  | 'duvarc'
  | 'saman'
  | 'agac'
  | 'bank'
  | 'kuyu'
  | 'cesme';

// Denge (Kasım 2026): seviye ilerledikçe süre uzar, en uzunu 7 saattir; kimse bir ürün için bir gün beklemez.
// Ekinler 10 dk – 7 saat, hayvanlar 1,5 – 4 saat, ağaçlar 1,5 – 4 saat, atölyeler 5 dk – 3 saat.
// Açılış sırası 1–16 arasına yayılmıştır (her seviyede en fazla bir iki yenilik), 17–35 yol haritasıyla sürer:
// 1 buğday, havuç · 2 domates, kümes, değirmen, fırın · 3 mısır, aşçı mutfağı, elma · 4 ağıl/koyun, gül · 5 çilek, mandıra
// 6 inek, kek, kiraz · 7 reçel atölyesi · 8 ayçiçeği · 9 kovan, dikiş atölyesi · 10 ballı süt · 11 armut · 12 bal kabağı
// 13 kurabiye · 14 kazak · 15 yağ fabrikası · 17 pamuk · 19 zeytin · 21 patates · 23 soğan · 24 avokado · 25 kavun, meyve suyu,
// tatlı atölyesi · 28 karpuz · 35 yaş pasta, piknik sepeti · 36–60: her seviyede bir yenilik (bkz. CROPS, TREES, RECIPES)
export const CROPS: Record<CropId, { name: string; cost: number; mins: number; sell: number; xp: number; lvl: number; big?: true }> = {
  bugday: { name: 'Buğday', cost: 2, mins: 10, sell: 5, xp: 1, lvl: 1 },
  havuc: { name: 'Havuç', cost: 5, mins: 30, sell: 15, xp: 3, lvl: 1 },
  domates: { name: 'Domates', cost: 8, mins: 60, sell: 28, xp: 7, lvl: 2 },
  misir: { name: 'Mısır', cost: 12, mins: 120, sell: 54, xp: 14, lvl: 3 },
  gul: { name: 'Aşk gülü', cost: 30, mins: 180, sell: 110, xp: 30, lvl: 4, big: true },
  cilek: { name: 'Çilek', cost: 20, mins: 180, sell: 86, xp: 22, lvl: 5 },
  aycicegi: { name: 'Ayçiçeği', cost: 25, mins: 240, sell: 115, xp: 32, lvl: 8, big: true },
  kabak: { name: 'Bal kabağı', cost: 40, mins: 300, sell: 155, xp: 42, lvl: 12, big: true },
  // 17–28. seviye: her yeni ürün eskilerle birleşip yeni tarifler açar (RECIPES). Aradaki seviyeler üretimi geliştirir.
  pamuk: { name: 'Pamuk', cost: 45, mins: 240, sell: 150, xp: 34, lvl: 17 },
  patates: { name: 'Patates', cost: 55, mins: 300, sell: 185, xp: 45, lvl: 21 },
  sogan: { name: 'Soğan', cost: 60, mins: 330, sell: 205, xp: 52, lvl: 23 },
  kavun: { name: 'Kavun', cost: 70, mins: 360, sell: 240, xp: 60, lvl: 25 },
  karpuz: { name: 'Karpuz', cost: 80, mins: 420, sell: 280, xp: 74, lvl: 28 },
  // 36–60. seviye: her seviyede bir yenilik. Yeni ekinler mevcut atölyelerin yeni ürünlerine ve iki yeni atölyeye girer.
  sekerkamisi: { name: 'Şeker kamışı', cost: 90, mins: 360, sell: 300, xp: 78, lvl: 39 },
  yulaf: { name: 'Yulaf', cost: 95, mins: 300, sell: 290, xp: 72, lvl: 46 },
  kahve: { name: 'Kahve', cost: 110, mins: 420, sell: 360, xp: 90, lvl: 48 },
  nane: { name: 'Nane', cost: 100, mins: 240, sell: 300, xp: 70, lvl: 55 },
};

// Hayvanlar çayıra (çimene) konur, tarlaya değil. Her hayvan gerçekte verdiği ürünleri verir:
// koyun yün ve süt, inek süt, tavuk yumurta, arı bal. products[0] rozet ve ana üründür.
export const PRODUCTS: Record<string, { name: string; sell: number; art: string }> = {
  egg: { name: 'Yumurta', sell: 15, art: 'egg' },
  wool: { name: 'Yün', sell: 35, art: 'wool' },
  milk: { name: 'Süt', sell: 45, art: 'milk' },
  honey: { name: 'Bal', sell: 80, art: 'honey' },
  gmilk: { name: 'Keçi sütü', sell: 90, art: 'gmilk' },
};
export const ANIMALS: Record<
  AnimalId,
  { name: string; products: string[]; cost: number; mins: number; xp: number; lvl: number; w: number }
> = {
  tavuk: { name: 'Tavuk', products: ['egg'], cost: 60, mins: 90, xp: 3, lvl: 2, w: 0.6 },
  koyun: { name: 'Koyun', products: ['wool', 'milk'], cost: 150, mins: 150, xp: 5, lvl: 4, w: 0.78 },
  inek: { name: 'İnek', products: ['milk', 'milk'], cost: 200, mins: 180, xp: 6, lvl: 6, w: 0.95 },
  ari: { name: 'Arı kovanı', products: ['honey'], cost: 300, mins: 240, xp: 8, lvl: 9, w: 0.72 },
  keci: { name: 'Keçi', products: ['gmilk', 'gmilk'], cost: 900, mins: 210, xp: 10, lvl: 57, w: 0.8 },
};
export const productNames = (a: AnimalId) =>
  [...new Set(ANIMALS[a].products)]
    .map((k) => {
      const n = ANIMALS[a].products.filter((x) => x === k).length;
      return `${n > 1 ? `${n} ` : ''}${PRODUCTS[k].name.toLocaleLowerCase('tr-TR')}`;
    })
    .join(' ve ');
export const productValue = (a: AnimalId) => ANIMALS[a].products.reduce((s, k) => s + PRODUCTS[k].sell, 0);

// ---------- Mutfak: tarifler ----------
// Depodaki ürünlerden yapılır, anında hazır olur. Ham hâlinden yaklaşık bir buçuk kat değerlidir;
// hediye sepetleri de bunlardan hazırlanır.
export type RecipeId =
  | 'ekmek'
  | 'omlet'
  | 'peynir'
  | 'kek'
  | 'recel'
  | 'ballisut'
  | 'tereyagi'
  | 'atki'
  | 'kazak'
  | 'kumas'
  | 'canta'
  | 'kurabiye'
  | 'patomlet'
  | 'pure'
  | 'menemen'
  | 'tursu'
  | 'kavunsuyu'
  | 'kavuntatli'
  | 'karpuzsuyu'
  | 'meyvetabagi'
  | 'yaspasta'
  | 'pikniksepeti'
  | 'bugdayunu'
  | 'misirunu'
  | 'misirekmegi'
  | 'aycicekyagi'
  | 'zeytinyagi'
  | 'avokadoyagi'
  | 'kirazrecel'
  | 'elmasuyu'
  | 'yogurt'
  | 'seker'
  | 'armutrecel'
  | 'krema'
  | 'cilekdondurma'
  | 'sutlucikolata'
  | 'cilekcikolata'
  | 'yulafezmesi'
  | 'granola'
  | 'filtrekahve'
  | 'latte'
  | 'mocha'
  | 'limonata'
  | 'limonmarmelat'
  | 'nanecayi'
  | 'nanelimonata'
  | 'kecipeyniri'
  | 'hceviziyagi'
  | 'sevgilikutusu';
// Üretim yeri: hepsi dükkândan alınıp çiftliğe konan atölyelerdir. 'mutfak' yalnızca eski kayıtlardaki yarım işler için durur.
export type Station =
  'mutfak' | 'mandira' | 'atolye' | 'konserve' | 'degirmen' | 'firin' | 'yag' | 'meyvesuyu' | 'tatli' | 'asci' | 'cikolataci' | 'kahveci';
export const RECIPES: Record<
  RecipeId,
  {
    name: string;
    emoji: string;
    needs: Record<string, number>;
    sell: number;
    xp: number;
    lvl: number;
    mins: number;
    at?: Station;
    alt?: Station;
  }
> = {
  // mins: üretim süresi. Üretim anında değildir: işe konur, süre dolunca mutfaktan toplanır.
  // Un zinciri: buğday → değirmende un → fırında ekmek. Fırın ve değirmen 2. seviyede, ucuz.
  bugdayunu: { name: 'Buğday unu', emoji: '🌾', needs: { bugday: 3 }, sell: 22, xp: 2, lvl: 2, mins: 5, at: 'degirmen' },
  misirunu: { name: 'Mısır unu', emoji: '🌽', needs: { misir: 2 }, sell: 135, xp: 6, lvl: 4, mins: 15, at: 'degirmen' },
  ekmek: { name: 'Ekmek', emoji: '🍞', needs: { bugdayunu: 1 }, sell: 30, xp: 4, lvl: 2, mins: 15, at: 'firin' },
  misirekmegi: { name: 'Mısır ekmeği', emoji: '🍞', needs: { misirunu: 1, milk: 1 }, sell: 240, xp: 12, lvl: 5, mins: 40, at: 'firin' },
  // Yağ fabrikası (20): ayçiçeği tarladan, zeytin ve avokado ağaçtan gelir.
  aycicekyagi: { name: 'Ayçiçek yağı', emoji: '🌻', needs: { aycicegi: 2 }, sell: 300, xp: 16, lvl: 15, mins: 60, at: 'yag' },
  zeytinyagi: { name: 'Zeytinyağı', emoji: '🫒', needs: { zeytin: 3 }, sell: 430, xp: 22, lvl: 19, mins: 90, at: 'yag' },
  avokadoyagi: { name: 'Avokado yağı', emoji: '🥑', needs: { avokado: 3 }, sell: 590, xp: 28, lvl: 24, mins: 120, at: 'yag' },
  // Evde mutfak yoktur: yemekler aşçı mutfağında, kek fırında, reçel reçel atölyesinde, ballı süt mandırada yapılır.
  omlet: { name: 'Omlet', emoji: '🍳', needs: { egg: 2, domates: 1 }, sell: 90, xp: 8, lvl: 3, mins: 30, at: 'asci' },
  // Süt ürünleri mandırada, yün işleri dikiş atölyesinde yapılır (at). Yeri çiftlikte yoksa o tarif görünmez.
  peynir: { name: 'Peynir', emoji: '🧀', needs: { milk: 2 }, sell: 135, xp: 10, lvl: 5, mins: 90, at: 'mandira' },
  tereyagi: { name: 'Tereyağı', emoji: '🧈', needs: { milk: 1 }, sell: 80, xp: 7, lvl: 5, mins: 30, at: 'mandira' },
  atki: { name: 'Atkı', emoji: '🧣', needs: { wool: 2 }, sell: 125, xp: 10, lvl: 9, mins: 90, at: 'atolye' },
  kazak: { name: 'Kazak', emoji: '🧶', needs: { wool: 4 }, sell: 270, xp: 18, lvl: 14, mins: 150, at: 'atolye' },
  kek: { name: 'Kek', emoji: '🍰', needs: { egg: 2, milk: 1, bugdayunu: 1 }, sell: 140, xp: 14, lvl: 6, mins: 60, at: 'firin' },
  // alt: o atölye çiftlikteyse tarif oraya taşınır (mutfakta yer açılır); yoksa mutfakta yapılır.
  recel: { name: 'Çilek reçeli', emoji: '🍓', needs: { cilek: 3 }, sell: 350, xp: 16, lvl: 7, mins: 120, at: 'konserve' },
  ballisut: { name: 'Ballı süt', emoji: '🥛', needs: { honey: 1, milk: 1 }, sell: 190, xp: 18, lvl: 10, mins: 45, at: 'mandira' },
  // 17. seviye: pamuk
  kumas: { name: 'Kumaş', emoji: '🧵', needs: { pamuk: 3 }, sell: 560, xp: 20, lvl: 17, mins: 90, at: 'atolye' },
  canta: { name: 'Çanta', emoji: '👜', needs: { kumas: 1, wool: 2 }, sell: 800, xp: 30, lvl: 17, mins: 150, at: 'atolye' },
  // Kurabiye: tatlandırıcı baldır
  kurabiye: {
    name: 'Kurabiye',
    emoji: '🍪',
    needs: { bugdayunu: 2, tereyagi: 1, honey: 1 },
    sell: 280,
    xp: 16,
    lvl: 13,
    mins: 75,
    at: 'firin',
  },
  // 21. seviye: patates
  patomlet: { name: 'Patatesli omlet', emoji: '🥔', needs: { patates: 2, egg: 2 }, sell: 500, xp: 22, lvl: 21, mins: 60, at: 'asci' },
  pure: { name: 'Patates püresi', emoji: '🥣', needs: { patates: 2, tereyagi: 1 }, sell: 570, xp: 24, lvl: 21, mins: 75, at: 'asci' },
  // 23. seviye: soğan
  menemen: { name: 'Menemen', emoji: '🍳', needs: { domates: 2, sogan: 1, egg: 2 }, sell: 370, xp: 20, lvl: 23, mins: 45, at: 'asci' },
  tursu: { name: 'Turşu', emoji: '🥒', needs: { sogan: 2, havuc: 3 }, sell: 580, xp: 26, lvl: 23, mins: 150, at: 'asci' },
  // 25. seviye: kavun
  kavunsuyu: { name: 'Kavun suyu', emoji: '🍹', needs: { kavun: 2 }, sell: 600, xp: 26, lvl: 25, mins: 45, at: 'meyvesuyu' },
  kavuntatli: {
    name: 'Kavunlu tatlı',
    emoji: '🍮',
    needs: { kavun: 2, milk: 1, honey: 1 },
    sell: 780,
    xp: 34,
    lvl: 25,
    mins: 120,
    at: 'tatli',
  },
  // 28. seviye: karpuz
  karpuzsuyu: { name: 'Karpuz suyu', emoji: '🍉', needs: { karpuz: 2 }, sell: 700, xp: 30, lvl: 28, mins: 60, at: 'meyvesuyu' },
  meyvetabagi: {
    name: 'Meyve tabağı',
    emoji: '🍓',
    needs: { kavun: 1, karpuz: 1, cilek: 2 },
    sell: 830,
    xp: 34,
    lvl: 28,
    mins: 90,
    at: 'tatli',
  },
  // 35. seviye: ileri ürünler (uzun tarif zincirleri)
  yaspasta: {
    name: 'Yaş pasta',
    emoji: '🎂',
    needs: { kek: 2, cilek: 3, honey: 1, tereyagi: 1 },
    sell: 850,
    xp: 40,
    lvl: 35,
    mins: 180,
    at: 'tatli',
  },
  pikniksepeti: {
    name: 'Piknik sepeti',
    emoji: '🧺',
    needs: { ekmek: 1, peynir: 1, karpuzsuyu: 1 },
    at: 'tatli',
    sell: 1150,
    xp: 45,
    lvl: 35,
    mins: 120,
  },
  // 36–60. seviye. Kural: ürün ancak o atölyede gerçekten yapılan bir şeyse oraya girer (değirmen öğütür, mandıra süt işler…).
  kirazrecel: { name: 'Kiraz reçeli', emoji: '🍒', needs: { kiraz: 6 }, sell: 520, xp: 30, lvl: 36, mins: 120, at: 'konserve' },
  elmasuyu: { name: 'Elma suyu', emoji: '🧃', needs: { elma: 8 }, sell: 480, xp: 28, lvl: 37, mins: 60, at: 'meyvesuyu' },
  yogurt: { name: 'Yoğurt', emoji: '🥣', needs: { milk: 4 }, sell: 270, xp: 26, lvl: 38, mins: 90, at: 'mandira' },
  // Şeker kamışı kazanda kaynatılarak şekere döner: reçel atölyesinin kazanında yapılır.
  seker: { name: 'Şeker', emoji: '🧊', needs: { sekerkamisi: 2 }, sell: 780, xp: 34, lvl: 39, mins: 60, at: 'konserve' },
  armutrecel: { name: 'Armut reçeli', emoji: '🍐', needs: { armut: 4, seker: 1 }, sell: 1350, xp: 46, lvl: 40, mins: 150, at: 'konserve' },
  krema: { name: 'Krema', emoji: '🥛', needs: { milk: 2, tereyagi: 1 }, sell: 250, xp: 26, lvl: 41, mins: 45, at: 'mandira' },
  cilekdondurma: {
    name: 'Çilekli dondurma',
    emoji: '🍨',
    needs: { krema: 1, seker: 1, cilek: 3 },
    sell: 1700,
    xp: 56,
    lvl: 42,
    mins: 120,
    at: 'tatli',
  },
  sutlucikolata: {
    name: 'Sütlü çikolata',
    emoji: '🍫',
    needs: { kakao: 3, seker: 1, milk: 2 },
    sell: 1850,
    xp: 60,
    lvl: 44,
    mins: 150,
    at: 'cikolataci',
  },
  cilekcikolata: {
    name: 'Çilekli çikolata',
    emoji: '🍓',
    needs: { sutlucikolata: 1, cilek: 4 },
    sell: 2800,
    xp: 70,
    lvl: 45,
    mins: 90,
    at: 'cikolataci',
  },
  yulafezmesi: { name: 'Yulaf ezmesi', emoji: '🥣', needs: { yulaf: 2 }, sell: 740, xp: 34, lvl: 46, mins: 45, at: 'degirmen' },
  granola: { name: 'Granola', emoji: '🥜', needs: { yulafezmesi: 1, honey: 2 }, sell: 1200, xp: 48, lvl: 47, mins: 90, at: 'firin' },
  filtrekahve: { name: 'Filtre kahve', emoji: '☕', needs: { kahve: 2 }, sell: 940, xp: 44, lvl: 49, mins: 30, at: 'kahveci' },
  latte: { name: 'Latte', emoji: '☕', needs: { kahve: 2, milk: 2 }, sell: 1080, xp: 50, lvl: 50, mins: 45, at: 'kahveci' },
  mocha: {
    name: 'Mocha',
    emoji: '☕',
    needs: { kahve: 2, sutlucikolata: 1, krema: 1 },
    sell: 3600,
    xp: 85,
    lvl: 51,
    mins: 90,
    at: 'kahveci',
  },
  limonata: { name: 'Limonata', emoji: '🍋', needs: { limon: 4, seker: 1 }, sell: 2000, xp: 62, lvl: 53, mins: 60, at: 'meyvesuyu' },
  limonmarmelat: {
    name: 'Limon marmelatı',
    emoji: '🍋',
    needs: { limon: 5, seker: 1 },
    sell: 2250,
    xp: 66,
    lvl: 54,
    mins: 150,
    at: 'konserve',
  },
  nanecayi: { name: 'Nane çayı', emoji: '🍵', needs: { nane: 2, honey: 1 }, sell: 900, xp: 44, lvl: 55, mins: 30, at: 'kahveci' },
  nanelimonata: {
    name: 'Naneli limonata',
    emoji: '🍹',
    needs: { limonata: 1, nane: 2 },
    sell: 3300,
    xp: 80,
    lvl: 56,
    mins: 45,
    at: 'meyvesuyu',
  },
  kecipeyniri: { name: 'Keçi peyniri', emoji: '🧀', needs: { gmilk: 3 }, sell: 420, xp: 40, lvl: 58, mins: 120, at: 'mandira' },
  hceviziyagi: { name: 'Hindistan cevizi yağı', emoji: '🥥', needs: { hcevizi: 3 }, sell: 920, xp: 46, lvl: 59, mins: 120, at: 'yag' },
  // 60. seviyenin ödülü: satılabilir ama asıl işi partnere hediye edilmektir (BASKETS.sevgili).
  sevgilikutusu: {
    name: 'Sevgili kutusu',
    emoji: '💝',
    needs: { sutlucikolata: 1, recel: 1, gul: 2 },
    sell: 3400,
    xp: 100,
    lvl: 60,
    mins: 180,
    at: 'cikolataci',
  },
};
// Üretimdeki iş: tarif işe konunca malzeme depodan çıkar; ready geçince toplanır ve ürün depoya girer.
// st: işin konduğu yer (reçel/turşu konserve atölyesi sonradan kurulsa da başladığı yerde kalır).
export type ProdJob = { id: string; recipe: RecipeId; by: string; at: number; ready: number; n: number; st?: Station };
// Mutfakta aynı anda kaç iş: 2 ile başlar, 8. ve 14. seviyede birer artar.
// Seviye ödülleri (yeni ürün açılmayan seviyeler üretimi geliştirir):
// 18: atölyelere +1 yer · 20: 4. sipariş, daha büyük siparişler · 22: atölyeler %20 hızlı · 24: özel siparişler
// 26: atölyelere +1 yer · 32: atölyelere +1 yer daha
export const kitchenSlots = (level: number) =>
  2 + (level >= 8 ? 1 : 0) + (level >= 14 ? 1 : 0) + (level >= 26 ? 1 : 0) + (level >= 32 ? 1 : 0);
export const orderSlots = (level: number) => (level >= 20 ? 4 : 3);
export const WORKSHOP_FAST_LVL = 22;
export const SPECIAL_ORDER_LVL = 24;
export const STATIONS: Record<Station, { name: string; slot: string; from: string; inn: string }> = {
  mutfak: { name: 'Mutfak', slot: 'ocak', from: 'mutfaktan', inn: 'mutfakta' },
  mandira: { name: 'Mandıra', slot: 'tekne', from: 'mandıradan', inn: 'mandırada' },
  atolye: { name: 'Dikiş atölyesi', slot: 'tezgâh', from: 'atölyeden', inn: 'atölyede' },
  konserve: { name: 'Reçel atölyesi', slot: 'kazan', from: 'reçel atölyesinden', inn: 'reçel atölyesinde' },
  asci: { name: 'Aşçı mutfağı', slot: 'ocak', from: 'aşçı mutfağından', inn: 'aşçı mutfağında' },
  degirmen: { name: 'Un değirmeni', slot: 'taş', from: 'değirmenden', inn: 'değirmende' },
  firin: { name: 'Fırın', slot: 'göz', from: 'fırından', inn: 'fırında' },
  yag: { name: 'Yağ fabrikası', slot: 'pres', from: 'yağ fabrikasından', inn: 'yağ fabrikasında' },
  meyvesuyu: { name: 'Meyve suyu atölyesi', slot: 'sıkacak', from: 'meyve suyu atölyesinden', inn: 'meyve suyu atölyesinde' },
  tatli: { name: 'Tatlı atölyesi', slot: 'tezgâh', from: 'tatlı atölyesinden', inn: 'tatlı atölyesinde' },
  cikolataci: { name: 'Çikolatacı', slot: 'kalıp', from: 'çikolatacıdan', inn: 'çikolatacıda' },
  kahveci: { name: 'Kahve dükkânı', slot: 'demlik', from: 'kahve dükkânından', inn: 'kahve dükkânında' },
};
// Tarifin yapıldığı yer. alt'ı olan tarif (reçel, turşu) o atölye çiftlikteyse orada, değilse mutfakta yapılır.
export const stationOf = (r: RecipeId, f?: Farm): Station => {
  const x = RECIPES[r];
  if (!x) return 'mutfak';
  if (x.alt && f && hasStation(f, x.alt)) return x.alt;
  return x.at ?? 'mutfak';
};
// Atölyelerde 2 yer; 12, 18, 26 ve 32. seviyelerde birer yer daha. ('mutfak' yalnızca eski kayıtlardaki yarım işler için durur.)
export const stationSlots = (st: Station, level: number) =>
  st === 'mutfak' ? kitchenSlots(level) : 2 + (level >= 12 ? 1 : 0) + (level >= 18 ? 1 : 0) + (level >= 26 ? 1 : 0) + (level >= 32 ? 1 : 0);
export const STOCK_EMOJI: Record<string, string> = Object.fromEntries(Object.entries(RECIPES).map(([k, v]) => [k, v.emoji]));

// ---------- Hediye sepeti ----------
// Depodan hazırlanır, partnere gönderilir; partner açınca çiftlik altın ve tecrübe, çift puan kazanır, ortak hasat sayılır.
// Kişi başı günde bir sepet; partner açmadan yenisi gönderilmez.
export type BasketId = 'kahvalti' | 'piknik' | 'tatli' | 'sevgili';
export const BASKETS: Record<
  BasketId,
  { name: string; emoji: string; art: string; needs: Record<string, number>; coins: number; xp: number; points: number }
> = {
  kahvalti: {
    name: 'Kahvaltı sepeti',
    emoji: '🧺',
    art: 'sepet_dolu',
    needs: { ekmek: 1, egg: 2, domates: 1 },
    coins: 150,
    xp: 20,
    points: 10,
  },
  piknik: {
    name: 'Kır sepeti',
    emoji: '🥪',
    art: 'sepet_dolu',
    needs: { ekmek: 1, peynir: 1, havuc: 2 },
    coins: 320,
    xp: 30,
    points: 15,
  },
  tatli: { name: 'Tatlı sepeti', emoji: '🎁', art: 'sepet_tatli', needs: { kek: 1, recel: 1 }, coins: 700, xp: 45, points: 25 },
  // 60. seviye: çikolatacıda hazırlanan kutu partnere gönderilir.
  sevgili: { name: 'Sevgili kutusu', emoji: '💝', art: 'sevgilikutusu', needs: { sevgilikutusu: 1 }, coins: 2500, xp: 120, points: 50 },
};
export type Gift = { id: string; from: string; kind: BasketId; at: number };
export const hasAll = (f: Farm, needs: Record<string, number>) => Object.entries(needs).every(([k, n]) => (f.stock[k] ?? 0) >= n);
export const needsText = (needs: Record<string, number>) =>
  Object.entries(needs)
    .map(([k, n]) => `${n} ${(PRODUCT_NAME[k] ?? k).toLocaleLowerCase('tr-TR')}`)
    .join(', ');
const DAY = 24 * 60 * MIN;
export const giftWait = (f: Farm, uid: string, now: number) => {
  const pending = (f.gifts ?? []).some((g) => g.from === uid);
  const last = f.giftAt?.[uid] ?? 0;
  return pending ? 'pending' : now - last < DAY ? 'day' : null;
};

// Hayvan binaları: hayvanlar çimene bırakılmaz, binada yaşar. Her binaya 3 hayvan sığar.
// Tavuk/koyun/inek yemlenince üretime başlar (yem: depodan 1 buğday, yoksa 5 altın); arılar yemsiz kendi döngüsünde.
export const BUILDINGS: Record<BuildingId, { name: string; cost: number; lvl: number; w: number; animals: AnimalId[]; cap: number }> = {
  kumes: { name: 'Kümes', cost: 120, lvl: 2, w: 1.45, animals: ['tavuk'], cap: 3 },
  agil: { name: 'Ağıl', cost: 260, lvl: 4, w: 1.7, animals: ['koyun', 'inek', 'keci'], cap: 3 },
  kovan: { name: 'Kovanlar', cost: 400, lvl: 9, w: 1.3, animals: ['ari'], cap: 3 },
};
export const FEED_COINS = 5;
export const FEED_CROP = 'bugday';
export const needsFeed = (a: AnimalId) => a !== 'ari';
export type Resident = { id: AnimalId; fed: number | null; last: number }; // fed: yemleme zamanı (üretim başlangıcı); null: aç
// Bir hayvanın ürünü hazır mı? Arı: son toplamadan beri süre doldu. Diğerleri: yemlendi ve süre doldu.
export const residentReady = (r: Resident, now: number) =>
  needsFeed(r.id) ? r.fed !== null && now >= r.fed + ANIMALS[r.id].mins * MIN : now >= r.last + ANIMALS[r.id].mins * MIN;
export const residentReadyAt = (r: Resident) => (needsFeed(r.id) ? (r.fed ?? 0) : r.last) + ANIMALS[r.id].mins * MIN;
export const buildingFor = (a: AnimalId) => (Object.keys(BUILDINGS) as BuildingId[]).find((b) => BUILDINGS[b].animals.includes(a))!;

// Meyve ağaçları: bir kez dikilir, ilk hasattan sonra sürekli meyve verir. Çayıra dikilir.
export const TREES: Record<
  TreeId,
  {
    name: string;
    fruit: string;
    cost: number;
    first: number;
    mins: number;
    yieldN: number;
    sell: number;
    xp: number;
    lvl: number;
    w: number;
  }
> = {
  elma: { name: 'Elma ağacı', fruit: 'Elma', cost: 200, first: 180, mins: 135, yieldN: 3, sell: 30, xp: 6, lvl: 3, w: 1.15 },
  kiraz: { name: 'Kiraz ağacı', fruit: 'Kiraz', cost: 320, first: 240, mins: 180, yieldN: 3, sell: 45, xp: 9, lvl: 6, w: 1.15 },
  armut: { name: 'Armut ağacı', fruit: 'Armut', cost: 450, first: 300, mins: 225, yieldN: 3, sell: 60, xp: 12, lvl: 11, w: 1.15 },
  // Yağ fabrikasının hammaddeleri
  zeytin: { name: 'Zeytin ağacı', fruit: 'Zeytin', cost: 900, first: 360, mins: 270, yieldN: 3, sell: 110, xp: 16, lvl: 19, w: 1.2 },
  avokado: { name: 'Avokado ağacı', fruit: 'Avokado', cost: 1200, first: 420, mins: 360, yieldN: 3, sell: 150, xp: 20, lvl: 24, w: 1.2 },
  // Çikolatacının, meyve suyu ve reçel atölyesinin, yağ fabrikasının yeni hammaddeleri
  kakao: { name: 'Kakao ağacı', fruit: 'Kakao', cost: 1600, first: 420, mins: 360, yieldN: 3, sell: 180, xp: 24, lvl: 43, w: 1.2 },
  limon: { name: 'Limon ağacı', fruit: 'Limon', cost: 2000, first: 420, mins: 300, yieldN: 3, sell: 190, xp: 26, lvl: 52, w: 1.2 },
  hcevizi: {
    name: 'Hindistan cevizi ağacı',
    fruit: 'Hindistan cevizi',
    cost: 2600,
    first: 420,
    mins: 390,
    yieldN: 3,
    sell: 230,
    xp: 30,
    lvl: 59,
    w: 1.25,
  },
};

export const DECOR: Record<
  DecorId,
  {
    name: string;
    sp: string;
    cost: number;
    xp: number;
    lvl: number;
    w: number;
    wall?: 'cit' | 'duvar';
    perk?: string;
    flowers?: boolean;
    hidden?: boolean;
    station?: boolean;
  }
> = {
  cicek: { name: 'Çiçeklik', sp: 'planter', cost: 15, xp: 1, lvl: 1, w: 0.92 },
  // Üretim atölyesi: çiftlikte bir tane olur; dokununca üretim paneli açılır.
  mandira: {
    name: 'Mandıra',
    sp: 'mandira',
    cost: 600,
    xp: 15,
    lvl: 5,
    w: 1.5,
    perk: 'Sütten tereyağı, peynir, yoğurt ve krema üretir',
    station: true,
  },
  atolye: {
    name: 'Dikiş atölyesi',
    sp: 'atolye',
    cost: 900,
    xp: 20,
    lvl: 9,
    w: 1.6,
    perk: 'Yünden atkı ve kazak, pamuktan kumaş ve çanta üretir',
    station: true,
  },
  konserve: {
    name: 'Reçel atölyesi',
    sp: 'konserve',
    cost: 500,
    xp: 12,
    lvl: 7,
    w: 1.5,
    perk: 'Reçel, marmelat ve şeker yapar',
    station: true,
  },
  asci: {
    name: 'Aşçı mutfağı',
    sp: 'asci',
    cost: 200,
    xp: 8,
    lvl: 3,
    w: 1.5,
    perk: 'Omlet, patatesli omlet, püre, menemen ve turşu yapar',
    station: true,
  },
  // Çit ve taş duvar komşu parçalarla kendiliğinden birleşir (çizim: wallArt.ts).
  cit: { name: 'Çit', sp: 'fence', cost: 20, xp: 1, lvl: 1, w: 0.92, wall: 'cit' },
  duvar: { name: 'Taş duvar', sp: 'fence', cost: 25, xp: 1, lvl: 1, w: 0.92, wall: 'duvar' },
  // Çiçekli türler: dipteki boş yarım kareye çiçek; düz olanla birleşir, duvara dokunup da çevrilebilir.
  citc: { name: 'Çiçekli çit', sp: 'fence', cost: 30, xp: 2, lvl: 1, w: 0.92, wall: 'cit', flowers: true },
  duvarc: { name: 'Çiçekli duvar', sp: 'fence', cost: 35, xp: 2, lvl: 1, w: 0.92, wall: 'duvar', flowers: true },
  saman: { name: 'Saman', sp: 'hay', cost: 30, xp: 1, lvl: 1, w: 0.85 },
  agac: { name: 'Ağaç', sp: 'tree', cost: 40, xp: 2, lvl: 1, w: 1.25 },
  bank: { name: 'Bank', sp: 'bench', cost: 60, xp: 3, lvl: 2, w: 0.85 },
  kuyu: { name: 'Kuyu', sp: 'well', cost: 120, xp: 5, lvl: 3, w: 0.78 },
  cesme: { name: 'Çeşme', sp: 'fountain', cost: 250, xp: 10, lvl: 5, w: 1.05 },
  // Posta kutusu artık süs değil: çiftliğin önünde sabit durur ve sipariş defterini açar. Dükkânda satılmaz;
  // önceden alınmış olanlar yerinde kalır.
  posta: { name: 'Posta kutusu', sp: 'posta', cost: 50, xp: 2, lvl: 1, w: 0.55, hidden: true },
  lamba: { name: 'Sokak lambası', sp: 'lamba', cost: 70, xp: 3, lvl: 2, w: 0.7 },
  kopru: { name: 'Köprü', sp: 'kopru', cost: 90, xp: 4, lvl: 2, w: 1.15 },
  golet: { name: 'Gölet', sp: 'golet', cost: 150, xp: 6, lvl: 3, w: 1.3 },
  salincak: { name: 'Salıncak', sp: 'salincak', cost: 180, xp: 7, lvl: 4, w: 1.15 },
  cardak: { name: 'Çardak', sp: 'cardak', cost: 400, xp: 14, lvl: 6, w: 1.4 },
  // Kasım 2026'da eklenen süsler: ucuzdan pahalıya; pahalı olanlar biriken altına harcama yeri açar.
  gulcali: { name: 'Gül çalısı', sp: 'sus_gulcali', cost: 80, xp: 3, lvl: 2, w: 0.9 },
  lavanta: { name: 'Lavanta tarhı', sp: 'sus_lavanta', cost: 90, xp: 3, lvl: 3, w: 0.95 },
  kusevi: { name: 'Kuş evi', sp: 'sus_kusevi', cost: 110, xp: 4, lvl: 4, w: 0.5 },
  cam: { name: 'Çam ağacı', sp: 'sus_cam', cost: 140, xp: 4, lvl: 5, w: 1.0 },
  kusbanyo: { name: 'Kuş banyosu', sp: 'sus_kusbanyo', cost: 220, xp: 6, lvl: 6, w: 0.75 },
  korkuluk: { name: 'Korkuluk', sp: 'sus_korkuluk', cost: 260, xp: 7, lvl: 7, w: 0.85 },
  elarabasi: { name: 'Çiçekli el arabası', sp: 'sus_elarabasi', cost: 320, xp: 8, lvl: 8, w: 1.0 },
  kulube: { name: 'Köpek kulübesi', sp: 'sus_kulube', cost: 450, xp: 10, lvl: 10, w: 1.05 },
  piknikmasa: { name: 'Piknik masası', sp: 'sus_piknikmasa', cost: 600, xp: 12, lvl: 11, w: 1.2 },
  sogut: { name: 'Söğüt ağacı', sp: 'sus_sogut', cost: 700, xp: 12, lvl: 12, w: 1.35 },
  kampatesi: { name: 'Kamp ateşi', sp: 'sus_kampatesi', cost: 850, xp: 14, lvl: 13, w: 1.15 },
  hamak: { name: 'Hamak', sp: 'sus_hamak', cost: 1000, xp: 15, lvl: 14, w: 1.25 },
  kalpcali: { name: 'Kalp çalı', sp: 'sus_kalpcali', cost: 1500, xp: 18, lvl: 15, w: 1.1 },
  kemer: { name: 'Çiçekli kemer', sp: 'sus_kemer', cost: 2200, xp: 22, lvl: 16, w: 1.1 },
  traktor: { name: 'Traktör', sp: 'sus_traktor', cost: 3500, xp: 28, lvl: 18, w: 1.3 },
  kalpheykel: { name: 'Kalp heykeli', sp: 'sus_kalpheykel', cost: 6000, xp: 40, lvl: 20, w: 1.1 },
  // İşe yarayan yapılar: sera çevresindeki (2 kare) ekinleri hızlandırır.
  sera: { name: 'Sera', sp: 'sera', cost: 500, xp: 16, lvl: 4, w: 1.3, perk: 'Yakın ekin %25 hızlı' },
  degirmen: {
    name: 'Un değirmeni',
    sp: 'degirmen',
    cost: 120,
    xp: 8,
    lvl: 2,
    w: 1.2,
    perk: 'Buğday ve mısır unu üretir',
    station: true,
  },
  firin: {
    name: 'Fırın',
    sp: 'firin',
    cost: 150,
    xp: 8,
    lvl: 2,
    w: 1.5,
    perk: 'Undan ekmek, mısır ekmeği ve kurabiye pişirir',
    station: true,
  },
  yag: {
    name: 'Yağ fabrikası',
    sp: 'yag',
    cost: 1500,
    xp: 30,
    lvl: 15,
    w: 1.6,
    perk: 'Ayçiçeği, zeytin, avokado ve hindistan cevizinden yağ üretir',
    station: true,
  },
  meyvesuyu: {
    name: 'Meyve suyu atölyesi',
    sp: 'meyvesuyu',
    cost: 2200,
    xp: 35,
    lvl: 25,
    w: 1.6,
    perk: 'Meyve suyu ve limonata yapar',
    station: true,
  },
  tatli: {
    name: 'Tatlı atölyesi',
    sp: 'tatli',
    cost: 2400,
    xp: 35,
    lvl: 25,
    w: 1.6,
    perk: 'Kavunlu tatlı, yaş pasta, piknik sepeti ve dondurma hazırlar',
    station: true,
  },
  cikolataci: {
    name: 'Çikolatacı',
    sp: 'cikolataci',
    cost: 4000,
    xp: 45,
    lvl: 44,
    w: 1.6,
    perk: 'Kakaodan sütlü ve çilekli çikolata, sevgili kutusu hazırlar',
    station: true,
  },
  kahveci: {
    name: 'Kahve dükkânı',
    sp: 'kahveci',
    cost: 5000,
    xp: 50,
    lvl: 49,
    w: 1.6,
    perk: 'Filtre kahve, latte, mocha ve nane çayı yapar',
    station: true,
  },
};

export type Tile =
  | { k: 'locked' }
  | { k: 'wild'; item: WildId } // satın alınan dış arazide kalan yabani ağaç/çalı/kaya: aletle temizlenir
  | { k: 'grass' }
  | { k: 'path' }
  | { k: 'soil' }
  | { k: 'fixed'; item: 'house' | 'barn' }
  | { k: 'crop'; crop: CropId; by: string; at: number; ready: number; watered?: string }
  | { k: 'animal'; item: AnimalId; last: number }
  | { k: 'tree'; item: TreeId; at: number; last: number } // at: dikim; last: son hasat (ilk hasat at + first)
  | { k: 'building'; item: BuildingId; res: Resident[] }
  | { k: 'decor'; item: DecorId };

// ---------- Yabani arazi ----------
// Çiftliğin çevresindeki satılık arazi boş değil, yabanidir: üstünde ağaç, çalı, kütük ve kaya durur.
// Arazi satın alınınca bunlar yerinde kalır; ağaç, çalı ve kütük baltayla, kayalar kazmayla temizlenir.
export type WildId = 'mese' | 'hus' | 'sogut' | 'cali' | 'kutuk' | 'kaya' | 'tas';
export type ToolId = 'balta' | 'kazma';
// art yoksa alt kullanılır.
export const WILD: Record<WildId, { name: string; art: string; alt: string; tool: ToolId; w: number; xp: number }> = {
  mese: { name: 'Yabani meşe', art: 'y_mese', alt: 'tree', tool: 'balta', w: 1.35, xp: 4 },
  hus: { name: 'Yabani huş', art: 'y_hus', alt: 'sus_cam', tool: 'balta', w: 1.05, xp: 4 },
  sogut: { name: 'Yabani söğüt', art: 'y_sogut', alt: 'sus_sogut', tool: 'balta', w: 1.3, xp: 4 },
  cali: { name: 'Yabani çalı', art: 'y_cali', alt: 'sus_gulcali', tool: 'balta', w: 0.9, xp: 3 },
  kutuk: { name: 'Kütük', art: 'y_kutuk', alt: 'hay', tool: 'balta', w: 0.8, xp: 3 },
  kaya: { name: 'Kaya', art: 'y_kaya', alt: 'well', tool: 'kazma', w: 0.95, xp: 5 },
  tas: { name: 'Taş', art: 'y_kaya', alt: 'well', tool: 'kazma', w: 0.6, xp: 4 },
};
export const TOOLS: Record<ToolId, { name: string; art: string; cost: number; verb: string }> = {
  balta: { name: 'Balta', art: 'balta', cost: 120, verb: 'Baltayla kes' },
  kazma: { name: 'Kazma', art: 'kazma', cost: 150, verb: 'Kazmayla kır' },
};
export const TOOL_MAX = 20; // tek seferde alınabilecek en çok alet
// Her çiftlik birkaç aletle başlar.
export const toolsOf = (f: Farm): Record<ToolId, number> => ({ balta: 3, kazma: 2, ...(f.tools ?? {}) });
// Pazarda satılan ve siparişlerin ödül verdiği aletler.
export const TOOLS_ON: ToolId[] = ['balta', 'kazma'];
// Bir dış arazi karesinde ne yetiştiği kare numarasından türetilir (kayıt gerekmez; herkes aynısını görür).
export function wildAt(i: number): WildId | null {
  const h = (Math.imul(i + 17, 2654435761) >>> 0) % 100;
  return h < 11 ? 'mese' : h < 19 ? 'hus' : h < 27 ? 'cali' : h < 31 ? 'kutuk' : h < 35 ? 'kaya' : h < 38 ? 'tas' : null;
}

export type FarmLog = { by: string; text: string; at: number };
// Kasaba siparişi: 1–3 ürün; depodan teslim edilir, ikisi de katkı yaparsa ortak hasat sayılır.
export type Order = {
  id: string;
  items: Record<string, number>; // ürün → istenen
  given: Record<string, number>; // ürün → teslim edilen
  by: string[]; // katkı yapanlar
  coins: number;
  xp: number;
  openAt: number; // bu zamandan önce görünmez (tamamlanan siparişin yerine 20 dk sonra yenisi)
  who?: string; // siparişi veren (kurgusal) çift; eski siparişlerde yok, kimlikten türetilir
  special?: boolean; // özel sipariş: ödülü iki katı
  tool?: ToolId; // bu sipariş ödül olarak bir alet de verir
  packed?: number; // ürünlerin hepsi ayrıldı: çift girişte bekliyor, ödül elden teslimde (handover) verilir
};
// Not Ağacı: evin yanındaki ağaç; ikiniz kısa notlar bırakırsınız.
export type FarmNote = { by: string; text: string; at: number };
export const NOTE_TREE = OFF * N + 3 + OFF; // (0,3) karesi (iç çiftlik): Not Ağacı'nın ilk yeri
export const GIFT_SPOT = (1 + OFF) * N + 3 + OFF; // hediye sepeti tezgâhının ilk yeri
// İkisi de taşınabilir; yeni yerleri kayıtta durur (yoksa ilk yerlerindedirler).
export const noteTile = (f: Farm) => f.noteAt ?? NOTE_TREE;
export const giftTile = (f: Farm) => f.giftSpot ?? GIFT_SPOT;
export const NOTE_MAX = 300;
export const NOTES_PER_DAY = 10;
export const ORDER_SLOTS = 3;
export const ORDER_REFILL = 20 * MIN;
// pos: herkesin en son çalıştığı kare; partnerin avatarı orada durur.
// stock: depo (ürün adı → adet); harvests: ortak hasat sayısı (arazi bununla açılır).
export type Farm = {
  v: 2 | 3 | 4 | 5; // 2: 10x10, 3: 14x14, 4: 22x22, 5: 28x28
  coins: number;
  xp: number;
  bought: number; // ortak hasatla açılan iç parseller
  outer?: number; // parayla alınan dış parseller
  tiles: Tile[];
  log: FarmLog[];
  pos: Record<string, number>;
  stock: Record<string, number>;
  harvests: number;
  orders: Order[];
  notes: FarmNote[];
  gifts?: Gift[]; // açılmayı bekleyen hediye sepetleri
  giftAt?: Record<string, number>; // kişi başı son sepet gönderme zamanı
  kiss?: { by: string; at: number }; // son öpücük (iki ekranda kalp efekti için)
  prod?: ProdJob[]; // mutfakta üretimdeki işler
  xm?: number; // seviye eğrisi değişmeden önce kazanılmış tecrübe (bkz. xpOf)
  name?: string; // çiftçi pazarında görünen çiftlik adı (çiftin gerçek adı görünmez)
  trader?: { day: string; got: string[] }; // gezgin tüccardan bugün alınan teklifler
  // Kurma tecrübesi yalnız ilk kez verilir: her tür için bugüne dek aynı anda en çok kaç tane durduğu (al-kaldır döngüsü tecrübe basmasın).
  dx?: Record<string, number>;
  tools?: Partial<Record<ToolId, number>>; // balta ve kazma (yabani araziyi temizlemek için)
  noteAt?: number; // Not Ağacı taşındıysa yeni karesi
  giftSpot?: number; // hediye sepeti tezgâhı taşındıysa yeni karesi
  dog?: string; // çiftlik köpeğinin adı
  closed?: boolean; // ziyarete kapalı (varsayılan: açık)
  seen?: Record<string, 1>; // koleksiyon: en az bir kez elde edilen ürünler
  colClaim?: number; // koleksiyonda alınan ödül basamağı sayısı
  depotUp?: number; // depo büyütme sayısı
  big?: BigOrder; // haftalık büyük sipariş (ilk katkıda kaydedilir)
};

// H ev, B ahır (2x2), p yol, g çimen, s tarla, T ağaç, d çiçeklik, F çeşme, L satılık arazi
const MAP = [
  'HHgTBBgLLL',
  'HHgpBBgLLL',
  'ppppppgLLL',
  'sssPggdLLL',
  'sssPgggLLL',
  'sssPgFgLLL',
  'LLLpLLLLLL',
  'LLLpLLLLLL',
  'LLLpLLLLLL',
  'LLLpLLLLLL',
];
export const FIXED_ANCHOR = { house: [1 + OFF, 1 + OFF], barn: [1 + OFF, 5 + OFF] } as const;
// Depo taşınabilir: ön köşesi (2x2'nin sağ alt karesi) kayıttan bulunur; çizim, rozet ve "Depo" düğmesi buna bakar.
export function barnTile(f: Farm): number {
  let at = -1;
  f.tiles.forEach((t, i) => {
    if (t.k === 'fixed' && t.item === 'barn') at = i; // en büyük numara = sağ alt kare
  });
  return at >= 0 ? at : FIXED_ANCHOR.barn[0] * N + FIXED_ANCHOR.barn[1];
}
// Ev de taşınabilir: ön köşesi (2x2'nin sağ alt karesi) kayıttan bulunur.
export function houseTile(f: Farm): number {
  let at = -1;
  f.tiles.forEach((t, i) => {
    if (t.k === 'fixed' && t.item === 'house') at = i;
  });
  return at >= 0 ? at : FIXED_ANCHOR.house[0] * N + FIXED_ANCHOR.house[1];
}
// Deponun önü: satış ve sipariş tesliminde avatarın durduğu kare (deponun sol alt çaprazı; arazi dışına taşarsa deponun kendisi).
export function pileTile(f: Farm): number {
  const b = barnTile(f);
  const r = Math.floor(b / N);
  const c = b % N;
  return r + 1 < N && c >= 1 ? (r + 1) * N + c - 1 : b;
}

export function newFarm(): Farm {
  const tiles: Tile[] = [];
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      const ch = MAP[r - OFF]?.[c - OFF] ?? 'L'; // dış halka: satılık arazi
      let t: Tile = { k: 'grass' };
      if (ch === 'H') t = { k: 'fixed', item: 'house' };
      if (ch === 'B') t = { k: 'fixed', item: 'barn' };
      if (ch === 'p' || ch === 'P') t = { k: 'path' };
      if (ch === 's') t = { k: 'soil' };
      if (ch === 'L') t = { k: 'locked' };
      if (ch === 'T') t = { k: 'decor', item: 'agac' };
      if (ch === 'd') t = { k: 'decor', item: 'cicek' };
      if (ch === 'F') t = { k: 'decor', item: 'cesme' };
      tiles.push(t);
    }
  return { v: 5, coins: 100, xp: 0, bought: 0, outer: 0, tiles, log: [], pos: {}, stock: {}, harvests: 0, orders: [], notes: [] };
}

// Eski (5x5) bahçe kaydı varsa yeni çiftlikle başlanır.
export function farmOf(couple: Couple | null | undefined): Farm {
  // Süreler kısaltılmadan önce ekilmiş ekinler eski (uzun) süresini beklemesin: en çok yeni sürenin kış katı kadar.
  const capCrops = (tiles: Tile[]): Tile[] => {
    const late = (t: Tile) => t.k === 'crop' && !!CROPS[t.crop] && t.ready - t.at > CROPS[t.crop].mins * MIN * 1.02;
    return tiles.some(late) ? tiles.map((t) => (t.k === 'crop' && late(t) ? { ...t, ready: t.at + CROPS[t.crop].mins * MIN } : t)) : tiles;
  };
  const fill = (f: Farm): Farm => ({
    ...f,
    tiles: Array.isArray(f.tiles) ? capCrops(f.tiles) : f.tiles,
    pos: f.pos ?? {},
    stock: f.stock ?? {},
    harvests: f.harvests ?? 0,
    orders: f.orders ?? [],
    notes: f.notes ?? [],
  });
  // Her arazi boyutu ayrı bir alanda durur (v5: farm5, v4: farm4). Eski sürümdeki bir telefon yeni alanı tanımaz ve dokunmaz;
  // kendi alanına yazmaya devam eder. Böylece iki telefon farklı sürümdeyken büyük çiftliğin üstüne yazılamaz.
  const f5 = couple?.farm5 as Farm | undefined;
  if (f5?.v === 5 && Array.isArray(f5.tiles) && f5.tiles.length === N * N) return fill(f5);
  // İlk açılış: önceki kayıttan (v4 22x22, v3 14x14 ya da v2 10x10) büyütülür; ilk işlemde farm5 olarak kaydedilir.
  const f4 = couple?.farm4 as Farm | undefined;
  if (f4?.v === 4 && Array.isArray(f4.tiles) && f4.tiles.length === 22 * 22) return grow(fill(f4), 22);
  let f = couple?.farm as Farm | undefined;
  const keep = couple?.farmKeep as Farm | undefined;
  if (keep?.v === 3 && (!f || f.v !== 3)) f = keep;
  if (!f || (f.v !== 2 && f.v !== 3)) return newFarm();
  return grow(fill(f), f.v === 3 ? 14 : 10);
}
export const farmWrite = (farm: Farm) => ({ farm5: clean({ ...farm, v: 5 as const }) });

// Eski kare düzenini (old x old) yeni arazinin ortasına taşır; çevresi satılık arazi olur. Kare numaraları ve
// avatarların yerleri yeni düzene çevrilir. Ortadaki 10x10 hep aynı yerde kalır (iki düzende de ortalanmış).
function grow(f: Farm, old: number): Farm {
  const off = (N - old) / 2;
  const tiles: Tile[] = Array.from({ length: N * N }, () => ({ k: 'locked' }) as Tile);
  const map = (i: number) => (Math.floor(i / old) + off) * N + (i % old) + off;
  f.tiles.forEach((t, i) => {
    if (i < old * old) tiles[map(i)] = t;
  });
  const pos: Record<string, number> = {};
  for (const [k, v] of Object.entries(f.pos)) pos[k] = v >= 0 && v < old * old ? map(v) : (N * N) >> 1;
  // Taşınmış Not Ağacı ve sepet tezgâhının kare numaraları da yeni düzene çevrilir.
  const spot = (v: number | undefined) => (v !== undefined && v >= 0 && v < old * old ? map(v) : undefined);
  const out: Farm = { ...f, v: 5, outer: f.outer ?? 0, tiles, pos };
  const na = spot(f.noteAt);
  const gs = spot(f.giftSpot);
  if (na !== undefined) out.noteAt = na;
  else delete out.noteAt;
  if (gs !== undefined) out.giftSpot = gs;
  else delete out.giftSpot;
  return out;
}

export const isOuter = (i: number) => {
  const [r, c] = rc(i);
  return r < OFF || c < OFF || r >= OFF + INNER || c >= OFF + INNER;
};
// Dış arazi fiyatı: her parselde artar.
// Altın birikiyor; arazi ilerledikçe belirgin pahalanır (0: 300 · 5: 3.050 · 10: 8.300 · 20: 26.300).
export const outerPrice = (f: Farm) => {
  const n = f.outer ?? 0;
  return 300 + 300 * n + 50 * n * n;
};

// Seviye eğrisi. İlk 20 seviye hızlıdır (oyuna ısınma): 15·l·(l−1). Sonrasında her seviye bir öncekinden %9 pahalıdır;
// büyük çiftlikler günde binlerce tecrübe topladığı için düz eğride bir haftada 60. seviyeye çıkılıyordu.
// Yeni eğride (günde ~8.000 tecrübeyle bile) 50. seviye ~11 gün, 60 ~26 gün, 70 ~2 ay, 80 ~5 ay sürer.
const OLD_START = (l: number) => 15 * l * (l - 1);
const CURVE_FROM = 20;
const CURVE_STEP = 600; // 20→21 eski eğrideki bedel; eğri buradan kesintisiz devam eder
const CURVE_GROW = 1.09;
export const levelStart = (l: number) =>
  l <= CURVE_FROM
    ? OLD_START(l)
    : Math.round(OLD_START(CURVE_FROM) + (CURVE_STEP * (Math.pow(CURVE_GROW, l - CURVE_FROM) - 1)) / (CURVE_GROW - 1));
export function levelOf(xp: number) {
  let l = 1;
  while (xp >= levelStart(l + 1)) l++;
  return { level: l, from: levelStart(l), to: levelStart(l + 1) };
}
// Eğri değişmeden önce kazanılmış tecrübe (f.xm) eski seviyesini korur: kimsenin seviyesi düşmez. O tecrübe yeni eğride
// aynı seviyenin aynı yüzdesine çevrilir; sonradan kazanılan tecrübe yeni (yavaş) eğriyle sayılır.
// xm yoksa çiftlik henüz yeni sürümle yazılmamıştır: bütün tecrübesi eski sayılır.
const legacyXp = (x: number) => {
  if (x < OLD_START(CURVE_FROM)) return x;
  let l = CURVE_FROM;
  while (x >= OLD_START(l + 1)) l++;
  const p = (x - OLD_START(l)) / (OLD_START(l + 1) - OLD_START(l));
  return Math.round(levelStart(l) + p * (levelStart(l + 1) - levelStart(l)));
};
export const xpOf = (f: { xp: number; xm?: number }) => {
  const xm = Math.min(f.xm ?? f.xp, f.xp);
  return legacyXp(xm) + (f.xp - xm);
};

export const rc = (i: number) => [Math.floor(i / N), i % N] as const;
// İş bitince karakter tarlanın içinde kalmaz: en yakın yol (yoksa çim) karesine çekilir.
export function restNear(f: Farm, i: number): number {
  const ok = (j: number) => f.tiles[j]?.k === 'path' || f.tiles[j]?.k === 'grass';
  if (ok(i)) return i;
  const [r0, c0] = rc(i);
  let best = i;
  let bestD = Infinity;
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      const j = r * N + c;
      if (!ok(j)) continue;
      const d = Math.abs(r - r0) + Math.abs(c - c0) + (f.tiles[j].k === 'path' ? 0 : 0.5);
      if (d < bestD) {
        bestD = d;
        best = j;
      }
    }
  return best;
}
// Parseller 2x2'dir ve iç çiftliğin köşesine hizalıdır (arazi büyüyünce eski parseller bölünmesin diye OFF'un tekliği eklenir).
const P0 = OFF % 2;
export const parcelOf = (i: number) => `${Math.floor((Math.floor(i / N) + P0) / 2)}-${Math.floor(((i % N) + P0) / 2)}`;
export const parcelTiles = (f: Farm, i: number) =>
  f.tiles.map((t, j) => (t.k === 'locked' && parcelOf(j) === parcelOf(i) ? j : -1)).filter((j) => j >= 0);
// Bir sonraki parsel için gereken ortak hasat sayısı.
export const parcelNeed = (f: Farm) => HARVESTS_PER_PARCEL * ((f.bought || 0) + 1);

// ---------- Mevsim ----------
export type Season = 'kis' | 'bahar' | 'yaz' | 'guz';
export function seasonOf(now = Date.now()): Season {
  const m = new Date(now).getMonth();
  return m === 11 || m < 2 ? 'kis' : m < 5 ? 'bahar' : m < 8 ? 'yaz' : 'guz';
}
export const SEASON_NAME: Record<Season, string> = { kis: 'Kış', bahar: 'Bahar', yaz: 'Yaz', guz: 'Güz' };
// Kış artık yavaşlatmaz (hiçbir ürün 7 saati geçmesin); baharda ekinler biraz hızlı büyür.
export const growFactor = (s: Season) => (s === 'bahar' ? 0.9 : 1);
export const isWeekend = (now = Date.now()) => [0, 6].includes(new Date(now).getDay());

// ---------- Depo ----------
export const PRICE: Record<string, number> = {
  ...Object.fromEntries(Object.entries(CROPS).map(([k, v]) => [k, v.sell])),
  ...Object.fromEntries(Object.entries(PRODUCTS).map(([k, v]) => [k, v.sell])),
  ...Object.fromEntries(Object.entries(TREES).map(([k, v]) => [k, v.sell])),
  ...Object.fromEntries(Object.entries(RECIPES).map(([k, v]) => [k, v.sell])),
};
export const PRODUCT_NAME: Record<string, string> = {
  ...Object.fromEntries(Object.entries(CROPS).map(([k, v]) => [k, v.name])),
  ...Object.fromEntries(Object.entries(PRODUCTS).map(([k, v]) => [k, v.name])),
  ...Object.fromEntries(Object.entries(TREES).map(([k, v]) => [k, v.fruit])),
  ...Object.fromEntries(Object.entries(RECIPES).map(([k, v]) => [k, v.name])),
};
// ---------- Depo sınırı ----------
// Depo sınırlıdır; altınla büyütülür. Dolu depoya hasat, hayvan ürünü, meyve, üretim ve alışveriş girmez.
export const DEPOT_BASE = 300;
export const DEPOT_STEP = 100;
const FILLS_DEPOT: Action['a'][] = ['harvest', 'collect', 'pick', 'gather', 'harvestDay', 'collectProd', 'stall', 'trader', 'mkIn'];
export const depotCap = (f: Farm) => DEPOT_BASE + DEPOT_STEP * (f.depotUp ?? 0);
export const depotUsed = (f: Farm) => Object.values(f.stock).reduce((a, n) => a + (n > 0 ? n : 0), 0);
export const depotUpCost = (f: Farm) => 400 + 300 * (f.depotUp ?? 0);

// ---------- Koleksiyon ----------
// En az bir kez elde edilen her ürün koleksiyona girer. Her 5 üründe bir ödül: 150, 300, 450… altın.
export const COLLECTION_STEP = 5;
export const COLLECTION_COINS = 150;
export const COLLECTION: string[] = Object.keys(PRODUCT_NAME);
export function collectionOf(f: Farm) {
  // Eski çiftlikler: depoda duran ürünler de görülmüş sayılır.
  const seen = new Set([...Object.keys(f.seen ?? {}), ...Object.entries(f.stock).flatMap(([k, n]) => (n > 0 ? [k] : []))]);
  const have = COLLECTION.filter((k) => seen.has(k)).length;
  const claimed = f.colClaim ?? 0;
  return {
    seen,
    have,
    total: COLLECTION.length,
    claimable: Math.floor(have / COLLECTION_STEP) - claimed,
    nextAt: (claimed + 1) * COLLECTION_STEP,
    nextCoins: COLLECTION_COINS * (claimed + 1),
  };
}

// Pazar tezgâhı: seviyesi açılmış ham ürünler (tarla, hayvan, meyve) satış fiyatının iki katına, istenildiği kadar alınır.
// İki kat fiyat sayesinde alıp geri satmak kâr etmez; eksik malzemeyi tamamlamak içindir.
export const STALL_MULT = 2;
export const STALL_MAX = 50;
export const STALL_GOODS: { key: string; lvl: number }[] = [
  ...Object.entries(CROPS).map(([key, v]) => ({ key, lvl: v.lvl })),
  ...Object.keys(PRODUCTS).map((key) => ({
    key,
    lvl: Math.min(
      ...Object.values(ANIMALS)
        .filter((a) => a.products.includes(key))
        .map((a) => a.lvl),
    ),
  })),
  ...Object.entries(TREES).map(([key, v]) => ({ key, lvl: v.lvl })),
].sort((a, b) => a.lvl - b.lvl);
// Bir ürünün açıldığı seviye (ekin, hayvan ürünü, meyve ya da tarif).
export const unlockLvl = (key: string): number =>
  CROPS[key as CropId]?.lvl ??
  TREES[key as TreeId]?.lvl ??
  RECIPES[key as RecipeId]?.lvl ??
  STALL_GOODS.find((g) => g.key === key)?.lvl ??
  1;
// Bir seviyede açılan her şey (kutlama ekranı ve "sırada ne var" için). art: çizim anahtarı; yoksa emoji gösterilir.
export type Unlock = { name: string; art: string; emoji?: string };
export function unlocksAt(level: number): Unlock[] {
  const out: Unlock[] = [];
  for (const [k, v] of Object.entries(CROPS)) if (v.lvl === level) out.push({ name: v.name, art: k });
  for (const [k, v] of Object.entries(BUILDINGS)) if (v.lvl === level) out.push({ name: v.name, art: k });
  for (const [k, v] of Object.entries(ANIMALS)) if (v.lvl === level) out.push({ name: v.name, art: k });
  for (const [k, v] of Object.entries(TREES)) if (v.lvl === level) out.push({ name: v.name, art: k });
  for (const v of Object.values(DECOR)) if (v.lvl === level) out.push({ name: v.name, art: v.sp });
  for (const [k, v] of Object.entries(RECIPES)) if (v.lvl === level) out.push({ name: v.name, art: k, emoji: v.emoji });
  return out;
}
// Bu seviyeden sonra bir şey açılan ilk seviye (yoksa null).
export function nextUnlockLevel(level: number): number | null {
  for (let l = level + 1; l <= level + 30; l++) if (unlocksAt(l).length) return l;
  return null;
}
export const stallPrice = (key: string, n = 1) => (PRICE[key] ?? 0) * STALL_MULT * n;
// Dış arazi yalnızca çiftliğe bitişikse alınır: parselin bir karesi, açılmış bir kareye kenardan komşu olmalı.
export function parcelAdjacent(f: Farm, i: number): boolean {
  const open = (j: number) => !!f.tiles[j] && f.tiles[j].k !== 'locked';
  return parcelTiles(f, i).some((j) => {
    const c = j % N;
    return open(j - N) || open(j + N) || (c > 0 && open(j - 1)) || (c < N - 1 && open(j + 1));
  });
}
export const stockCount = (f: Farm) => Object.values(f.stock).reduce((a, b) => a + b, 0);
export const stockValue = (f: Farm, bonus = 1) =>
  Math.round(Object.entries(f.stock).reduce((a, [k, n]) => a + (PRICE[k] ?? 0) * n, 0) * bonus);
export const bigReady = (f: Farm, now: number) =>
  f.tiles.map((t, i) => (t.k === 'crop' && CROPS[t.crop].big && cropReady(t, now) ? i : -1)).filter((i) => i >= 0);

// ---------- Siparişler ----------
// Sipariş defteri: her siparişi kasabadan kurgusal bir çift verir; teslim edilince posta kutusuna almaya gelirler.
const ORDER_WOMEN = ['Elif', 'Zeynep', 'Defne', 'Ece', 'Selin', 'Nil', 'İpek', 'Derin', 'Azra', 'Melis', 'Ada', 'Lara'];
const ORDER_MEN = ['Can', 'Burak', 'Emre', 'Kerem', 'Deniz', 'Ozan', 'Alp', 'Tuna', 'Barış', 'Onur', 'Kaan', 'Efe'];
const hashOf = (id: string) => [...id].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
export const orderWho = (o: Order) => {
  if (o.who) return o.who;
  const h = hashOf(o.id);
  return `${ORDER_WOMEN[h % ORDER_WOMEN.length]} ve ${ORDER_MEN[(h >>> 5) % ORDER_MEN.length]}`;
};
// Çiftin şu an üretebildiği ürünlerden rastgele bir sipariş. Ödül: ham değerin 1,4 katı altın; her kalem 5 + her adet 3 tecrübe.
export function makeOrder(f: Farm, now: number, openAt = now): Order {
  const lv = levelOf(xpOf(f)).level;
  const pool: string[] = (Object.keys(CROPS) as CropId[]).filter((c) => CROPS[c].lvl <= lv && !CROPS[c].big);
  for (const t of f.tiles) {
    if (t.k === 'animal') for (const k of ANIMALS[t.item].products) if (!pool.includes(k)) pool.push(k);
    if (t.k === 'building') for (const r of t.res) for (const k of ANIMALS[r.id].products) if (!pool.includes(k)) pool.push(k);
    if (t.k === 'tree' && !pool.includes(t.item)) pool.push(t.item);
  }
  // Malzemesinin hepsi üretilebilen tarifler de sipariş edilebilir (mutfağa iş çıkar).
  const raw = [...pool];
  for (const [k, r] of Object.entries(RECIPES))
    if (r.lvl <= lv && hasStation(f, r.at ?? 'mutfak') && Object.keys(r.needs).every((x) => raw.includes(x) || pool.includes(x)))
      pool.push(k);
  const n = Math.min(pool.length, 1 + Math.floor(Math.random() * 3));
  const picks = [...pool].sort(() => Math.random() - 0.5).slice(0, n);
  const items: Record<string, number> = {};
  let value = 0;
  let qty = 0;
  for (const k of picks) {
    // 20. seviyeden sonra siparişler büyür.
    const q = 1 + Math.floor(Math.random() * ((PRICE[k] >= 40 ? 2 : 5) + (lv >= 20 ? 1 : 0)));
    items[k] = q;
    value += PRICE[k] * q;
    qty += q;
  }
  // 24. seviyeden sonra ara sıra özel sipariş gelir: ödülü iki katıdır.
  const special = lv >= SPECIAL_ORDER_LVL && Math.random() < 0.2;
  return {
    id: `${now.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
    items,
    given: {},
    by: [],
    // Özel sipariş: tecrübe iki kat, altın %40 fazla (toplam 1,96 kat; tezgâh fiyatının altında kalır).
    coins: Math.round(value * 1.4 * (special ? 1.4 : 1)),
    xp: (5 * picks.length + 3 * qty) * (special ? 2 : 1),
    ...(special ? { special: true } : {}),
    // Her dört siparişten biri ödül olarak bir balta da verir.
    ...(Math.random() < 0.25 ? { tool: (Math.random() < 0.65 ? 'balta' : 'kazma') as ToolId } : {}),
    openAt,
    who: `${ORDER_WOMEN[Math.floor(Math.random() * ORDER_WOMEN.length)]} ve ${ORDER_MEN[Math.floor(Math.random() * ORDER_MEN.length)]}`,
  };
}
export const orderDone = (o: Order) => Object.entries(o.items).every(([k, q]) => (o.given[k] ?? 0) >= q);
export const orderLeft = (o: Order) => Object.fromEntries(Object.entries(o.items).map(([k, q]) => [k, Math.max(0, q - (o.given[k] ?? 0))]));
// Depodan bu siparişe verilebilecek adet (kısmi teslim olur).
export const canGive = (f: Farm, o: Order) => Object.entries(orderLeft(o)).reduce((a, [k, q]) => a + Math.min(q, f.stock[k] ?? 0), 0);
// ---------- Haftalık büyük sipariş ----------
// Her pazartesi kasaba pazarından büyük bir sipariş gelir: çok miktarda birkaç ekin. İkiniz hafta boyunca birlikte doldurursunuz;
// tamamlanınca ödül o an verilir. İkiniz de katkı verdiyseniz altın %25 fazla olur ve iki ortak hasat sayılır.
export type BigOrder = {
  week: string; // haftanın pazartesi günü
  items: Record<string, number>;
  given: Record<string, number>;
  by: Record<string, number>; // kişi → verdiği adet
  coins: number;
  xp: number;
  done?: number;
};
export const BIG_BOTH = 1.25;
const monday = (now: number) => {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
};
export const weekKey = (now: number) => dayKey(monday(now));
export const weekEnd = (now: number) => {
  const d = monday(now);
  d.setDate(d.getDate() + 7);
  return d.getTime();
};
// Bu haftanın siparişi: kayıtlıysa o, değilse seviyeye göre haftadan türetilir (iki telefonda aynı çıkar).
export function bigOrderOf(f: Farm, now: number): BigOrder {
  const week = weekKey(now);
  if (f.big?.week === week) return f.big;
  const lv = levelOf(xpOf(f)).level;
  const cand = (Object.keys(CROPS) as CropId[])
    .filter((k) => CROPS[k].lvl <= lv)
    .sort((a, b) => hashOf(week + a) - hashOf(week + b))
    .slice(0, lv >= 8 ? 4 : 3);
  const items: Record<string, number> = {};
  let value = 0;
  let xp = 20;
  for (const k of cand) {
    const c = CROPS[k];
    const q = Math.max(6, Math.min(36, Math.round(360 / c.mins))) + Math.min(lv, 10);
    items[k] = q;
    value += c.sell * q;
    xp += c.xp * q;
  }
  return { week, items, given: {}, by: {}, coins: Math.round(value * 1.6), xp: Math.round(xp * 1.5) };
}
export const bigLeft = (o: BigOrder) =>
  Object.fromEntries(Object.entries(o.items).map(([k, q]) => [k, Math.max(0, q - (o.given[k] ?? 0))]));
export const bigCanGive = (f: Farm, o: BigOrder) => Object.entries(bigLeft(o)).reduce((a, [k, q]) => a + Math.min(q, f.stock[k] ?? 0), 0);

// Pano hep ORDER_SLOTS sipariş tutar; eksikse üretilir.
export function fillOrders(f: Farm, now: number) {
  const slots = orderSlots(levelOf(xpOf(f)).level);
  while (f.orders.length < slots) f.orders.push(makeOrder(f, now));
}
export const notesToday = (f: Farm, uid: string, now = Date.now()) =>
  f.notes.filter((n) => n.by === uid && dayKey(new Date(n.at)) === dayKey(new Date(now))).length;

export const cropReady = (t: Extract<Tile, { k: 'crop' }>, now: number) => now >= t.ready;
export const animalReady = (t: Extract<Tile, { k: 'animal' }>, now: number) => now >= t.last + ANIMALS[t.item].mins * MIN;
export const treeReadyAt = (t: Extract<Tile, { k: 'tree' }>) =>
  t.last === t.at ? t.at + TREES[t.item].first * MIN : t.last + TREES[t.item].mins * MIN;
export const treeReady = (t: Extract<Tile, { k: 'tree' }>, now: number) => now >= treeReadyAt(t);

export function timeLeft(ms: number) {
  const m = Math.max(0, Math.ceil(ms / MIN));
  if (m >= 60) return `${Math.floor(m / 60)} sa${m % 60 ? ` ${m % 60} dk` : ''}`;
  return `${m} dk`;
}

export function readyTiles(f: Farm, now: number) {
  return f.tiles
    .map((t, i) =>
      (t.k === 'crop' && cropReady(t, now)) ||
      (t.k === 'animal' && animalReady(t, now)) ||
      (t.k === 'tree' && treeReady(t, now)) ||
      (t.k === 'building' && t.res.some((r) => residentReady(r, now)))
        ? i
        : -1,
    )
    .filter((i) => i >= 0);
}

export function farmSummary(f: Farm, uid: string, now = Date.now()) {
  let canWater = 0;
  for (const t of f.tiles) if (t.k === 'crop' && !cropReady(t, now) && t.by !== uid && !t.watered) canWater++;
  return {
    ready: readyTiles(f, now).length,
    canWater,
    fields: f.tiles.filter((t) => t.k === 'soil' || t.k === 'crop').length,
    big: bigReady(f, now).length,
    stock: stockCount(f),
    hungry: f.tiles.reduce((n, t) => n + (t.k === 'building' ? t.res.filter((r) => needsFeed(r.id) && r.fed === null).length : 0), 0),
  };
}

// ---------- Hamleler ----------

export type Action =
  | { a: 'plant'; i: number; crop: CropId }
  | { a: 'water'; i: number }
  | { a: 'harvest'; i: number }
  | { a: 'collect'; i: number }
  | { a: 'till'; i: number }
  | { a: 'pave'; i: number } // çimene patika taşı döşe
  // Çiftçi pazarı (çiftler arası): ilanın kendisi market koleksiyonunda durur, bunlar çiftliğin depo/altın tarafıdır (market.ts).
  | { a: 'mkOut'; i: number; key: string; n: number } // ilana konan ürün depodan çıkar
  | { a: 'mkBack'; i: number; key: string; n: number } // satılmayan ilan depoya döner
  | { a: 'mkIn'; i: number; key: string; n: number; cost: number } // başka çiftlikten alınan ürün
  | { a: 'mkPaid'; i: number; key: string; n: number; coins: number } // satılan ilanın bedeli
  | { a: 'trader'; i: number; key: string; n: number; cost: number; offer: string; day: string } // gezgin tüccardan alım
  | { a: 'stall'; i: number; key: string; n: number } // pazar tezgâhından alım
  | { a: 'rename'; i: number; name: string } // çiftlik adı
  | { a: 'nameDog'; i: number; name: string } // köpeğin adı
  | { a: 'chop'; i: number } // yabani ağaç/çalı/kayayı aletle temizle
  | { a: 'tool'; i: number; key: ToolId; n: number } // pazardan balta/kazma al
  | { a: 'depotUp'; i: number } // depoyu büyüt
  | { a: 'visitOpen'; i: number; open: boolean } // çiftlik ziyarete açık/kapalı
  | { a: 'colClaim'; i: number } // koleksiyon ödülünü al
  | { a: 'sellOne'; i: number; key: string; n: number } // depodan tek ürün sat
  | { a: 'release'; i: number; idx: number } // binadaki hayvanı geri ver (yarı fiyat)
  | { a: 'skipOrder'; i: number; order: string } // siparişi geri çevir; yenisi biraz sonra yazılır
  | { a: 'bloom'; i: number; all?: boolean } // çit/duvarın dibine çiçek ek ya da çiçekleri kaldır
  | { a: 'animal'; i: number; item: AnimalId }
  | { a: 'tree'; i: number; item: TreeId }
  | { a: 'pick'; i: number } // meyve topla
  | { a: 'build'; i: number; item: BuildingId } // çimene bina kur
  | { a: 'adopt'; i: number; item: AnimalId } // binaya hayvan al (i: bina karesi)
  | { a: 'feed'; i: number } // binadaki aç hayvanları yemle
  | { a: 'gather'; i: number } // binadaki hazır ürünleri topla
  | { a: 'decor'; i: number; item: DecorId }
  | { a: 'unlock'; i: number }
  | { a: 'remove'; i: number }
  // Yerini değiştir: from karesindeki ağaç/bina/süs/hayvan/tarla i karesine (boş çimen) taşınır; süreler korunur.
  | { a: 'move'; i: number; from: number }
  // Hasat günü: iki kişilik sahne canlıyken bütün hazır büyük ürünler toplanır.
  | { a: 'harvestDay'; i: number; scene: string }
  // Depoyu sat; pazar sahnesi canlıysa (hafta sonu, ikiniz) bir buçuk kat.
  | { a: 'sell'; i: number; scene?: string }
  // Siparişe depodan teslim (kısmi olabilir); tamamlanınca ödül, ikisi de katkı yaptıysa ortak hasat.
  | { a: 'deliver'; i: number; order: string }
  | { a: 'bigGive'; i: number } // haftalık büyük siparişe depodan ürün ver
  | { a: 'handover'; i: number; order: string }
  // Mutfak: depodaki ürünlerden tarif yap.
  | { a: 'cook'; i: number; recipe: RecipeId }
  // Süresi dolan üretimi mutfaktan topla (job verilmezse hazır olanların hepsi).
  | { a: 'collectProd'; i: number; job?: string; at?: Station }
  // Hediye sepeti hazırla ve partnere gönder / gelen sepeti aç.
  | { a: 'gift'; i: number; basket: BasketId }
  | { a: 'openGift'; i: number; gift: string }
  // Not Ağacı'na not.
  | { a: 'note'; i: number; text: string }
  // Depoyu (2x2) taşı: i, yeni yerin ön köşesi (sağ alt kare); dört karenin de boş çimen olması gerekir.
  | { a: 'moveBarn'; i: number; what?: 'house' } // what: 'house' ise ev taşınır
  // Öpücük: i, partnerin yanındaki kare; avatar oraya yürür ve iki ekranda da kalpler uçar.
  | { a: 'kiss'; i: number };

export type Result = { farm: Farm; text: string; gained: number; ready?: number; points?: number; drop?: { art: string; text: string } };
// Hasatta arada bir sürpriz çıkar: alet ya da altın kesesi. Zar kareden ve ekim zamanından türetilir; yerel deneme ile kayıt aynı sonucu verir.
export const DROP_TOOL = 4; // %
export const DROP_COINS = 6; // %

// Hayvan, ağaç ve süs yalnız çayıra (çimene) konur; tarla ekin içindir.
const emptyOk = (t: Tile) => t.k === 'grass';
// Sera: çevresindeki SERA_RANGE kare içindeki tarlalara ekilen ekin daha çabuk büyür.
export const SERA_RANGE = 2;
export const SERA_FACTOR = 0.75;
// Eskiden değirmen ekmek ve keki çift çıkarırdı; un zinciri gelince kaldırıldı (liste boş).
export const MILL_RECIPES: string[] = [];
// Bir malzemenin nereden geldiği (tarif panelinde eksik malzemenin yanında yazar).
export function sourceOf(k: string, f?: Farm): string {
  if (CROPS[k as CropId]) return 'tarlaya ekilir';
  if (RECIPES[k as RecipeId]) return `${STATIONS[stationOf(k as RecipeId, f)].inn} yapılır`;
  const from = (Object.keys(ANIMALS) as AnimalId[]).filter((a) => ANIMALS[a].products.includes(k));
  if (from.length) {
    const who = from.map((a) => ANIMALS[a].name.toLocaleLowerCase('tr-TR')).join(' ya da ');
    const home = BUILDINGS[buildingFor(from[0])].name.toLocaleLowerCase('tr-TR');
    return from[0] === 'ari' ? 'arı kovanından toplanır' : `${who} verir (${home})`;
  }
  if (TREES[k as TreeId]) return 'ağaçtan toplanır';
  return 'depodan';
}
export const hasStation = (f: Farm, st: Station) => st === 'mutfak' || f.tiles.some((x) => x.k === 'decor' && (x.item as string) === st);
// Bir üretim yerinin işleri. Yeri kaldırılmış atölyenin yarım işleri mutfakta görünür ki toplanabilsin.
export const stationJobs = (f: Farm, st: Station) =>
  (f.prod ?? []).filter((j) => {
    const at = j.st ?? stationOf(j.recipe);
    return at === st || (st === 'mutfak' && !hasStation(f, at));
  });
export function nearDecor(f: Farm, i: number, item: DecorId, range: number): boolean {
  const r0 = Math.floor(i / N);
  const c0 = i % N;
  for (let r = Math.max(0, r0 - range); r <= Math.min(N - 1, r0 + range); r++)
    for (let c = Math.max(0, c0 - range); c <= Math.min(N - 1, c0 + range); c++) {
      const t = f.tiles[r * N + c];
      if (t?.k === 'decor' && t.item === item) return true;
    }
  return false;
}

// Saf kural fonksiyonu: hata mesajı ya da yeni çiftlik döner.
export function applyAction(
  f0: Farm,
  act: Action,
  uid: string,
  partnerName: (by: string) => string,
  name: string,
  now: number,
  live?: { kind: string } | null, // doğrulanmış canlı sahne (hasat günü / pazar)
): Result | string {
  const f: Farm = {
    ...f0,
    xm: f0.xm ?? f0.xp,
    tiles: [...f0.tiles],
    log: [...f0.log],
    pos: { ...f0.pos },
    stock: { ...f0.stock },
    orders: f0.orders.map((o) => ({ ...o, given: { ...o.given }, by: [...o.by] })),
    notes: [...f0.notes],
    gifts: [...(f0.gifts ?? [])],
    giftAt: { ...(f0.giftAt ?? {}) },
  };
  const take = (needs: Record<string, number>) => {
    for (const [k, n] of Object.entries(needs)) {
      f.stock[k] = (f.stock[k] ?? 0) - n;
      if (f.stock[k] <= 0) delete f.stock[k];
    }
  };
  let points: number | undefined;
  // Kurma tecrübesi: bu türden çiftlikte hiç bu kadar olmadıysa verilir. count: kurulduktan sonraki adet.
  const firstXp = (key: string, count: number, xp: number) => {
    const dx = { ...(f.dx ?? {}) };
    // Eski kayıtlarda sayaç yok: o türün şu anki adedi (kurulmadan önceki) başlangıç sayılır.
    const seen = dx[key] ?? count - 1;
    if (count > seen) {
      f.xp += xp;
      dx[key] = count;
    } else dx[key] = seen;
    f.dx = dx;
  };
  const countOf = (pred: (x: Tile) => boolean) => f.tiles.filter(pred).length;
  const put = (k: string, n = 1) => {
    f.stock[k] = (f.stock[k] ?? 0) + n;
    if (!f.seen?.[k]) f.seen = { ...f.seen, [k]: 1 }; // koleksiyona işlenir
  };
  fillOrders(f, now);
  const t = f.tiles[act.i];
  if (!t) return 'Böyle bir yer yok.';
  // Depo sınırı: dolu depoya yeni ürün girmez (tek işlem sınırı aşabilir; hasat yarım kalmaz).
  if (FILLS_DEPOT.includes(act.a) && depotUsed(f) >= depotCap(f))
    return `Depo dolu (${depotUsed(f)}/${depotCap(f)}). Bir şeyler sat, siparişe ver ya da depoyu büyüt.`;
  const lv = levelOf(xpOf(f)).level;
  let text = '';
  let gained = 0;
  let ready: number | undefined;
  let drop: Result['drop'];

  switch (act.a) {
    case 'plant': {
      const c = CROPS[act.crop];
      if (t.k !== 'soil') return 'Burası ekime hazır değil.';
      if (lv < c.lvl) return `${c.name} ${c.lvl}. seviyede açılır.`;
      if (f.coins < c.cost) return 'Yeterli altının yok.';
      f.coins -= c.cost;
      const season = seasonOf(now);
      const sera = nearDecor(f, act.i, 'sera', SERA_RANGE);
      ready = now + Math.round(c.mins * MIN * growFactor(season) * (sera ? SERA_FACTOR : 1));
      f.tiles[act.i] = { k: 'crop', crop: act.crop, by: uid, at: now, ready };
      text = `${name} ${c.name.toLowerCase()} ekti${sera ? ' (sera yanında hızlı büyür)' : ''}`;
      break;
    }
    case 'water': {
      if (t.k !== 'crop') return 'Burada sulanacak bir şey yok.';
      if (t.by === uid) return 'Kendi ektiğini partnerin sular.';
      if (t.watered) return 'Zaten sulandı.';
      if (cropReady(t, now)) return 'Bu ürün hasada hazır.';
      ready = now + Math.round((t.ready - now) / 2);
      f.tiles[act.i] = { ...t, watered: uid, ready };
      text = `${name}, ${partnerName(t.by)} ${CROPS[t.crop].name.toLowerCase()} ürününü suladı 💧`;
      break;
    }
    case 'harvest': {
      if (t.k !== 'crop') return 'Hasat edilecek ürün yok.';
      if (!cropReady(t, now)) return 'Henüz olmadı.';
      const c = CROPS[t.crop];
      f.xp += c.xp;
      put(t.crop);
      if (t.watered) f.harvests += 1; // biri ekti, diğeri suladı: ortak hasat
      f.tiles[act.i] = { k: 'soil' };
      const roll = hashOf(`${act.i}:${t.at}:${t.crop}`) % 100;
      if (roll < DROP_TOOL) {
        const tool: ToolId = roll % 2 ? 'kazma' : 'balta';
        f.tools = { ...toolsOf(f), [tool]: toolsOf(f)[tool] + 1 };
        drop = { art: tool, text: `+1 ${TOOLS[tool].name}` };
      } else if (roll < DROP_TOOL + DROP_COINS) {
        const n = 8 + 2 * levelOf(xpOf(f)).level;
        f.coins += n;
        drop = { art: 'coin', text: `+${n} altın` };
      }
      text = `${name} ${c.name.toLowerCase()} topladı${t.watered ? ' · ortak hasat' : ''}`;
      break;
    }
    case 'collect': {
      if (t.k !== 'animal') return 'Burada hayvan yok.';
      if (!animalReady(t, now)) return 'Henüz hazır değil.';
      const an = ANIMALS[t.item];
      f.xp += an.xp;
      for (const k of an.products) put(k);
      f.tiles[act.i] = { ...t, last: now };
      text = `${name} ${productNames(t.item)} topladı`;
      break;
    }
    case 'till': {
      if (t.k !== 'grass') return 'Burası çimen değil.';
      if (f.coins < TILL) return 'Yeterli altının yok.';
      f.coins -= TILL;
      f.tiles[act.i] = { k: 'soil' };
      firstXp(
        '_soil',
        countOf((x) => x.k === 'soil' || x.k === 'crop'),
        1,
      );
      text = `${name} yeni tarla sürdü`;
      break;
    }
    case 'bloom': {
      if (t.k !== 'decor' || !DECOR[t.item].wall) return 'Çiçek çit ya da duvarın dibine ekilir.';
      const from = t.item;
      const d = DECOR[from];
      const other = (Object.keys(DECOR) as DecorId[]).find((id) => DECOR[id].wall === d.wall && !!DECOR[id].flowers !== !!d.flowers)!;
      // all: çiftlikteki aynı türden bütün parçalar birlikte çevrilir.
      const ids = act.all ? f.tiles.flatMap((x, j) => (x.k === 'decor' && x.item === from ? [j] : [])) : [act.i];
      if (!d.flowers) {
        if (f.coins < BLOOM * ids.length) return `Yeterli altının yok (${BLOOM * ids.length} gerek).`;
        f.coins -= BLOOM * ids.length;
      }
      ids.forEach((j) => (f.tiles[j] = { ...(f.tiles[j] as Extract<Tile, { k: 'decor' }>), item: other }));
      text = d.flowers ? `${name} çiçekleri kaldırdı` : `${name} ${d.name.toLocaleLowerCase('tr-TR')} dibine çiçek ekti 🌸`;
      break;
    }
    case 'mkOut': {
      if (!PRICE[act.key] || act.n < 1 || (f.stock[act.key] ?? 0) < act.n) return 'Depoda o kadar ürün yok.';
      take({ [act.key]: act.n });
      text = `${name} pazara ${act.n} ${PRODUCT_NAME[act.key].toLocaleLowerCase('tr-TR')} koydu`;
      break;
    }
    case 'mkBack': {
      put(act.key, act.n);
      text = `Satılmayan ${act.n} ${(PRODUCT_NAME[act.key] ?? 'ürün').toLocaleLowerCase('tr-TR')} pazardan depoya döndü`;
      break;
    }
    case 'mkIn': {
      if (f.coins < act.cost) return 'Yeterli altının yok.';
      f.coins -= act.cost;
      put(act.key, act.n);
      text = `${name} çiftçi pazarından ${act.n} ${(PRODUCT_NAME[act.key] ?? 'ürün').toLocaleLowerCase('tr-TR')} aldı (${act.cost} altın)`;
      break;
    }
    case 'mkPaid': {
      f.coins += act.coins;
      gained = act.coins;
      text = `Pazarda ${act.n} ${(PRODUCT_NAME[act.key] ?? 'ürün').toLocaleLowerCase('tr-TR')} satıldı: +${act.coins} altın 🧺`;
      break;
    }
    case 'trader': {
      const got = f.trader?.day === act.day ? f.trader.got : [];
      if (got.includes(act.offer)) return 'Bu teklifi bugün zaten aldınız.';
      if (f.coins < act.cost) return 'Yeterli altının yok.';
      f.coins -= act.cost;
      put(act.key, act.n);
      f.trader = { day: act.day, got: [...got, act.offer] };
      text = `${name} gezgin tüccardan ${act.n} ${(PRODUCT_NAME[act.key] ?? 'ürün').toLocaleLowerCase('tr-TR')} aldı (${act.cost} altın)`;
      break;
    }
    case 'stall': {
      const good = STALL_GOODS.find((g) => g.key === act.key);
      const n = Math.floor(act.n);
      if (!good || !(n >= 1 && n <= STALL_MAX)) return 'Bu ürün tezgâhta yok.';
      if (levelOf(xpOf(f)).level < good.lvl) return `Bu ürün ${good.lvl}. seviyede açılır.`;
      const cost = stallPrice(act.key, n);
      if (f.coins < cost) return 'Yeterli altının yok.';
      f.coins -= cost;
      put(act.key, n);
      text = `${name} pazar tezgâhından ${n} ${(PRODUCT_NAME[act.key] ?? 'ürün').toLocaleLowerCase('tr-TR')} aldı (${cost} altın)`;
      break;
    }
    case 'rename': {
      const nm = act.name.trim().slice(0, 22);
      if (nm.length < 3) return 'Çiftlik adı en az 3 harf olmalı.';
      f.name = nm;
      text = `${name} çiftliğe ad verdi: ${nm}`;
      break;
    }
    case 'nameDog': {
      const nm = act.name.trim().slice(0, 14);
      if (nm.length < 2) return 'Köpeğin adı en az 2 harf olmalı.';
      f.dog = nm;
      text = `${name} köpeğe ad verdi: ${nm}`;
      break;
    }
    case 'pave': {
      if (t.k !== 'grass') return 'Patika boş çimene döşenir.';
      if (f.coins < PAVE) return 'Yeterli altının yok.';
      f.coins -= PAVE;
      f.tiles[act.i] = { k: 'path' };
      text = `${name} patika döşedi`;
      break;
    }
    case 'animal': {
      // Eski yol: hayvan artık çimene değil binaya alınır.
      const an = ANIMALS[act.item];
      return `${an.name} ${BUILDINGS[buildingFor(act.item)].name.toLowerCase()}te yaşar; dükkândan önce bina kur.`;
    }
    case 'decor': {
      const d = DECOR[act.item];
      if (!emptyOk(t)) return 'Süsler çimene konur; boş bir çimen seç.';
      if (lv < d.lvl) return `${d.name} ${d.lvl}. seviyede açılır.`;
      if (d.station && f.tiles.some((x) => x.k === 'decor' && x.item === act.item))
        return `Çiftlikte zaten bir ${d.name.toLocaleLowerCase('tr-TR')} var.`;
      if (f.coins < d.cost) return 'Yeterli altının yok.';
      f.coins -= d.cost;
      f.tiles[act.i] = { k: 'decor', item: act.item };
      firstXp(
        act.item,
        countOf((x) => x.k === 'decor' && x.item === act.item),
        d.xp,
      );
      text = `${name} bahçeye ${d.name.toLowerCase()} koydu`;
      break;
    }
    case 'unlock': {
      if (t.k !== 'locked') return 'Bu arazi zaten açık.';
      if (isOuter(act.i)) {
        // dış arazi: altınla satın alınır
        const price = outerPrice(f);
        if (!parcelAdjacent(f, act.i)) return 'Bu arazi çiftliğe bitişik değil; önce aradaki araziyi al.';
        if (f.coins < price) return `Bu arazi ${price} altın; ${price - f.coins} altın eksik.`;
        f.coins -= price;
        f.outer = (f.outer ?? 0) + 1;
        const ids = parcelTiles(f0, act.i);
        ids.forEach((j) => {
          const w = wildAt(j);
          f.tiles[j] = w ? { k: 'wild', item: w } : { k: 'grass' };
        });
        f.xp += 8;
        text = `${name} yeni arazi satın aldı: ${ids.length} kare 🌿`;
        break;
      }
      const need = parcelNeed(f);
      if (f.harvests < need) return `Bu arazi ${need}. ortak hasatta açılır (${f.harvests}/${need}).`;
      f.bought = (f.bought || 0) + 1;
      const ids = parcelTiles(f0, act.i);
      ids.forEach((j) => (f.tiles[j] = { k: 'soil' }));
      f.xp += 5;
      text = `${name} yeni araziyi açtı: ${ids.length} tarla daha 🌱`;
      break;
    }
    case 'remove': {
      // Tarla (boş ya da ekili) yeniden çimene çevrilir; ekiliyse ekin gider, para dönmez.
      if (t.k === 'soil' || t.k === 'crop') {
        f.tiles[act.i] = { k: 'grass' };
        text = `${name} bir tarlayı çimene çevirdi`;
        break;
      }
      if (t.k === 'path') {
        if (act.i === giftTile(f)) return 'Sepet tezgâhı kalkmaz; taşıyabilirsin.';
        f.tiles[act.i] = { k: 'grass' };
        text = `${name} bir patikayı kaldırdı`;
        break;
      }
      if (t.k !== 'animal' && t.k !== 'decor' && t.k !== 'tree' && t.k !== 'building') return 'Kaldırılacak bir şey yok.';
      if (act.i === noteTile(f)) return 'Not Ağacı kalkmaz; notlarınız orada.';
      if (t.k === 'building' && t.res.length) return 'İçinde hayvan varken bina kaldırılmaz.';
      const cost =
        t.k === 'animal'
          ? ANIMALS[t.item].cost
          : t.k === 'tree'
            ? TREES[t.item].cost
            : t.k === 'building'
              ? BUILDINGS[t.item].cost
              : DECOR[t.item].cost;
      gained = Math.floor(cost / 2);
      f.coins += gained;
      f.tiles[act.i] = { k: 'grass' };
      text = `${name} bir yeri boşalttı`;
      break;
    }
    case 'move': {
      // Hediye sepeti tezgâhı: bir taş zeminin üstünde durur; yeni yerine taş döşenir, eski yerdeki taş kalır.
      if (act.from === giftTile(f)) {
        if (act.i === act.from) return 'Zaten orada.';
        if (!emptyOk(t)) return 'Boş bir çimene taşıyabilirsin.';
        f.tiles[act.i] = { k: 'path' };
        f.giftSpot = act.i;
        text = `${name} sepet tezgâhını taşıdı`;
        break;
      }
      const src = f.tiles[act.from];
      const field = !!src && (src.k === 'soil' || src.k === 'crop'); // tarla (boş ya da ekili) da taşınır; ekinin süresi korunur
      if (!src || (!field && src.k !== 'path' && src.k !== 'animal' && src.k !== 'decor' && src.k !== 'tree' && src.k !== 'building'))
        return 'Taşınacak bir şey yok.';
      if (act.i === act.from) return 'Zaten orada.';
      if (!emptyOk(t)) return 'Boş bir çimene taşıyabilirsin.';
      f.tiles[act.i] = src;
      f.tiles[act.from] = { k: 'grass' };
      if (act.from === noteTile(f)) f.noteAt = act.i; // Not Ağacı: notlar ağaçla birlikte gider
      const what =
        src.k === 'soil' || src.k === 'crop'
          ? 'Tarlayı'
          : src.k === 'path'
            ? 'Patikayı'
            : src.k === 'animal'
              ? ANIMALS[src.item].name
              : src.k === 'tree'
                ? TREES[src.item].name
                : src.k === 'building'
                  ? BUILDINGS[src.item].name
                  : DECOR[src.item].name;
      text = `${name} ${what.toLocaleLowerCase('tr-TR')} taşıdı`;
      break;
    }
    case 'tree': {
      const tr = TREES[act.item];
      if (!emptyOk(t)) return 'Ağaç çayıra dikilir; boş bir çimen seç.';
      if (lv < tr.lvl) return `${tr.name} ${tr.lvl}. seviyede açılır.`;
      if (f.coins < tr.cost) return 'Yeterli altının yok.';
      f.coins -= tr.cost;
      f.tiles[act.i] = { k: 'tree', item: act.item, at: now, last: now };
      firstXp(
        act.item,
        countOf((x) => x.k === 'tree' && x.item === act.item),
        2,
      );
      ready = now + tr.first * MIN;
      text = `${name} ${tr.name.toLowerCase()} dikti 🌳`;
      break;
    }
    case 'pick': {
      if (t.k !== 'tree') return 'Burada ağaç yok.';
      if (!treeReady(t, now)) return 'Meyveler henüz olmadı.';
      const tr = TREES[t.item];
      put(t.item, tr.yieldN);
      f.xp += tr.xp;
      f.tiles[act.i] = { ...t, last: now };
      text = `${name} ${tr.yieldN} ${tr.fruit.toLowerCase()} topladı`;
      break;
    }
    case 'build': {
      const b = BUILDINGS[act.item];
      if (!emptyOk(t)) return `${b.name} çimene kurulur; boş bir çimen seç.`;
      if (lv < b.lvl) return `${b.name} ${b.lvl}. seviyede açılır.`;
      if (f.coins < b.cost) return 'Yeterli altının yok.';
      f.coins -= b.cost;
      // Çimende başıboş duran uygun hayvanlar binaya taşınır.
      const res: Resident[] = [];
      f.tiles.forEach((x, j) => {
        if (x.k === 'animal' && b.animals.includes(x.item) && res.length < b.cap) {
          res.push({ id: x.item, fed: null, last: x.last });
          f.tiles[j] = { k: 'grass' };
        }
      });
      f.tiles[act.i] = { k: 'building', item: act.item, res };
      firstXp(
        act.item,
        countOf((x) => x.k === 'building' && x.item === act.item),
        5,
      );
      text = `${name} ${b.name.toLowerCase()} kurdu${res.length ? `; ${res.length} hayvan içeri taşındı` : ''} 🏡`;
      break;
    }
    case 'adopt': {
      if (t.k !== 'building') return 'Önce bina kur.';
      const b = BUILDINGS[t.item];
      const an = ANIMALS[act.item];
      if (!b.animals.includes(act.item)) return `${an.name} burada yaşamaz.`;
      if (t.res.length >= b.cap) return `${b.name} dolu (${b.cap}).`;
      if (lv < an.lvl) return `${an.name} ${an.lvl}. seviyede açılır.`;
      if (f.coins < an.cost) return 'Yeterli altının yok.';
      f.coins -= an.cost;
      f.xp += 2;
      f.tiles[act.i] = { ...t, res: [...t.res, { id: act.item, fed: null, last: now }] };
      text = `${name} ${b.name.toLowerCase()}e ${an.name.toLowerCase()} aldı`;
      break;
    }
    case 'feed': {
      if (t.k !== 'building') return 'Burada hayvan yok.';
      const hungry = t.res.filter((r) => needsFeed(r.id) && r.fed === null);
      if (!hungry.length) return 'Hepsi tok.';
      let wheat = f.stock[FEED_CROP] ?? 0;
      let coins = 0;
      for (const r of hungry) {
        if (wheat > 0) wheat--;
        else if (f.coins - coins >= FEED_COINS) coins += FEED_COINS;
        else return `Yem için depoda buğday ya da ${FEED_COINS} altın gerek.`;
      }
      const used = (f.stock[FEED_CROP] ?? 0) - wheat;
      if (used > 0) f.stock[FEED_CROP] = wheat;
      if (f.stock[FEED_CROP] === 0) delete f.stock[FEED_CROP];
      f.coins -= coins;
      f.tiles[act.i] = { ...t, res: t.res.map((r) => (needsFeed(r.id) && r.fed === null ? { ...r, fed: now } : r)) };
      text = `${name} ${hungry.length} hayvanı yemledi${used ? ` (${used} buğday)` : ''}${coins ? ` (${coins} altın)` : ''}`;
      break;
    }
    case 'gather': {
      if (t.k !== 'building') return 'Burada hayvan yok.';
      const ready = t.res.filter((r) => residentReady(r, now));
      if (!ready.length) return 'Henüz hazır ürün yok.';
      const names = new Set<string>();
      for (const r of ready) {
        for (const k of ANIMALS[r.id].products) put(k);
        f.xp += ANIMALS[r.id].xp;
        names.add(productNames(r.id));
      }
      f.tiles[act.i] = { ...t, res: t.res.map((r) => (residentReady(r, now) ? { ...r, fed: null, last: now } : r)) };
      text = `${name} ${[...names].join(', ')} topladı`;
      break;
    }
    case 'harvestDay': {
      if (live?.kind !== 'harvest') return 'Hasat günü için önce ikiniz tarlada olmalısınız.';
      const ids = bigReady(f0, now);
      if (!ids.length) return 'Toplanacak büyük ürün yok.';
      const names = new Set<string>();
      for (const j of ids) {
        const tj = f0.tiles[j];
        if (tj.k !== 'crop') continue;
        put(tj.crop);
        f.xp += CROPS[tj.crop].xp;
        names.add(CROPS[tj.crop].name.toLowerCase());
        f.tiles[j] = { k: 'soil' };
      }
      f.harvests += ids.length;
      gained = ids.length;
      text = `Hasat günü: ikiniz ${ids.length} ${[...names].join(', ')} topladınız 🌾`;
      break;
    }
    case 'sell': {
      const n = stockCount(f);
      if (!n) return 'Depo boş.';
      const market = live?.kind === 'market';
      gained = stockValue(f, market ? MARKET_BONUS : 1);
      f.coins += gained;
      f.stock = {};
      text = market ? `Pazar günü: ${n} ürün tezgâhta ${gained} altına gitti 🧺` : `${name} ${n} ürünü ${gained} altına sattı`;
      break;
    }
    case 'chop': {
      if (t.k !== 'wild') return 'Burada temizlenecek bir şey yok.';
      const w = WILD[t.item];
      const have = toolsOf(f);
      if (have[w.tool] < 1) return `${TOOLS[w.tool].name} kalmadı; çiftçi pazarından alabilirsin.`;
      f.tools = { ...have, [w.tool]: have[w.tool] - 1 };
      f.xp += w.xp;
      f.tiles[act.i] = { k: 'grass' };
      text = `${name} ${w.name.toLocaleLowerCase('tr-TR')} temizledi`;
      break;
    }
    case 'visitOpen': {
      f.closed = !act.open;
      text = act.open ? `${name} çiftliği ziyarete açtı` : `${name} çiftliği ziyarete kapattı`;
      break;
    }
    case 'depotUp': {
      const cost = depotUpCost(f);
      if (f.coins < cost) return `Depoyu büyütmek ${cost} altın. ${cost - f.coins} altın eksik.`;
      f.coins -= cost;
      f.depotUp = (f.depotUp ?? 0) + 1;
      text = `${name} depoyu büyüttü: ${depotCap(f)} ürün alıyor`;
      break;
    }
    case 'colClaim': {
      const c = collectionOf(f);
      if (c.claimable <= 0) return `Sıradaki ödül ${c.nextAt} üründe; şu an ${c.have}.`;
      const step = (f.colClaim ?? 0) + 1;
      const coins = COLLECTION_COINS * step;
      f.coins += coins;
      f.colClaim = step;
      gained = coins;
      text = `${name} koleksiyon ödülünü aldı: +${coins} altın (${step * COLLECTION_STEP} ürün)`;
      break;
    }
    case 'tool': {
      const tl = TOOLS[act.key];
      const n = Math.floor(act.n);
      if (!tl || !TOOLS_ON.includes(act.key) || !(n >= 1 && n <= TOOL_MAX)) return 'Böyle bir alet yok.';
      const cost = tl.cost * n;
      if (f.coins < cost) return 'Yeterli altının yok.';
      f.coins -= cost;
      f.tools = { ...toolsOf(f), [act.key]: toolsOf(f)[act.key] + n };
      text = `${name} pazardan ${n} ${tl.name.toLocaleLowerCase('tr-TR')} aldı (${cost} altın)`;
      break;
    }
    case 'sellOne': {
      const n = Math.floor(act.n);
      const have = f.stock[act.key] ?? 0;
      if (!(n >= 1) || have < n || !PRICE[act.key]) return 'Depoda o kadar yok.';
      gained = PRICE[act.key] * n;
      f.coins += gained;
      take({ [act.key]: n });
      text = `${name} ${n} ${(PRODUCT_NAME[act.key] ?? 'ürün').toLocaleLowerCase('tr-TR')} sattı: +${gained} altın`;
      break;
    }
    case 'release': {
      if (t.k !== 'building') return 'Burada hayvan yok.';
      const r = t.res[act.idx];
      if (!r) return 'O hayvan artık burada değil.';
      gained = Math.floor(ANIMALS[r.id].cost / 2);
      f.coins += gained;
      f.tiles[act.i] = { ...t, res: t.res.filter((_, j) => j !== act.idx) };
      text = `${name} bir ${ANIMALS[r.id].name.toLocaleLowerCase('tr-TR')} geri verdi: +${gained} altın`;
      break;
    }
    case 'skipOrder': {
      const k = f.orders.findIndex((o) => o.id === act.order);
      if (k < 0) return 'Bu sipariş artık yok.';
      const o = f.orders[k];
      if (o.packed) return `${orderWho(o)} girişte bekliyor; önce teslim et.`;
      if (o.openAt > now) return 'Bu sipariş henüz açılmadı.';
      // Verilmiş ürünler depoya döner.
      for (const [key, n] of Object.entries(o.given)) if (n > 0) put(key, n);
      f.orders[k] = makeOrder(f, now, now + ORDER_REFILL);
      text = `${name}, ${orderWho(o)} siparişini geri çevirdi`;
      break;
    }
    case 'deliver': {
      const k = f.orders.findIndex((o) => o.id === act.order);
      if (k < 0) return 'Bu sipariş artık yok.';
      const o = f.orders[k];
      if (o.openAt > now) return 'Bu sipariş henüz açılmadı.';
      if (o.packed) return `${orderWho(o)} girişte bekliyor; yanlarına gidip teslim et.`;
      let moved = 0;
      for (const [key, left] of Object.entries(orderLeft(o))) {
        const n = Math.min(left, f.stock[key] ?? 0);
        if (n <= 0) continue;
        f.stock[key] = (f.stock[key] ?? 0) - n;
        if (f.stock[key] <= 0) delete f.stock[key];
        o.given[key] = (o.given[key] ?? 0) + n;
        moved += n;
      }
      if (!moved) return 'Depoda bu siparişe uygun ürün yok.';
      if (!o.by.includes(uid)) o.by.push(uid);
      if (orderDone(o)) {
        // Ürünler hazır: çift girişe gelir. Altın ve tecrübe elden teslimde (handover) kazanılır.
        o.packed = now;
        text = `${name}, ${orderWho(o)} siparişini hazırladı; almaya geliyorlar`;
      } else {
        const left = Object.values(orderLeft(o)).reduce((a, b) => a + b, 0);
        text = `${name} siparişe ${moved} ürün verdi; ${left} ürün kaldı`;
      }
      break;
    }
    case 'bigGive': {
      const b0 = bigOrderOf(f, now);
      if (b0.done) return 'Bu haftanın büyük siparişi tamamlandı; yenisi pazartesi gelir.';
      const o: BigOrder = { ...b0, given: { ...b0.given }, by: { ...b0.by } };
      let moved = 0;
      for (const [key, left] of Object.entries(bigLeft(o))) {
        const n = Math.min(left, f.stock[key] ?? 0);
        if (n <= 0) continue;
        f.stock[key] = (f.stock[key] ?? 0) - n;
        if (f.stock[key] <= 0) delete f.stock[key];
        o.given[key] = (o.given[key] ?? 0) + n;
        moved += n;
      }
      if (!moved) return 'Depoda büyük siparişe uygun ürün yok.';
      o.by[uid] = (o.by[uid] ?? 0) + moved;
      const left = Object.values(bigLeft(o)).reduce((a, b) => a + b, 0);
      if (left === 0) {
        const both = Object.keys(o.by).length >= 2;
        const coins = Math.round(o.coins * (both ? BIG_BOTH : 1));
        f.coins += coins;
        f.xp += o.xp;
        gained = coins;
        f.tools = { ...toolsOf(f), balta: toolsOf(f).balta + 2, kazma: toolsOf(f).kazma + 1 };
        if (both) f.harvests += 2;
        o.done = now;
        text = `${name} haftalık büyük siparişi tamamladı: +${coins} altın, 2 balta, 1 kazma${both ? ' · birlikte doldurdunuz 💛' : ''}`;
      } else text = `${name} büyük siparişe ${moved} ürün verdi; ${left} ürün kaldı`;
      f.big = o;
      break;
    }
    case 'handover': {
      const k = f.orders.findIndex((o) => o.id === act.order);
      if (k < 0) return 'Bu sipariş artık yok.';
      const o = f.orders[k];
      if (!o.packed || !orderDone(o)) return 'Bu sipariş henüz hazır değil.';
      f.coins += o.coins;
      f.xp += o.xp;
      gained = o.coins;
      if (o.tool) f.tools = { ...toolsOf(f), [o.tool]: toolsOf(f)[o.tool] + 1 };
      const both = o.by.length >= 2;
      if (both) f.harvests += 1;
      f.orders[k] = makeOrder(f, now, now + ORDER_REFILL);
      text = `${name}, ${orderWho(o)} siparişini teslim etti: +${o.coins} altın${o.tool ? ` ve 1 ${TOOLS[o.tool].name.toLocaleLowerCase('tr-TR')}` : ''}${both ? ' · ikiniz katkı verdiniz, ortak hasat sayıldı 💛' : ''}`;
      break;
    }
    case 'cook': {
      const r = RECIPES[act.recipe];
      if (!r) return 'Böyle bir tarif yok.';
      if (lv < r.lvl) return `${r.name} ${r.lvl}. seviyede açılır.`;
      const jobs = f.prod ?? [];
      const st = stationOf(act.recipe, f);
      if (!hasStation(f, st)) return `${r.name} için çiftlikte ${STATIONS[st].name.toLocaleLowerCase('tr-TR')} gerek.`;
      if (stationJobs(f, st).length >= stationSlots(st, lv))
        return `${STATIONS[st].name} dolu. Önce hazır olanları toplayın ya da bitmesini bekleyin.`;
      if (!hasAll(f, r.needs)) return `${r.name} için depoda ${needsText(r.needs)} gerek.`;
      take(r.needs);
      // MILL_RECIPES artık boş: her tarif tek çıkar.
      const n = MILL_RECIPES.includes(act.recipe) && f.tiles.some((x) => x.k === 'decor' && x.item === 'degirmen') ? 2 : 1;
      // 22. seviyeden sonra atölyeler (mutfak hariç) %20 hızlı çalışır.
      const dur = r.mins * MIN * (st !== 'mutfak' && lv >= WORKSHOP_FAST_LVL ? 0.8 : 1);
      f.prod = [
        ...jobs,
        { id: `${now.toString(36)}${jobs.length}`, recipe: act.recipe, by: uid, at: now, ready: now + Math.round(dur), n, st },
      ];
      text = `${name} ${st === 'mutfak' ? '' : `${STATIONS[st].inn} `}${r.name.toLocaleLowerCase('tr-TR')} yapmaya koydu ${r.emoji}`;
      break;
    }
    case 'collectProd': {
      const jobs = f.prod ?? [];
      const mine = act.at ? stationJobs(f, act.at) : jobs;
      const done = mine.filter((j) => j.ready <= now && (!act.job || j.id === act.job));
      if (!done.length) return 'Henüz hazır olan yok.';
      for (const j of done) {
        put(j.recipe, j.n);
        f.xp += RECIPES[j.recipe]?.xp ?? 0;
        gained += j.n;
      }
      f.prod = jobs.filter((j) => !done.includes(j));
      const names = [...new Set(done.map((j) => RECIPES[j.recipe]?.name.toLocaleLowerCase('tr-TR')))].join(', ');
      text = `${name} ${STATIONS[act.at ?? 'mutfak'].from} ${names} aldı`;
      gained = 0;
      break;
    }
    case 'gift': {
      const b = BASKETS[act.basket];
      if (!b) return 'Böyle bir sepet yok.';
      const wait = giftWait(f, uid, now);
      if (wait === 'pending') return 'Gönderdiğin sepet henüz açılmadı.';
      if (wait === 'day') return 'Günde bir sepet gönderebilirsin.';
      if (!hasAll(f, b.needs)) return `${b.name} için depoda ${needsText(b.needs)} gerek.`;
      take(b.needs);
      f.gifts = [...(f.gifts ?? []), { id: `${now}-${uid.slice(0, 4)}`, from: uid, kind: act.basket, at: now }];
      f.giftAt = { ...(f.giftAt ?? {}), [uid]: now };
      text = `${name} ${b.name.toLocaleLowerCase('tr-TR')} hazırlayıp gönderdi ${b.emoji}`;
      break;
    }
    case 'openGift': {
      const g = (f.gifts ?? []).find((x) => x.id === act.gift);
      if (!g) return 'Bu sepet artık yok.';
      if (g.from === uid) return 'Kendi gönderdiğin sepeti partnerin açar.';
      const b = BASKETS[g.kind];
      f.gifts = (f.gifts ?? []).filter((x) => x.id !== g.id);
      f.coins += b.coins;
      f.xp += b.xp;
      f.harvests += 1;
      gained = b.coins;
      points = b.points;
      text = `${name} ${b.name.toLocaleLowerCase('tr-TR')}ni açtı: +${b.coins} altın, +${b.points} puan · ortak hasat 💛`;
      break;
    }
    case 'moveBarn': {
      // Depo ya da ev (2x2): yeni yerin dört karesi boş çimen (ya da yapının kendi kareleri) olmalı.
      const item = act.what === 'house' ? 'house' : 'barn';
      const label = item === 'house' ? 'Ev' : 'Depo';
      const r0 = Math.floor(act.i / N);
      const c0 = act.i % N;
      const isIt = (x: Tile | undefined) => !!x && x.k === 'fixed' && x.item === item;
      const cells = [act.i, act.i - 1, act.i - N, act.i - N - 1];
      if (r0 < 1 || c0 < 1 || !cells.every((j) => f.tiles[j]?.k === 'grass' || isIt(f.tiles[j])))
        return `${label} için yan yana 2×2 boş çimen gerekir.`;
      if (act.i === (item === 'house' ? houseTile(f) : barnTile(f))) return `${label} zaten orada.`;
      f.tiles = f.tiles.map((x) => (isIt(x) ? ({ k: 'grass' } as Tile) : x));
      for (const j of cells) f.tiles[j] = { k: 'fixed', item };
      text = `${name} ${item === 'house' ? 'evi' : 'depoyu'} taşıdı`;
      break;
    }
    case 'kiss': {
      f.kiss = { by: uid, at: now };
      text = `${name} bir öpücük kondurdu 💋`;
      break;
    }
    case 'note': {
      if (act.i !== noteTile(f)) return 'Notlar yalnız Not Ağacı’na asılır.';
      const txt = act.text.trim().slice(0, NOTE_MAX);
      if (!txt) return 'Boş not olmaz.';
      if (notesToday(f0, uid, now) >= NOTES_PER_DAY) return 'Bugünlük notlar doldu.';
      f.notes = [{ by: uid, text: txt, at: now }, ...f.notes].slice(0, 40);
      text = `${name} Not Ağacı’na bir not astı 🍃`;
      break;
    }
  }
  // Pazar işleri bir kareye bağlı değil; avatar yerinde kalır.
  if (!['mkOut', 'mkBack', 'mkIn', 'mkPaid', 'trader', 'stall', 'tool', 'rename', 'sellOne', 'skipOrder'].includes(act.a))
    f.pos[uid] = restNear(f, act.i);
  f.log = [{ by: uid, text, at: now }, ...f.log].slice(0, 14);
  return { farm: f, text, gained, ready, points, drop };
}

// Firestore tanımsız alan kabul etmez.
const clean = <T>(x: T): T => JSON.parse(JSON.stringify(x));

export async function farmAction(coupleId: string, uid: string, name: string, partnerName: string, act: Action) {
  const ref = doc(db, 'couples', coupleId);
  const sceneId = act.a === 'harvestDay' || act.a === 'sell' ? act.scene : undefined;
  const res = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return 'Çift bulunamadı.';
    // İki kişilik sahne gerçekten canlı mı? (hasat günü, pazar)
    let live: { kind: string } | null = null;
    if (sceneId) {
      const sc = await tx.get(doc(db, 'couples', coupleId, 'scenes', sceneId));
      const d = sc.data() as { kind?: string; status?: string } | undefined;
      if (sc.exists() && d?.status === 'live' && d.kind) live = { kind: d.kind };
    }
    const r = applyAction(
      farmOf(snap.data() as Couple),
      act,
      uid,
      (by) => (by === uid ? 'kendi' : `${partnerName}’in`),
      name,
      srvNow(),
      live,
    );
    if (typeof r !== 'string') tx.update(ref, { ...farmWrite(r.farm), ...(r.points ? { points: increment(r.points) } : {}) });
    return r;
  });
  return res;
}

// Sıradaki işleri tek seferde uygular (animasyonsuz). Ekran kapanırken ya da uygulama arka plana geçerken kullanılır:
// telefon uygulamayı durdurmadan önce bekleyen ekme, sulama, toplama işleri tek yazmayla kaydedilir.
// İki kişilik sahne isteyen işler (hasat günü, pazar satışı) burada sahnesiz sayılır ve kendi kuralına göre reddedilebilir.
export async function farmFlush(coupleId: string, uid: string, name: string, partnerName: string, acts: Action[]): Promise<number> {
  if (!acts.length) return 0;
  const ref = doc(db, 'couples', coupleId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return 0;
    let farm = farmOf(snap.data() as Couple);
    let points = 0;
    let done = 0;
    for (const act of acts) {
      const r = applyAction(farm, act, uid, (by) => (by === uid ? 'kendi' : `${partnerName}’in`), name, srvNow(), null);
      if (typeof r === 'string') continue;
      farm = r.farm;
      points += r.points ?? 0;
      done++;
    }
    if (done) tx.update(ref, { ...farmWrite(farm), ...(points ? { points: increment(points) } : {}) });
    return done;
  });
}

// Günlük görevden biriken altını çiftliğe aktarır.
export async function collectDreamBank(coupleId: string, uid: string, name: string) {
  const ref = doc(db, 'couples', coupleId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return 0;
    const c = snap.data() as Couple;
    const bank = c.dreamBank ?? 0;
    if (bank <= 0) return 0;
    const f = farmOf(c);
    const farm: Farm = {
      ...f,
      coins: f.coins + bank,
      log: [{ by: uid, text: `${name} günlük görevden gelen ${bank} altını topladı`, at: Date.now() }, ...f.log].slice(0, 14),
    };
    tx.update(ref, { ...farmWrite(farm), dreamBank: 0 });
    return bank;
  });
}

// ---------- Yönetimden gelen çiftlik bonusu ----------
// Açılmamış paketler (en eskisi önce).
export function useFarmBonuses(coupleId: string | undefined): FarmBonus[] {
  const [list, setList] = useState<FarmBonus[]>([]);
  useEffect(() => {
    if (!coupleId) return;
    return onSnapshot(
      collection(db, 'couples', coupleId, 'bonuses'),
      (snap) =>
        setList(
          snap.docs
            .map((d) => ({ ...(d.data() as Omit<FarmBonus, 'id'>), id: d.id }))
            .filter((b) => !b.opened)
            .sort((a, b) => a.atMs - b.atMs),
        ),
      () => setList([]),
    );
  }, [coupleId]);
  return list;
}

// Paketi açar: içindekiler çiftliğe eklenir ve paket "açıldı" işaretlenir. İki telefondan aynı anda basılsa da bir kez işler.
export async function openFarmBonus(coupleId: string, uid: string, bonusId: string): Promise<string | null> {
  const coupleRef = doc(db, 'couples', coupleId);
  const bonusRef = doc(db, 'couples', coupleId, 'bonuses', bonusId);
  return runTransaction(db, async (tx) => {
    const b = await tx.get(bonusRef);
    const c = await tx.get(coupleRef);
    if (!b.exists() || !c.exists()) return null;
    const bonus = b.data() as Omit<FarmBonus, 'id'>;
    if (bonus.opened) return null;
    const farm = farmOf(c.data() as Couple);
    const clamp = (n: unknown, max: number) => Math.max(0, Math.min(max, Math.floor(Number(n) || 0)));
    const coins = clamp(bonus.coins, BONUS_MAX.coins);
    const xp = clamp(bonus.xp, BONUS_MAX.xp);
    const stock = { ...farm.stock };
    const given: Record<string, number> = {};
    for (const [k, n] of Object.entries(bonus.stock ?? {})) {
      const add = BONUS_ITEMS[k] ? clamp(n, BONUS_MAX.item) : 0;
      if (!add) continue;
      stock[k] = (stock[k] ?? 0) + add;
      given[k] = add;
    }
    const text = bonusText({ coins, xp, stock: given });
    const next: Farm = {
      ...farm,
      coins: farm.coins + coins,
      xp: farm.xp + xp,
      stock,
      log: [{ by: uid, text: `bir iz’den hediye: ${text}`, at: Date.now() }, ...farm.log].slice(0, 14),
    };
    tx.update(coupleRef, farmWrite(next));
    tx.update(bonusRef, { opened: { by: uid, atMs: Date.now() } });
    return text;
  });
}
