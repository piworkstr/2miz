# Elle derlenen şehir etkinlikleri

Her il için bir dosya: `etkinlikler/<il>.json` (ör. `antalya.json`). Dosya `main` dalına gönderilince
`.github/workflows/etkinlik-elle.yml` çalışır ve `scripts/etkinlik-elle.mjs` içeriği Firestore'a yazar
(`config/events_<il>`; uygulamada "Şehrinizde bu ay").

- Panelden eklenen etkinliklere dokunulmaz. Bu dosyadan gelenlerin kimliği `w_` ile başlar ve her çalıştırmada dosyadakilerle değiştirilir.
- Aynı gün + aynı adla panelde bir etkinlik varsa dosyadaki atlanır.
- Geçmiş tarihliler yazılmaz; dosyadan da silinebilir.

Alanlar: `title` (zorunlu), `day` (YYYY-AA-GG, zorunlu), `cat` (konser | tiyatro | standup | sinema | gosteri | festival | spor | diger),
`time` (SS:DD), `venue`, `url` (https://, mümkünse etkinliğin kendi sayfası), `price` ("750 TL'den başlar"), `deal` (2miz'e özel indirim; yalnızca gerçek anlaşma varsa).

Kurallar: yalnızca kaynağında adı, tarihi ve mekanı açıkça birlikte görünen etkinlikler eklenir; emin olunmayan saat/fiyat boş bırakılır.
Bilet sitelerinden otomatik/toplu veri kazıma yapılmaz; liste elle derlenir.
