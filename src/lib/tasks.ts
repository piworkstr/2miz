import { extraTasks } from './taskBank';

export type Category = 'iletisim' | 'minnet' | 'romantik' | 'eglence' | 'yeni' | 'surpriz';

export type Task = {
  id: string;
  title: string;
  category: Category;
};

// Çarkta ve arşivde kategorilerin rengi ve simgesi.
export const categoryStyle: Record<Category, { color: string; icon: string }> = {
  iletisim: { color: '#5B8DB8', icon: 'chatbubbles' },
  minnet: { color: '#E0A43A', icon: 'sunny' },
  romantik: { color: '#E8516A', icon: 'heart' },
  eglence: { color: '#8C6BC2', icon: 'happy' },
  yeni: { color: '#4FA37E', icon: 'compass' },
  surpriz: { color: '#E07A45', icon: 'gift' },
};

export const CATEGORIES: Category[] = ['romantik', 'iletisim', 'eglence', 'minnet', 'yeni', 'surpriz'];

export const categoryLabels: Record<Category, string> = {
  iletisim: 'İletişim',
  minnet: 'Minnet',
  romantik: 'Romantik',
  eglence: 'Eğlence',
  yeni: 'Yeni deneyim',
  surpriz: 'Sürpriz',
};

// İlk görev bankası (kimlikleri t01–t36). Ek görevler taskBank.ts dosyasında.
const BASE: Task[] = [
  { id: 't01', title: 'Birbirinizin sevdiğiniz bir huyunu söyleyin', category: 'minnet' },
  { id: 't02', title: 'İlk buluşmanızdan bir anıyı birlikte hatırlayın', category: 'romantik' },
  { id: 't03', title: '10 dakika telefonsuz yürüyüşe çıkın', category: 'yeni' },
  { id: 't04', title: 'Bugün size teşekkür ettiren bir şeyi birbirinize anlatın', category: 'minnet' },
  { id: 't05', title: 'Birlikte en sevdiğiniz şarkıyı dinleyin', category: 'romantik' },
  { id: 't06', title: 'Partnerine gün içinde sürpriz bir mesaj at', category: 'surpriz' },
  { id: 't07', title: 'Birbirinize "Bu hafta seni ne yordu?" diye sorun', category: 'iletisim' },
  { id: 't08', title: 'Hayalinizdeki tatili 5 dakikada planlayın', category: 'eglence' },
  { id: 't09', title: 'Birlikte daha önce hiç denemediğiniz bir yemek yapın', category: 'yeni' },
  { id: 't10', title: 'Partnerinin en sevdiği atıştırmalığı alıp eve getir', category: 'surpriz' },
  { id: 't11', title: '20 saniye boyunca sarılın', category: 'romantik' },
  { id: 't12', title: 'Çocukluğunuzdan komik bir hikaye paylaşın', category: 'iletisim' },
  { id: 't13', title: 'Birbirinize bir iltifat notu yazıp saklayın', category: 'surpriz' },
  { id: 't14', title: 'Birlikte 5 dakika esneme hareketi yapın', category: 'yeni' },
  { id: 't15', title: '"Seninle en çok güldüğüm an" konusunu konuşun', category: 'eglence' },
  { id: 't16', title: 'Akşam yemeğini masada, telefonsuz yiyin', category: 'iletisim' },
  { id: 't17', title: 'Birbirinizin gününü bir emojiyle anlatın ve tahmin edin', category: 'eglence' },
  { id: 't18', title: 'Partnerinin bugün yaptığı küçük bir şey için teşekkür et', category: 'minnet' },
  { id: 't19', title: 'Birlikte gün batımını izleyin', category: 'romantik' },
  { id: 't20', title: 'Gelecek yıl birlikte yapmak istediğiniz 3 şeyi yazın', category: 'iletisim' },
  { id: 't21', title: 'Birlikte bir yapboz ya da kutu oyunu oynayın', category: 'eglence' },
  { id: 't22', title: 'Birbirinize sevdiğiniz bir fotoğrafınızı gönderin ve hikayesini anlatın', category: 'romantik' },
  { id: 't23', title: 'Partnerinin bir işini onun yerine yap', category: 'surpriz' },
  { id: 't24', title: 'Hiç gitmediğiniz bir sokakta yürüyüş yapın', category: 'yeni' },
  { id: 't25', title: '"Seni seviyorum"u farklı bir dilde söyleyin', category: 'eglence' },
  { id: 't26', title: 'Birbirinizden öğrendiğiniz bir şeyi söyleyin', category: 'minnet' },
  { id: 't27', title: 'Bu hafta birbirinizden ne istediğinizi açıkça konuşun', category: 'iletisim' },
  { id: 't28', title: 'Birlikte kahve ya da çay demleyip sohbet edin', category: 'romantik' },
  { id: 't29', title: 'Partnerine küçük bir el yapımı hediye hazırla', category: 'surpriz' },
  { id: 't30', title: 'Birlikte yeni bir kelime ya da cümle öğrenin', category: 'yeni' },
  { id: 't31', title: 'Birbirinizi 3 kelimeyle anlatın', category: 'eglence' },
  { id: 't32', title: 'İlişkinizde gurur duyduğunuz bir anı konuşun', category: 'minnet' },
  { id: 't33', title: 'Birbirinize sırtınızı dönüp bir şey çizin, sonra karşılaştırın', category: 'eglence' },
  { id: 't34', title: 'Bugün partnerini dinlerken hiç sözünü kesme', category: 'iletisim' },
  { id: 't35', title: 'Birlikte bir sonraki buluşmanızı planlayın', category: 'romantik' },
  { id: 't36', title: 'Partnerinin en sevdiği şarkıyı ona söyle', category: 'surpriz' },
];

// Aktif görevler (seçimde kullanılır) ve kaldırılanlar dahil tümü (eski günleri göstermek için).
export const TASKS: Task[] = [...BASE, ...extraTasks()];
const ALL: Task[] = [...BASE, ...extraTasks(true)];

export function taskById(id: string): Task {
  return ALL.find((t) => t.id === id) ?? TASKS[0];
}

// Aynı tohumdan her telefonda aynı sonucu veren basit hash,
// böylece iki partner aynı gün aynı görevi görür.
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function pickTask(seed: string, excludeIds: string[] = []): Task {
  const pool = TASKS.filter((t) => !excludeIds.includes(t.id));
  const list = pool.length ? pool : TASKS;
  return list[hash(seed) % list.length];
}

export function randomTask(excludeIds: string[] = []): Task {
  const pool = TASKS.filter((t) => !excludeIds.includes(t.id));
  const list = pool.length ? pool : TASKS;
  return list[Math.floor(Math.random() * list.length)];
}

// Görülen listesini havuz büyüklüğüne göre kırpar: havuz bitmeye yakınken en eski görülenler tekrar açılır.
export function trimSeen(seen: string[], keep: number): string[] {
  return seen.length > keep ? seen.slice(seen.length - keep) : seen;
}
