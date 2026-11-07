
## Ana ekran widget'ları (Apple onayı ve ilk gerçek derlemeden sonra)

Expo Go'da çalışmaz; iOS'ta WidgetKit, Android'de uygulama widget'ı olarak derlemeye eklenir.

1. **Görevler widget'ı** (Anımsatıcılar gibi): günün görevi ve kabul edilen bonus görevler, yuvarlak kutucuklarla.
   - Bonus görevlere widget'tan doğrudan tik atılır → "Tamamladım", puan gelir, partner görür.
   - Günün görevi selfie gerektirdiği için dokununca uygulama kamerayla açılır.
2. **Gün sayacı** (küçük): "1681. gün", iletişim serisi 🔥 ve ikinizin görev tikleri.
3. **Kalp** (küçük): son 7 günün iletişimine göre büyüyen/küçülen kalp.
4. **Partnerden anlık fotoğraf** (orta/büyük, Locket gibi): sohbette gönderilen fotoğraf partnerin ana ekranına polaroid olarak düşer. Bildirimlerle birlikte çalışır.
5. **Anı köşesi** (büyük): albümden her gün değişen bir polaroid.

Sıra: önce bildirimler gerçek derlemede çalışsın → 1, 2, 3 → 4 → 5.

## Baskı albümü (plan)

- Önce fotoğrafları Firebase Storage'a ve yüksek çözünürlüğe (~1600 px) geçir; eski küçük fotoğraflar baskıya uygun büyütülemez.
- Uygulama içi önizleme + baskıya hazır PDF → elle matbaa ile başla → talep oturunca otomatik baskı servisi.
- Ödeme Apple uygulama içi satın alma DEĞİL (fiziksel ürün, kural 3.1.3(e)); iyzico/PayTR, şahıs şirketi gerekir.
- Sürpriz modu (partner siparişi görmez), yıl dönümü / seyahat sonu / Sevgililer Günü hatırlatmaları.
