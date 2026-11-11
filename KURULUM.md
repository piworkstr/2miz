# UsDaily – Kurulum ve ilk çalıştırma

Bu ilk sürümde çalışanlar: hesap oluşturma/giriş, davet koduyla partner eşleşmesi,
günlük ortak görev (kabul / başka görev), görev tamamlama + not, puan ve seri, sürpriz görev
kişiye özel tema seçimi, sevgi dili testiyle başlayan tanışma akışı ve date günü planlama.
Albüm, kuponlar, selfie, oyunlar ve "canım sıkıldı" bildirimi sonraki adımlarda eklenecek.

## 1. Bilgisayarı hazırla (bir kez)

1. https://nodejs.org adresinden **LTS** sürümünü indirip kur.
2. iPhone'una App Store'dan **Expo Go** uygulamasını kur.

## 2. Projeyi aç

1. `usdaily.zip` dosyasını Masaüstüne çıkar.
2. **Terminal** uygulamasını aç ve sırayla yaz:

```
cd ~/Desktop/usdaily
npm install
```

## 3. Firebase'i kur (yaklaşık 10 dakika, ücretsiz)

1. https://console.firebase.google.com adresine Google hesabınla gir, **Proje oluştur** de, adını `usdaily` koy.
2. Sol menüden **Authentication → Başlayın → E-posta/Şifre**'yi aç ve kaydet.
3. Sol menüden **Firestore Database → Veritabanı oluştur** de. Konum olarak Avrupa'yı (`eur3` ya da `europe-west`) seç, **üretim modu** ile başlat.
4. Firestore'da **Kurallar (Rules)** sekmesine geç, oradaki her şeyi sil, proje klasöründeki `firestore.rules` dosyasının içeriğini yapıştır ve **Yayınla**'ya bas.
5. Sol üstteki dişli → **Proje ayarları** → aşağıda **Uygulamalarınız** bölümünde `</>` (Web) simgesine tıkla, takma ad olarak `usdaily` yaz, kaydet.
6. Ekranda çıkan `firebaseConfig` değerlerini kopyala.
7. Proje klasöründe `.env.example` dosyasının bir kopyasını oluşturup adını `.env` yap ve değerleri karşılarına yapıştır:

```
EXPO_PUBLIC_FIREBASE_API_KEY=AIza...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=usdaily-xxxx.firebaseapp.com
...
```

> Not: Mac'te nokta ile başlayan dosyalar gizlidir. Finder'da `Cmd + Shift + .` ile görünür yapabilirsin.
> Terminal'den de oluşturabilirsin: `cp .env.example .env && open -e .env`

## 4. Telefonda çalıştır

```
npx expo start
```

Terminalde bir QR kod çıkar. iPhone kamerasıyla okut, uygulama Expo Go içinde açılır.
Mac ve iPhone aynı Wi-Fi ağında olmalı.

## 5. İki kişiyle test

Eşleşmeyi denemek için iki hesap gerekir:
- Partnerin kendi telefonuna Expo Go kurup aynı QR kodu okutabilir, **ya da**
- Mac'e App Store'dan **Xcode** kurup terminalde `i` tuşuna basarak iPhone simülatörünü açabilirsin.

Biriniz **Kod oluştur** der, diğeri o kodu girer. Ardından "Bugün" ekranında ortak görev çıkar.

## Sorun olursa

- `npx expo start -c` → önbelleği temizleyerek başlatır.
- `.env` değerlerini değiştirdikten sonra sunucuyu kapatıp (Ctrl + C) tekrar başlat.
- Hata mesajını olduğu gibi bana gönder, birlikte çözeriz.

## 6. TestFlight ve güncellemeler

Derleme ve mağaza gönderimi EAS'te (bulutta) yapılır; komutlar Mac'te Terminal'de, proje klasöründe çalıştırılır (`npx eas-cli@latest login` bir kez).

- **Yalnızca JavaScript değişen düzeltmeler** (ekranlar, çiftlik, metinler; yani Claude'un günlük commit'lerinin hemen hepsi) yeni derleme gerektirmez, havadan (OTA) gider ve telefonlar uygulamayı bir sonraki açışta alır:
  ```bash
  npm run cek
  npx eas-cli@latest update --branch production --environment production --message "düzeltmeler"
  ```
- **Yeni yerel paket** (ör. yeni bir expo-* modülü), `app.json` değişikliği ya da sürüm artışı varsa yeni derleme + TestFlight gerekir:
  ```bash
  npm run cek && npm install
  npx eas-cli@latest build --platform ios --profile production
  npx eas-cli@latest submit --platform ios --latest
  ```
  Derleme 10–20 dakika sürer; TestFlight'a düşünce test grubundaki telefonlara bildirim gider.
- Hangisinin gerektiğini Claude her yayında söyler ("OTA yeter" / "derleme gerekir").

### 6b. OTA'yı otomatiğe bağlama (bir kez, Terminal sonra hiç gerekmez)

`.eas/workflows/ota.yml` main'e her push'ta `eas update`'i EAS sunucusunda çalıştırır. Açmak için ofiste, bir kez:

1. Terminal, proje klasörü — Firebase ayarlarını (.env'deki EXPO_PUBLIC_* satırları) EAS'in production ortamına yükle:
   ```bash
   npx eas-cli@latest env:push --environment production --path .env
   ```
2. https://expo.dev → tanerbentesens-team → usdaily → **Project settings → GitHub** → "Connect repository" → piworkstr/2miz
   (ilk kez GitHub'da Expo uygulamasına izin ister).
3. Aynı sayfada **Workflows**'un açık olduğunu kontrol et. Bundan sonra Claude'un her push'u 2–3 dakikada
   production kanalına düşer; sonucu expo.dev → Workflows'ta görürsün.
