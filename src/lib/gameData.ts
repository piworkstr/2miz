// Oyun soru bankaları. İleride Firestore'a taşınıp premium paketlerle büyüyecek.

export const THIS_THAT: [string, string][] = [
  ['Deniz', 'Dağ'],
  ['Film', 'Dizi'],
  ['Kahve', 'Çay'],
  ['Sabahçı', 'Gece kuşu'],
  ['Kedi', 'Köpek'],
  ['Pizza', 'Döner'],
  ['Yaz', 'Kış'],
  ['Evde akşam', 'Dışarıda akşam'],
  ['Tatlı', 'Tuzlu'],
  ['Kitap', 'Podcast'],
  ['Plan yapmak', 'Akışına bırakmak'],
  ['Mesaj', 'Telefon'],
  ['Konser', 'Tiyatro'],
  ['Şehir', 'Köy'],
  ['Kumsal tatili', 'Şehir turu'],
  ['Kahvaltı', 'Akşam yemeği'],
  ['Romantik komedi', 'Gerilim'],
  ['Erken yatmak', 'Geç yatmak'],
  ['Sürpriz', 'Planlı hediye'],
  ['Yemek yapmak', 'Sipariş vermek'],
  ['Güneş', 'Yağmur'],
  ['Dans etmek', 'İzlemek'],
  ['Araba yolculuğu', 'Uçak'],
  ['Fotoğraf çekmek', 'Fotoğrafta olmak'],
  ['Kalabalık parti', 'İkimiz baş başa'],
  ['Çikolata', 'Dondurma'],
  ['Spor salonu', 'Doğa yürüyüşü'],
  ['Kamp', 'Otel'],
  ['Eski şarkılar', 'Yeni şarkılar'],
  ['Sarılmak', 'El ele tutuşmak'],
];

export type KnowMeQuestion = { q: string; options: string[] };

// "q" kişinin kendisi için sorulur; tahminde "Sence {partner}..." diye gösterilir.
export const KNOW_ME: KnowMeQuestion[] = [
  { q: 'En sevdiğin mevsim', options: ['İlkbahar', 'Yaz', 'Sonbahar', 'Kış'] },
  { q: 'Stresliyken en çok neye ihtiyacın olur?', options: ['Yalnız kalmak', 'Sarılmak', 'Konuşmak', 'Bir şeyler yemek'] },
  { q: 'Hayalindeki tatil', options: ['Ege koyları', 'Avrupa şehirleri', 'Uzak doğu', 'Dağ evi'] },
  { q: 'En sevdiğin öğün', options: ['Kahvaltı', 'Öğle', 'Akşam', 'Gece atıştırması'] },
  { q: 'Seni en çok ne güldürür?', options: ['Komik videolar', 'Kendi hallerimiz', 'Espriler', 'Saçma durumlar'] },
  { q: 'Bir süper gücün olsa', options: ['Uçmak', 'Görünmezlik', 'Zamanı durdurmak', 'Akıl okumak'] },
  { q: 'Hafta sonu ideal sabah', options: ['Geç uyanmak', 'Erken yürüyüş', 'Uzun kahvaltı', 'Yatakta dizi'] },
  { q: 'En çok hangisinden korkarsın?', options: ['Böcekler', 'Yükseklik', 'Karanlık', 'Yalnız kalmak'] },
  { q: 'Bir hediye seçecek olsan', options: ['Deneyim', 'Takı/aksesuar', 'Kitap', 'El yapımı bir şey'] },
  { q: 'Bir filmde hangi tür karakter olurdun?', options: ['Kahraman', 'Komik yardımcı', 'Gizemli tip', 'Akıllı stratejist'] },
  { q: 'Tartışmadan sonra ne yaparsın?', options: ['Hemen konuşurum', 'Biraz beklerim', 'Sarılırım', 'Şakayla yumuşatırım'] },
  { q: 'Seni en çok mutlu eden küçük şey', options: ['Güzel bir kahve', 'Güneşli hava', 'Sürpriz mesaj', 'Temiz çarşaf'] },
  { q: 'Hangi on yılda yaşamak isterdin?', options: ["60'lar", "80'ler", "90'lar", 'Gelecek'] },
  { q: 'En çok sevdiğin müzik ortamı', options: ['Arabada yüksek sesle', 'Kulaklıkta tek başına', 'Konserde', 'Evde arka planda'] },
  { q: 'Bir gün boyunca hangisi olurdun?', options: ['Şef', 'Gezgin', 'Rock yıldızı', 'Bilim insanı'] },
];

