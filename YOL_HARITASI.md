# UsDaily – Yol haritası

## Bitenler
- Hesap / giriş, davet koduyla eşleşme
- Günlük ortak görev (kabul / başka görev), ayrı görevler
- Görev tamamlama + not, puan ve seri
- Sürpriz görev
- Kişiye özel tema: Standart, Ağır Abi, Aşko Kuşko (renk, font, metin dili)
- Date günü: önceden planlama + anlık "Bugün date'teyiz", partner onayı, o gün özel date kartı

## Sıradaki adım: selfie ve albüm
- Görev tamamlarken ön kamerayla zorunlu selfie (galeriden seçim yok)
- Polaroid albüm: iki selfie yan yana, altında görev adı, tarih ve el yazısı not
- **Date günü ortak selfie:** date günü kesinleşince ikisinin aynı karede olduğu
  tek bir selfie zorunlu. Albüme geniş, özel çerçeveli bir polaroid olarak girer.
- Not: fotoğraflar için Firebase Storage ve Blaze (kullandıkça öde) planı gerekir.

## Sonra
- Aşk kuponları (kendi kuponunu yaz, partnerinkini puanla aç)
- Görev çarkı, görev arşivi ve favoriler
- Canlı oyunlar: Beni ne kadar tanıyorsun?, Bu mu o mu?, Anı eşleştirme
- "Canım sıkıldı" bildirimi, "Şimdi olmaz" hakkı (haftada 3)
- Bildirim metinleri alıcının temasına göre

## İleri sürümler
- İngilizce dil desteği: her tema İngilizcede kendi karakteriyle (birebir çeviri değil)
- Topluluk görevleri (anonim, onaylı, şikayet / engelleme)
- Basılı albüm siparişi (ücretli)
- Premium görev paketleri
- Apple ve Google ile giriş

## Gelir modeli
- **Çift aboneliği:** biri öder, ikisi premium olur. Aylık ve indirimli yıllık plan.
- **Basılı albüm:** yıl dönümü, Sevgililer Günü, doğum günü hatırlatmalarıyla ücretli baskı siparişi.
- **Tek seferlik satın almalar:** yeni temalar, özel görev paketleri, ekstra "şimdi olmaz" hakkı.
- **Ödüllü reklam (isteğe bağlı):** reklam izle → ekstra sürpriz görev / çark hakkı. Banner reklam yok.
- **Date ortaklıkları:** kafe, sinema, restoran indirimleri ve sponsorlu date önerileri.
- **Büyüme:** polaroidleri Instagram'da paylaşma (köşede küçük logo).
- **Yaş sınırı:** 18+ (ya da 17+), fotoğraf ve kişisel veri nedeniyle.

## Ücretsiz / Premium
| Özellik | Ücretsiz | Premium |
|---|---|---|
| Günlük görev, date günü | Var | Var |
| 3 tema | Var | Var + yeni temalar |
| Anı albümü | Tamamı | Tamamı + özel çerçeveler |
| Sürpriz görev | Günde 1 | Sınırsız |
| Görev çarkı | Haftada 1 | Sınırsız |
| Oyunlar | 1 oyun | 3 oyun + yenileri |
| Aşk kuponları | 3 aktif kupon | Sınırsız |
| Özel görev paketleri | Yok | Var |
| Ödüllü reklam | İsteğe bağlı | Yok |

İlke: albüm ve günlük görev hiç kısıtlanmaz. Kısıtlar kodda tek bir anahtarla açılıp kapanır;
ilk yayında kapalı başlar.

## Çift aboneliği kuralları
- Biri öder, eşleşme süresince ikisi de premium olur (satın alma ödeyenin hesabına bağlı, çift belgesine işlenir).
- "Premium'u sevgiline hediye et" seçeneği.
- Aylık ve indirimli yıllık plan; ilk kez alanlara 7 gün ücretsiz deneme.
- Ayrılık durumunda premium ödeyende kalır; ödeyen yeni biriyle eşleşirse yeni çifte geçer.
