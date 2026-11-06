# UsDaily Baskı Merkezi

Albüm baskı dosyaları yalnızca burada üretilir; uygulama kullanıcıya hiçbir zaman PDF vermez.

## Bir kez kurulum (Mac)

```
cd baski
npm install
npx playwright install chromium
```

## Örnek albüm (matbaaya göstermek için)

```
npm run ornek
```

Çıktı: `baski/cikti/ornek-21x21/` ve `ornek-A4/` içinde `ic-sayfalar.pdf`, `kapak.pdf`, `bilgi.txt`.

## Gerçek baskı talebi

1. Firebase konsolu > Proje ayarları > Hizmet hesapları > "Yeni özel anahtar oluştur". İnen dosyayı `baski/serviceAccount.json` adıyla kaydet. **Bu dosyayı kimseyle paylaşma.**
2. `npm run siparis -- <çift kimliği>` (en son talep) ya da `npm run siparis -- <çift kimliği> <talep kimliği>`.

Çift kimliği Firebase konsolunda `couples` koleksiyonunda, talepler her çiftin `albumOrders` alt koleksiyonunda görünür.
