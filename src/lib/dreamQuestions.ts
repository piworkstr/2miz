// Hayal dünyalarında sahne bitince çıkan sorular. Her soru bir kez sorulur; cevaplar hayal defterine yazılır.
// Oyun bahane, konuşma amaç.

export type QBank = Record<string, string[]>;

export const QUESTIONS: QBank = {
  // ---- Mavi Yolculuk ----
  swim: [
    'Denize ilk kim atlar, kim kıyıdan bakar?',
    'Gerçekte hangi koyda sabah yüzmek istersin?',
    'Suyun altında görmek istediğin tek şey ne olurdu?',
    'Teknede sabah ilk işimiz ne olsun: kahve mi deniz mi?',
    'Çocukken denizle ilgili en güzel anın ne?',
  ],
  dinner: [
    'Teknede ilk akşam yemeğinde ne pişirelim?',
    'Yemekte hangi şarkı çalsın?',
    'Bir akşam yemeğine kimi davet ederdin, neden?',
    'Mutfakta kim ne yapar: biri pişirir, biri…?',
    'Tuttuğumuz balığı kim temizler, dürüst ol.',
  ],
  camp: [
    'Kamp ateşinde hangi şarkıyı söyleriz?',
    'Çadırda uyumak mı, güvertede yıldız altında mı?',
    'Kampta olmazsa olmazın ne: kahve, battaniye, kitap…?',
    'Bir gece hiç telefon olmasa ne konuşurduk?',
    'Ateş başında anlatacağın ilk hikâye ne olurdu?',
  ],
  sunset: [
    'Şu an yan yana olsaydık bana ne derdin?',
    'Gün batımını en çok nerede izlemek istersin?',
    'Bu yılın en güzel anı neydi?',
    'Birlikte görmek istediğin bir manzara söyle.',
    'Beni ilk gördüğünde aklından geçen neydi?',
  ],
  coffee_sea: [
    'Teknede sabah kahvesini kim yapar?',
    'Bugün gerçek hayatta birbirimize ne iyilik yapalım?',
    'Sabah ilk gördüğün şey ne olsun istersin?',
    'Bu sabah bir söz ver: küçük ve yapılabilir.',
  ],
  fish: ['Tuttuğun balığa bir isim ver.'],
  // ---- Sahilde Ev ----
  coffee: [
    'Bugün birbirimize ne iyilik yapalım?',
    'Evimizin terasından ne görünsün: deniz mi, dağ mı, kasaba mı?',
    'Sabah kahvesini kim hazırlar, kim bulaşığı yıkar?',
    'Bugün seni mutlu edecek tek küçük şey ne?',
    'Pazar sabahı ritüelimiz ne olsun?',
  ],
  beach: [
    'Emekli olunca hangi kasaba: Alaçatı, Bozcaada, Datça, başka?',
    'Deniz kenarında bir öğlen: kitap mı, uyku mu, yüzmek mi?',
    'Evin adı ne olsun?',
    'Komşularımız nasıl insanlar olsun?',
    'Bisikletle gideceğimiz ilk yer neresi?',
  ],
  bbq: [
    'İlk misafirimiz kim olsun?',
    'Mangalda kim pişirir, kim salata yapar?',
    'Akşam sofrasında olmazsa olmaz ne?',
    'Evde bir köşe yalnız senin olsa ne yapardın?',
    'Yaz akşamları hangi oyunu oynarız?',
  ],
  stars: [
    'Bir dilek tut. Yıl dönümünde açılacak.',
    'Gökyüzünde bir yıldıza isim versen ne derdin?',
    'On yıl sonra bu terasta ne konuşuyor oluruz?',
    'Bugün için minnettar olduğun tek şey?',
  ],
  // ---- Çiftlik ----
  harvest: [
    'Bu hasattan kime hediye götürelim?',
    'Gerçek bir bahçemiz olsa ilk ne ekerdik?',
    'Yetiştirdiğin bir şeyi kime ikram etmek istersin?',
    'Köyde bir hafta: ne yapardık?',
  ],
  market: ['Pazarda tezgâhımızın adı ne olsun?', 'İlk kazancımızla ne alalım?', 'Pazarda kim pazarlık eder?'],
};

// Çiftin görmediği ilk soruyu seçer; hepsi görüldüyse en eskiden başlar.
export function pickQuestion(kind: string, asked: string[]): string | null {
  const list = QUESTIONS[kind];
  if (!list) return null;
  const fresh = list.find((q) => !asked.includes(`${kind}:${q}`));
  return fresh ?? list[asked.filter((a) => a.startsWith(`${kind}:`)).length % list.length];
}
