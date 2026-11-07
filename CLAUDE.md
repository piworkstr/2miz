# 2miz — Claude için çalışma kuralları

2miz, Taner ve Aleyna'nın çiftler uygulaması (Expo SDK 58, Expo Router, Firebase Auth + Firestore). Kullanıcıyla iletişim **Türkçe**. Genel Expo kuralları için `AGENTS.md`'yi de oku.

## Plan
- Proje planı (Claude Doc): https://claude.ai/artifact/NtKknGD8Z1D5jgPgH9Tdi5 — işler buradan, sırayla. "(Sen)" yazanlar Taner/Aleyna'nın işi; diğerleri Claude'un. Biten maddeyi `[x]` yap.
- Gelir planı: https://claude.ai/artifact/HEknG8Xs9cqi7rWzpwinyv

## Kesin kurallar
- **Baskı PDF'i kullanıcıya hiçbir yerde verilmez.** Uygulamada yalnızca önizleme (WebView). Baskı dosyası yalnızca `baski/` (Baskı Merkezi) ile, bizde üretilir.
- **Gizli dosyalar repoya girmez:** `.env`, `baski/serviceAccount.json`, `baski/cikti/`. Commit öncesi `git status` kontrol et.
- `couples/{id}.plus` alanını uygulama yazamaz (Firestore kuralı). Plus'ı yalnızca ödeme sunucusu yazar. `BETA_ALL_OPEN` (src/lib/plus.ts) satışlar başlayana kadar `true`.
- Firestore kurallarını (`firestore.rules`) değiştirirsen yayınlamak ayrı bir iştir; Taner'e bildir, kendi başına yayınlama.
- Para harcayan, mağazaya gönderen, kullanıcı hesaplarında paylaşım yapan hiçbir şey yapma; hazırla ve sor.
- Mevcut stil: tek tırnak, `npx prettier --single-quote --print-width 140`. Yalnızca değiştirdiğin dosyaları biçimlendir.

## Doğrulama (her değişiklikten sonra)
```bash
npm ci            # node_modules yoksa
npx tsc --noEmit
EXPO_OFFLINE=1 CI=1 npx expo export --platform ios --output-dir /tmp/exp
```
`baski/` uygulama tsconfig'inden hariçtir.

## Commit
- `main` dalına küçük, anlaşılır commit'ler; mesaj Türkçe.
- Taner'in Mac'indeki kopya `git pull` ile güncellenir; `app.json` repo ile aynı tutulur (EAS projectId içinde).
