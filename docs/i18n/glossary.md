# MutinyBIM Çeviri Sözlüğü (EN → TR)

> **Durum:** Onay bekliyor · **Tarih:** 2026-11-10
> Bu sözlük, arayüzün İngilizce ve Türkçe iki dilli olması için **bağlayıcı terim kararlarını** tanımlar.
> Çeviri yapan (insan veya ajan) bu dosyaya uyar. Yeni bir terim çıkarsa **önce buraya eklenir**, sonra kullanılır.
>
> Terimler kod tabanından çıkarıldı (`packages/bim-editor`, `packages/bim-pack-*`, `packages/bim-schedules-ui`, `packages/bim-units`, `apps/mutinybim-web`), tahminle yazılmadı.

---

## 0. Temel ilkeler

1. **Tek kavram, tek Türkçe terim.** Aynı kavram için iki Türkçe kelime kullanılmaz. Eşanlamlı İngilizce terimler (element/part/piece/item) tek Türkçeye indirgenir.
2. **Sektör terimi varsa o kullanılır**, birebir çeviri değil. Örn. `takeoff` → *metraj* (çevirisi "çıkarma" değil).
3. **Uluslararası kısaltmalar çevrilmez:** `IFC`, `BIM`, `MEP`, `RFI`, `PDF`, `OpenID`, `SaaS`. Birim sembolleri (`mm`, `m²`, `Pa`, `kW`) çevrilmez.
4. **İngilizce terim parantez içinde korunur** yalnızca sektörde yerleşik değilse: `Submittal (imalat onayı)`. Yerleşikse parantez yok.
5. **Fiil/buton etiketleri emir kipi**, tek kelime tercih edilir: `Save` → *Kaydet*, `Merge` → *Birleştir*.
6. **Kısaltma yok** (buton darsa bile): `Coordination` → *Koordinasyon*, `Coord.` değil.
7. **Hitap: buton tekili, cümle çoğulu.** §3'teki düğme/komut etiketleri tekil emir kipidir (*Yeniden dene*, *Kaydet*); cümle içindeki yönlendirmeler kibar çoğul emir kipidir (*"…tekrar deneyin"*, *"…birini seçin"*). İkisi çelişmez: bir düğme kısa bir komuttur, bir cümle bir kişiye hitap eder. Bkz. §2.5 ve §8'deki flaş/hata metinleri. *(Karar: 2026-11-10, Aşama 2.)*

---

## 1. Disiplinler ve meslekler

| EN | TR | Not |
|----|----|-----|
| Architecture | Mimarlık | |
| Structural | Statik | "Yapısal" değil; Türk şantiyesinde *statik* |
| Civil | Altyapı | İnşaat mühendisliği altyapı işleri |
| Mechanical | Mekanik | |
| Electrical | Elektrik | |
| Plumbing | Sıhhi tesisat | |
| Fire protection | Yangın koruma | |
| Site | Şantiye | "Saha" değil; model/site bağlamı şantiye |
| Development | Geliştirme | Gayrimenkul geliştirme |
| General / General contracting | Genel / Genel yüklenici | |
| MEP | MEP | Kısaltma korunur |
| Other | Diğer | |

---

## 2. BIM çekirdek kavramları

### 2.1 Nesne hiyerarşisi — **kritik karar**

Kodda aynı nesne için 4 İngilizce eşanlamlı dolaşıyor: `element`, `part`, `piece`, `item`.
**Karar:** tek Türkçe karşılık kullanılır, çoğul biçimler otomatik.

| EN | TR | Kapsam |
|----|----|--------|
| Element (modelin herhangi bir nesnesi) | **eleman** | Genel; "N eleman" |
| Part (bir elemanın parçası / katalog bileşeni) | **parça** | "Parça türleri", "Parça" sekmesi |
| Piece (kod içi eşanlamlı, kullanıcıya görünmez) | **eleman** | Aynı şeye işaret ediyorsa *eleman*'a eşlenir |
| Item (maliyet/metraj kalemi) | **kalem** | "N kalem", "metraj kalemi" |

> **Kural:** Kullanıcıya görünen metinde `piece` kelimesi **hiç** kullanılmaz → *eleman*.
>
> **Kural — `öğe` yasak.** *Öğe*, §0.1'in yasakladığı üçüncü eşanlamlıydı: aynı şey için *eleman*, *parça* ve *kalem* zaten var, `öğe` hiçbirisinin yerine geçmez ve hangi kavramı kastettiğini okuyana bırakır. 2026-11-10'un son düzeltme turunda tr dosyalarındaki **39** kullanımın tamamı kaldırıldı: modelde ve çizimde duran şey *eleman* (`{{n}} eleman`, *çizilmiş elemanlar*, *Çizilmiş elemanlar* sekmesi), çizelge/metraj satırı *kalem* (`{{column}} kalemi`, *kullanımdan kaldırılmış kalemler*). Çeviri yaparken `öğe` yazmayın; *eleman* ya da *kalem* seçin. Bkz. §8.1 `in_use` satırı (bu satır bir zamanlar `öğe` diyordu).
>
> **Kural — `Editor` tek sözcük.** Bir kavram, tek Türkçe terim (§0.1): `Editor` = **düzenleyici**. *Editör* yalnız `web.json`'ın `message.editorOffTitle` / `message.editorOffWords` satırlarında geçiyordu; 2026-11-10'un son düzeltme turunda *düzenleyici*ye çevrildi, böylece `settings.languageLede` (“… ve düzenleyicinin dili”) ile aynı sözcüğü kullanıyor. *Editör* çeviri değil, alıntı bir sözcüktür; kullanılmaz.

### 2.2 Model ve proje

| EN | TR | Not |
|----|----|-----|
| Model (BIM modeli) | **model** | |
| Model (Yapay zekâ modeli, `ai-model`) | **model** | ⚠️ bkz. §9/Ç1 — bağlamla ayrışır |
| Model in place (yerinde modelledi) | **yerinde model** | Revit TR karşılığı |
| Model settings | **model ayarları** | |
| Project | **proje** | |
| Linked model | **bağlı model** | |
| Type | **tip** | |
| Part type | **parça tipi** | |
| Edit type | **tipi düzenle** | |
| Family | **aile** | Revit TR |
| Category | **kategori** | |
| Class / Classification | **sınıf** / **sınıflandırma** | |
| Discipline | **disiplin** | |
| Responsible role | **sorumlu rol** | |
| Editor (uygulamanın kendisi, 3B düzenleme yüzeyi) | **düzenleyici** | ⚠️ *editör* DEĞİL — bkz. §2.1 notu |
| Version | **sürüm** | |

### 2.3 Geometri, konum, organizasyon

| EN | TR | Not |
|----|----|-----|
| Level / Storey | **kat** | |
| Add level | **kat ekle** | |
| Space | **mekan** | "alan" DEĞİL (area ile karışır) |
| Room | **oda** | |
| Room template | **oda şablonu** | |
| Zone | **bölge** | |
| Fire area | **yangın bölgesi** | |
| Grid | **ızgara** | Revit TR |
| Axis | **eksen** | |
| Datum | **referans** | |
| Origin / Project origin | **orijin** / **proje orijini** | |
| Site point | **şantiye noktası** | |
| True north | **gerçek kuzey** | |
| Working angle | **çalışma açısı** | |
| Reference plane | **referans düzlemi** | |
| Mounting plane | **montaj düzlemi** | |
| Sketch | **eskiz** | |
| Solid / Void | **katı** / **boşluk** | |
| Phase | **faz** | "inşaat fazı" bağlamı |
| Phase filter | **faz filtresi** | |
| Group | **grup** | |
| Groups & phases | **gruplar ve fazlar** | |
| Partition | **bölüm** | ⚠️ yalnız kernel; UI'da görünmüyor |
| Filter | **filtre** | |
| Visibility/Graphics | **görünürlük/grafikler** | Revit TR |
| Underlay | **altlık** | |
| Revision | **revizyon** | |
| Status | **durum** | |
| Use / Occupant | **kullanım** / **kullanıcı** | |
| Mark | **işaret** | Revit TR (`Mark` alanı) |
| Connector | **bağlantı noktası** | |
| Insulation / Liner | **yalıtım** / **iç kaplama** | |

### 2.4 Görünüm, pafta, tablo

| EN | TR | Not |
|----|----|-----|
| View | **görünüm** | |
| Sheet | **pafta** | ⚠️ Elektronik tablo DEĞİL — bkz. §9/Ç3 |
| Sheets | **paftalar** | |
| Title block | **antet** | |
| Viewport | **görüntü alanı** | |
| Schedule | **çizelge** | ⚠️ bkz. §9/Ç4 — Revit TR karşılığı |
| Schedules | **çizelgeler** | |
| Panel schedule | **pano çizelgesi** | |
| Calculation | **hesap** | |
| Annotation | **açıklama** | Revit TR |
| Tag | **etiket** | |
| Keynote | **anahtar not** | |
| Diagram | **diyagram** | |
| One-line diagram | **tek hat diyagramı** | |
| Riser diagram | **kolon şeması** | |
| Demand curve | **talep eğrisi** | |
| Dimension | **ölçü** | |
| Detail line | **detay çizgisi** | |
| Region | **bölge** | |
| Symbol | **sembol** | |
| Text | **metin** | |
| Callout | **detay balonu** | |
| Detail level | **detay seviyesi** | ⚠️ bkz. §9/Ç6 |

### 2.5 Hesap, anahtar ve yapay zekâ

Barındırılan uygulamanın (`apps/mutinybim-web`) ekranlarında geçen, model geometrisi olmayan terimler. 2026-11-10'da Aşama 2 ile eklendi.

| EN | TR | Not |
|----|----|-----|
| Building model | **yapı modeli** | "bina modeli" değil; BIM = yapı bilgi modellemesi |
| Password | **parola** | "şifre" değil; *şifre* = cipher |
| AI / AI model | **yapay zekâ** / **yapay zekâ modeli** | ⚠️ bkz. §9/Ç1 — *model* korunur |
| Agent key | **ajan anahtarı** | MCP asistanının anahtarı |
| Tool server | **araç sunucusu** | MCP sunucusu ↔ *araç sunucusu* |
| Tool family | **araç ailesi** | MCP araç paketi |
| Sealed box / sandbox | **kapalı kutu** | betiklerin ağsız çalıştığı yer |
| Hash (one-way) | **özet** | "tek yönlü özet"; *hash* yerine |
| Fingerprint | **parmak izi** | anahtarın saklanan özeti |
| Allow (OAuth) | **İzin ver** | ⚠️ *Onayla* = Approve, §3 |
| Sign out (an assistant or a key) | **Oturumu kapat** | anahtar için *Kapat* |
| Sign-in link | **giriş bağlantısı** | e-postayla gelen giriş/parola sıfırlama bağlantısı |
| Client id (OAuth) | **istemci kimliği** | sunucunun bu uygulamaya verdiği kimlik; *client* = **istemci** |
| Token (sign-in) | **belirteç** | "giriş belirteci"; *token* değil |
| Rate limit / too many tries | **deneme sınırı** / **çok fazla deneme** | sunucunun bir adresten kabul ettiği deneme sayısı |
| Approval request | **onay isteği** | §6 *Approval* = **onay** |
| Approval outcome | **onay sonucu** | "Geri çevirdiniz", "Onaylandı" — ne olduğunu söyleyen tek satır |
| Metadata (document) | **üst veri** | asistanın `client_id` adresindeki üst veri belgesi |
| Public client (no secret) | **ortak istemci** | "istemci sırrı olmayan ortak istemci" |
| Provider (the person's own AI provider) | **sağlayıcı** | "sağlayıcınız"; sağlayıcı adları (**Anthropic**, **OpenAI**, **xAI**) çevrilmez |
| AI key / API key | **yapay zekâ anahtarı** / **API anahtarı** | sağlayıcının anahtarı; §2.5 *Agent key* = **ajan anahtarı** (MCP asistanınınki) — ikisi karışmaz |
| Rate limit / spending limit (a provider's) | **istek sınırı** / **harcama sınırı** | sağlayıcının koyduğu sınır; §2.5 satırındaki *deneme sınırı* sunucunun bir adresten kabul ettiği denemedir, bu değil |
| Browser | **tarayıcı** | "yalnızca bu tarayıcıda" |
| Ask AI (the bar's button and its panel) | **Yapay zekâya sor** | düğme, panel başlığı ve `{{aria}}` adı **aynı** sözcük; `settings.askAi` ile tek söylem |

### 2.6 Mekanik ekipman

| EN | TR | Not |
|----|----|-----|
| Air handler (AHU) | **klima santrali** | |
| Diffuser | **difüzör** | |
| Duct | **kanal** | ⚠️ bkz. §9/Ç17 |

### 2.7 Uygulama çatısı: tema, dil ve gezinme

Her sayfanın başlığı (üst çubuk), alt bilgisi ve dil/tema denetimleri. 2026-11-10'da Aşama 2 ile eklendi.

| EN | TR | Not |
|----|----|-----|
| Theme | **tema** | |
| Light / Dark / Auto | **Açık / Koyu / Otomatik** | "Otomatik" = bilgisayarın ayarına uy |
| Language | **dil** | |
| English / Türkçe | **English / Türkçe** | ⚠️ dil adları **çevrilmez**; her dil kendi adıyla yazılır |
| Log in / Log out | **Giriş yap / Oturumu kapat** | bkz. §2.5 *Sign out* |
| Sign up free | **Ücretsiz hesap oluştur** | `Create a free account` ile **aynı** Türkçe: tek eylem, tek söylem |
| My models | **Modellerim** | `models.title` ile aynı |
| Connect an assistant | **Asistan bağla** | `connect.pageTitle` ile aynı; *assistant* = **asistan** |
| Settings | **Ayarlar** | `settings.title` ile aynı |
| Main (gezinme yer imi) | **Ana menü** | `<nav aria-label>`; "ana gezinme" değil |
| MutinyBIM home (marka bağlantısı) | **MutinyBIM ana sayfası** | iyelik ekiyle; "ana sayfa" yalın hâli bağlantı adı olarak eksik kalıyor |
| Terms / Privacy (alt bilgi) | **Kullanım koşulları / Gizlilik bildirimi** | bkz. §2.5 ve `legal.*` |
| Source code | **kaynak kodu** | |

### 2.8 MEP kanal ve boru ağı (2026-11-10, Aşama 3 · Task 3.3)

Aşama 3, modelin ret cümlelerini (`operator-messages.ts`) çevirirken bu ağ sözcüklerinin sözlükte hiç olmadığı görüldü: §9/Ç8 yalnızca *branch*'in iki anlamını ayırıyordu, geri kalanı yoktu. Ret cümleleri bu sözcükleri adlarıyla kullandığı için karara bağlandı.

| EN | TR | Not |
|----|----|-----|
| Branch (MEP) | **branşman** | §9/Ç8; tasarım dalı **dal** kalır |
| Trunk | **ana hat** | Branşmanın ayrıldığı gövde hat |
| Tap / Branch takeoff (fitting) | **ayrım** | §6 *Takeoff* = **metraj** ile karışmaz: bu bir bağlantı parçasıdır, miktar kalemi değil |
| Takeoff width | **ayrım genişliği** | Aynı gerekçe |
| Fitting | **bağlantı parçası** | §4.1'de ribbon grubu olarak vardı; §2.3 *Connector* = **bağlantı noktası**, ayrı kavram |
| Run (MEP) / Duct run / Pipe run | **hat** / **kanal hattı** / **boru hattı** | §9/Ç9; §2.4 *Run* ile (fiil) karışmaz |
| Pinned (sıfat) | **sabitlenmiş** | §3 *Pin* = **Sabitle**; cümle içindeki sıfat hâli |
| Fan | **fan** | §2.6 ekipman ailesi |
| Architect's levels | **mimarın katları** | Bağlı modelin katları; §2.2 *linked model* = **bağlı model** |

---

## 3. Komutlar ve eylemler

| EN | TR | | EN | TR |
|----|----|---|----|----|
| Select | **Seç** | | Undo | **Geri al** |
| Deselect | **Seçimi kaldır** | | Redo | **Yinele** |
| Box select | **Pencere seçimi** | | Crop | **Kırp** |
| Place | **Yerleştir** | | Crop view | **Görünümü kırp** |
| Stop placing | **Yerleştirmeyi bitir** | | Crop to selection | **Seçime kırp** |
| Route | **Güzergâh çiz** | | Reset crop | **Kırpmayı sıfırla** |
| Stop routing | **Güzergâhı bitir** | | Fit | **Sığdır** |
| Finish | **Bitir** | | Zoom to fit | **Sığdırarak yakınlaştır** |
| Size | **Boyutlandır** | | Zoom in/out | **Yakınlaştır/Uzaklaştır** |
| Auto-size | **Otomatik boyutlandır** | | Print PDF | **PDF yazdır** |
| Test sizes | **Boyutları sına** | | Print set | **Seti yazdır** |
| Resize | **Yeniden boyutlandır** | | Export IFC | **IFC dışa aktar** |
| Move | **Taşı** | | Import | **İçe aktar** |
| Move origin | **Orijini taşı** | | Link a model | **Model bağla** |
| Rotate | **Döndür** | | Browse and place | **Gözat ve yerleştir** |
| Mirror | **Aynala** | | Measure | **Ölç** |
| Align | **Hizala** | | Trim (Extend) | **Kısalt (Uzat)** |
| Split | **Böl** | | Fillet | **Yuvarlat** |
| Merge | **Birleştir** | | Pin / Unpin | **Sabitle / Sabitlemeyi kaldır** |
| Copy | **Kopyala** | | Lock | **Kilitle** |
| Paste | **Yapıştır** | | Hide in view | **Görünümde gizle** |
| Delete | **Sil** | | Show | **Göster** |
| Duplicate | **Çoğalt** | | Assign | **Ata** |
| Create | **Oluştur** | | Approve | **Onayla** |
| Create similar | **Benzerini oluştur** | | Approve all | **Tümünü onayla** |
| New | **Yeni** | | Reject | **Reddet** |
| Edit | **Düzenle** | | Decline | **Geri çevir** |
| Rename | **Yeniden adlandır** | | Dismiss | **Yoksay** |
| Remove | **Kaldır** | | Clarify | **Netleştir** |
| Replace | **Değiştir** | | Tag all | **Tümünü etiketle** |
| Update | **Güncelle** | | Issue set | **Seti yayınla** |
| Save | **Kaydet** | | Save / Cancel / Close | **Kaydet / İptal / Kapat** |
| Keep | **Koru** | | Apply | **Uygula** |
| Retry | **Yeniden dene** | | Try now | **Şimdi dene** |
| Propose merge to Main | **Ana dala birleştirme öner** | | Record a decision | **Karar kaydet** |

---

## 4. Ribbon sekmeleri ve paneller

**Sekmeler:** Model · Görünümler · Paftalar · Yönet · Açıklama · Değiştir · Parça · Seçim · Dal · Güzergâh · Plan · Çizelgeler · Hızlı + disiplin sekmeleri

**Ticari sekme bölümleri:** Seç · Oluştur · Bağla · Analiz · Tasarım · Belgeler

**Grup/panel adları:** Oluştur · Kur · Parçalar · Referans · Görüntüle · Aç · Grafikler · Kırp · Pafta · Şekiller · Yayın · Proje · Gruplar ve fazlar · Koordinasyon · Parça tipleri · Görünüm yönü · Koordinatlar · Geometri · Ölç · Daha fazla · Kitaplık · Yük çizelgeleri · Mekanlar · Ekipman listesi · Çizelgeler · Yönet · Model filtreleri

**Yan/dock panelleri:** Özellikler · Görünümler ve paftalar · Parçalar · Henüz yerleştirilmedi · Mekanlar · Çizelgeler · Sorular · Onay belgeleri · Değişiklik emirleri · Sürümler · Sorumluluklar · Koordinasyon bulguları · Bağlı modeller · Tasarım limitleri · Eklentiler · Geçmiş · Fiyat kitabı · Kontrol listesi · Kopyalar · Antetler · Not açıklamaları · Pano görünümü · Pano çizelgesi · Pano gösterimi

### 4.1 Aşama 3'te eklenen ribbon sözcükleri (2026-11-10)

Yukarıdaki listeler bağlayıcıydı ama eksikti: ribbon'un bazı sekme ve grup adları hiçbir listede yoktu. Aşama 3 (Task 3.1) bunları çevirirken buraya ekledi. Yukarıdaki satırlarda **zaten** karara bağlı olanlar tekrar yazılmadı (`Oluştur`, `Kur`, `Parçalar`, `Referans`, `Görüntüle`, `Aç`, `Grafikler`, `Kırp`, `Pafta`, `Şekiller`, `Yayın`, `Proje`, `Gruplar ve fazlar`, `Koordinasyon`, `Koordinatlar`, `Geometri`, `Kitaplık`, `Çizelgeler`, `Plan`).

| EN (ribbon) | TR | Not |
|----|----|-----|
| Height | **Yükseklik** | Güzergâh sekmesi; §2.3 *Level* = kat ile karışmaz |
| Axis | **Eksen** | §2.3 *Axis* = eksen |
| Fittings | **Bağlantı parçaları** | §2.3 *Connector* = **bağlantı noktası** — ayrı kavram |
| Finish | **Bitir** | §3 *Finish* = Bitir |
| Dimension (grup) | **Ölçü** | §2.4 *Dimension* = ölçü; §3'teki *Measure* komutu **Ölç** kalır |
| Detail (grup) | **Detay** | §2.4 *Detail line* = detay çizgisi |
| Region | **Bölge** | §2.4 |
| Text | **Metin** | §2.4 |
| Tag | **Etiket** | §2.4 |
| Edit (grup) | **Düzenle** | §3 *Edit* = Düzenle |
| Versions & sign-off | **Sürümler ve imza onayı** | §2.2 *Version* = sürüm + §3 *Sign-off* = imza onayı |
| Drawn items | **Çizilmiş elemanlar** | `Modify · Drawn items` sekmesi → **Değiştir · Çizilmiş elemanlar** (§2.1: `öğe` değil) |
| Quick access | **Hızlı erişim** | Araç arama listesinin "Hızlı" grubu |
| Figures · open a sheet first | **Şekiller · önce bir pafta açın** | Cümle → kibar çoğul emir (§0.7) |
| Issue · open a sheet to print it | **Yayın · yazdırmak için bir pafta açın** | Cümle → kibar çoğul emir (§0.7) |
| More {{name}} tools (erişilebilir ad) | **{{name}} grubunda daha fazla araç** | `{{name}}` grubun kendi sözcüğüdür, küçük harfle gelir; çoğul eki almaz ("daha fazla araç") |
| More (düğme yazısı) | **Daha fazla** | Yukarıdaki erişilebilir adla aynı düğmenin görünen yazısı; ikisi aynı dilde olur |
| Symbol (grup) | **Sembol** | §2.4 *Symbol* = sembol; çizim açıkken Açıklama sekmesinde görünür |
| Model settings (grup) | **Model ayarları** | §2.2 *Model settings* = model ayarları |
| Duct run / Pipe run (bağlamsal sekme) | **Kanal hattı** / **Boru hattı** | §9/Ç9 *Run* = **hat**; §9/Ç17 *Duct* = kanal, *Pipe* = boru. Seçili hattın sekmesi |

> **Not — aynı sözcük hem sekme hem grup:** §4'te **Plan** ve **Çizelgeler** *sekme* olarak listeleniyor; kodda ikisi de **grup** adıdır (`Model` sekmesinin yanında ticari sekmelerde Plan grubu, `Views`/`Yönet` altında Çizelgeler grubu). Türkçeleri aynı olduğu için çeviri değişmez; yalnızca hangi yapıda durdukları okuyanı yanıltmasın.

### 4.2 Aşama 3'te eklenen panel ve durum sözcükleri (2026-11-10)

§4'ün yan/dock paneli listesi bağlayıcıydı ama kodda karşılığı olan bazı yüzeyleri adlandırmıyordu. Aşama 3 (Task 3.2) yan panelleri ve durum çubuğunu çevirirken bunları ekledi. Yukarıdaki listelerde **zaten** karara bağlı olanlar tekrar yazılmadı (`Özellikler`, `Parçalar`, `Mekanlar`, `Çizelgeler`, `Sorular`, `Bağlı modeller`, `Kontrol listesi`, `Kopyalar`, `Antetler`, `Not açıklamaları`, `Pano görünümü`, `Fiyat kitabı`, `Geçmiş`, `Eklentiler`, `Tasarım limitleri`, `Sürümler`, `Sorumluluklar`, `Koordinasyon bulguları`, `Değişiklik emirleri`, `Onay belgeleri`, `Henüz yerleştirilmedi`, `Görünümler ve paftalar`).

| EN (panel / durum çubuğu) | TR | Not |
|----|----|-----|
| Revisions (panel) | **Revizyonlar** | §2.4 *Revision* = **revizyon**; panel başlığı çoğul |
| Revisions on {{number}} | **{{number}} paftasının revizyonları** | §2.4 *Sheet* = pafta; §8 gereği çoğul eki sayıdan **sonra gelmez** |
| Show / Show in {{view}} | **Göster** / **{{view}} içinde göster** | Yan panelin görünürlük bölümü; görünüm adı yer tutucu |
| Views, sheets and model filters (rail erişilebilir adı) | **Görünümler, paftalar ve model filtreleri** | `aside` bölgesinin adı |
| Coordination (pane) | **Koordinasyon** | §4'te grup adı olarak da var; aynı sözcük |
| Close {{name}} (Esc) | **{{name}} penceresini kapat (Esc)** | Pane kapatma düğmesi; ad **küçük harfe çevrilmez** (Türkçe İ/I sorunu). İngilizcede ad cümle içinde küçük harfe indirilir ("Close checklist (Esc)"), Türkçede inmez |
| Close properties / Close Spaces / Close panel view | **Özellikler penceresini kapat** / **Mekanlar penceresini kapat** / **Pano görünümünü kapat** | Panellerin kendi kapatma düğmeleri; İngilizce metinleri ayrı ayrı korunur (birebir aynı kalsın diye tek anahtara indirilmedi) |
| Close Not placed yet | **Henüz yerleştirilmedi penceresini kapat** | Kendi cümlesi olan kapatma düğmesi |
| Show {{name}} / Collapse {{name}} / Collapse {{name}} to a strip / Resize {{name}} | **{{name}} panelini göster** / **{{name}} panelini daralt** / **{{name}} panelini şeride daralt** / **{{name}} panelini yeniden boyutlandır** | Yan panelin (Properties) kendi fiilleri. Panel adı **zaten çevrilmiş** gelir, bu yüzden fiiller de anahtarlanır: `Collapse Özellikler` yarısı Türkçe yarısı İngilizce bir düğme olurdu. İngilizcede ad olduğu gibi kalır (cümle içinde küçük harfe **inmez**): "Collapse Properties" |
| Panel view: {{name}} | **Pano görünümü: {{name}}** | Canlı pano görünümünün bölge adı; panel adı model verisinden gelir |
| Place a part / Stop placing | **Parça yerleştir** / **Yerleştirmeyi durdur** | §4'teki **Parçalar** bu panelin *adı*; bu ikisi panelin içindeki başlık ve durdurma düğmesidir |
| Floor plan / Ceiling plan | **Kat planları** / **Tavan planları** | Görünümler ve paftalar listesinin başlıkları (tekil: *kat planı*, *tavan planı*) |
| Section / 3D view / Detail view (liste başlıkları) | **Kesitler** / **3B görünümler** / **Detay görünümleri** | §9/Ç11 *Section* = kesit; §2.4 *View* = görünüm; tekil: *kesit*, *3B görünüm*, *detay görünümü* |
| Connected. All changes saved | **Bağlandı. Tüm değişiklikler kaydedildi** | §8 durum sözlüğü |
| View only — live editing not connected | **Yalnızca görüntüleme — canlı düzenleme bağlı değil** | §8 *View only* = **Yalnızca görüntüleme**; tire işareti korunur |
| View only — live editing isn't set up yet | **Yalnızca görüntüleme — canlı düzenleme henüz kurulmadı** | §8 |
| No access to edit this model | **Bu modeli düzenleme yetkiniz yok** | §8 |
| Not connected | **Bağlantı kurulamadı** | §8'deki *Bağlantı kurulamıyor* sürmekte olan denemedir; bu bir **durum** |
| Reconnecting… / Connecting… / Saving… | **Yeniden bağlanıyor…** / **Bağlanıyor…** / **Kaydediliyor…** | §8 |
| Checking the connection… | **Bağlantı kontrol ediliyor…** | §8 |
| Catching up with others' changes… | **Başkalarının değişiklikleri alınıyor…** | §8 |
| Not saved yet — retrying / Not saved yet ({{n}}) — retrying | **Kaydedilmedi — yeniden deniyor** / **Kaydedilmedi ({{n}}) — yeniden deniyor** | §8 *Kaydedilmedi* |
| Offline: changes kept on this computer / Offline: {{edits}} kept on this computer | **Çevrimdışı: değişiklikler bu bilgisayarda tutuluyor** / **Çevrimdışı: {{edits}} bu bilgisayarda tutuluyor** | §8 *Bu bilgisayar çevrimdışı* + düzenlemelerin kaybolmadığı söylenir |
| Reconnecting… {{edits}} kept on this computer | **Yeniden bağlanıyor… {{edits}} bu bilgisayarda tutuluyor** | Aynı gerekçe |
| 1 edit / {{n}} edits | **1 düzenleme** / **{{n}} düzenleme** | §8: Türkçede sayıdan sonra çoğul eki yok |
| Live editing: {{label}}. Show details | **Canlı düzenleme: {{label}}. Ayrıntıları göster** | Durum rozetinin erişilebilir adı; etiket zaten çevrilidir |
| Try now | **Şimdi dene** | Rozetin «yeniden bağlan» düğmesi |
| The model server has every edit you made. Others see them live. | **Yaptığınız her düzenleme model sunucusunda; başkaları canlı görüyor.** | Rozet açıklaması |
| Your latest edit is on its way to the model server. | **Son düzenlemeniz model sunucusuna gidiyor.** | Rozet açıklaması |
| Opening the live connection to the model server. | **Model sunucusuna canlı bağlantı açılıyor.** | Rozet açıklaması |
| The model server is up but can't save right now. Your edits are kept and sent again. | **Model sunucusu çalışıyor ama şu anda kaydedemiyor. Düzenlemeleriniz tutuluyor ve yeniden gönderilecek.** | Rozet açıklaması |
| New work goes in / built in | **Yeni iş şu gruba girer:** / **şu fazda inşa edilir:** | Alt durum çubuğu: seçimden önce gelen etiketler; iki nokta üst üste ile biter |
| Active group and phase / Active group / Active phase | **Etkin grup ve faz** / **Etkin grup** / **Etkin faz** | §4 *Groups and phases* = **Gruplar ve fazlar** |
| (locked) | **(kilitli)** | §8 *kilitli*; grup seçicide ada eklenir |
| New ducts, pipes and parts go in this group. Edit groups in {{path}}. | **Yeni kanallar, borular ve parçalar bu gruba girer. Grupları {{path}} bölümünden düzenleyin.** | §9/Ç17 kanal/boru; yol (`{{path}}`) kodda `Manage › Groups & phases` |
| New elements are created in this phase; Demolish removes them in it. | **Yeni elemanlar bu fazda oluşturulur; Yıkım onları bu fazda kaldırır.** | §2.1 *Element* = eleman |

### 4.3 Aşama 3'te eklenen operatör ve boş durum sözcükleri (2026-11-10, Task 3.3)

Modelin **ret cümleleri** (18 kod), **bağlantı sorunları**, **araç engelleri** ve **boş değerler** çevrilirken eklenen sözcükler. Cümlelerin tamamı `packages/bim-editor/locales/tr/editor.json` içinde ve `__tests__/i18n-operator-messages.test.ts` ile sabitlenmiştir; buraya **terim kararları** yazılır.

> **Kural (bu bölüm için bağlayıcı):** ret cümlesi iki şeyi söyler — *neyin durdurduğunu* ve *ne yapılacağını*. Çevirirken cümle yumuşatılmaz, iki ayrı sebep tek belirsiz cümleye indirilmez, "ne yapmalı" adımı atlanmaz.

| EN | TR | Not |
|----|----|-----|
| Can't reach the model server / This computer is offline / Checking the connection | **Bağlantı kurulamıyor** / **Bu bilgisayar çevrimdışı** / **Bağlantı kontrol ediliyor** | §8 durum sözlüğü birebir |
| You're signed out / The model server refused your sign-in | **Oturumunuz kapalı** / **Model sunucusu oturum açmanızı reddetti** | §8 |
| Live editing isn't set up for this project yet / No access to edit this model | **Bu proje için canlı düzenleme henüz kurulmadı** / **Bu modeli düzenleme yetkiniz yok** | §8 |
| The model server said: {{reason}} | **Model sunucusu şunu söyledi: {{reason}}** | Sunucunun kendi sözü **çevrilmez**, olduğu gibi aktarılır: reddin hangi erişim olduğunu yalnız o söyler |
| project lead | **proje yöneticisi** | §6 *Owner* = **işveren** değil; projeye erişim veren kişi |
| Reconnecting to the model server | **Model sunucusuna yeniden bağlanılıyor** | §8 *Yeniden bağlanıyor…* ile aynı kök |
| out-of-date model | **güncel olmayan model** | Bayat model üzerine çizim yapılmadığını söyleyen cümlede |
| Add a level first / Choose a part / Fix the size first / Choose a system | **Önce bir kat ekleyin** / **Bir parça seçin** / **Önce boyutu düzeltin** / **Bir sistem seçin** | §0.7 kibar çoğul emir; §2.1 *part* = **parça** |
| Open a plan on this sheet first / this sheet | **Önce bu paftada bir plan açın** / **bu pafta** | §2.4 *Sheet* = **pafta** |
| Add a level… / Add {{name}} at {{at}} | **Kat ekle…** / **{{name}} katını {{at}} yüksekliğinde ekle** | §2.3 *Level* = **kat**; `{{at}}` = `0'-0"` ve §7 gereği birim sembolü çevrilmez |
| Use the architect's levels | **Mimarın katlarını kullan** | §2.8 |
| Can't {{doing}} here / Can't {{doing}} while reconnecting | **Burada {{doing}} işlemi yapılamaz** / **Yeniden bağlanırken {{doing}} işlemi yapılamaz** | `{{doing}}` burada **ad** hâlidir, fiil değil: Türkçe aynı fiili üç kalıba (burada / yeniden bağlanırken / tıklamalar hiçbir şey …) koyamaz |
| place parts / route / move / split (eylem adı) | **parça yerleştirme** / **güzergâh çizme** / **taşıma** / **bölme** | §3 *Place* = Yerleştir, *Route* = Güzergâh çiz, *Move* = Taşı, *Split* = Böl |
| Nothing yet: … / Nothing to read yet | **Henüz bir şey yok: …** / **Henüz okunacak bir şey yok** | §8 *Nothing …* = **Hiçbir şey …** kalıbının "henüz" hâli |
| None yet | **Henüz yok** | §8 |
| Not set | **Ayarlanmadı** | §8 |
| Mixed groups | **Karışık gruplar** | §8 *Mixed phases* = **Karışık fazlar** |
| Not demolished | **Yıkılmadı** | §2.3 *Phase* = **faz**; *Demolish* = **Yıkım** |
| Not calculated | **Hesaplanmadı** | §2.4 *Calculation* = **hesap** |
| No fan yet / Not fed yet | **Henüz fan yok** / **Henüz beslenmiyor** | §2.8 *fan*; besleme = bir elemanın kaynağı |
| From project: {{name}} | **Projeden: {{name}}** | Bir parametrenin proje varsayılanı; düğmede, seçicide ve yer tutucuda **aynı** anahtar |
| from the project, {{name}} / not set (erişilebilir ad) | **projeden, {{name}}** / **ayarlanmadı** | Aynı alanın ekran okuyucuya söylenen hâli; cümle içinde küçük harf |
| Pick a date | **Tarih seçin** | Tarih parametresinin boş hâli |
| Not on a circuit / Not fed yet | **Devrede değil** / **Henüz beslenmiyor** | Bir yükün bağlantı durumu |
| No voltage set: … | **Gerilim ayarlanmadı: …** | §0.7 kibar çoğul emir; "ne yapmalı" adımı korunur |
| None linked yet. … | **Henüz bağlı yok. …** | §8 *None yet* = **Henüz yok** + bağlı model (§2.2) |
| Totals appear once the model is connected. | **Model bağlandığında toplamlar görünür.** | Boş toplam listesi |
| No change to save. / No change to put back. | **Kaydedilecek değişiklik yok.** / **Geri konacak değişiklik yok.** | Devre dışı düğmenin sebebi (`title`) |
| All levels | **Tüm katlar** | §8 |
| None connected yet | **Henüz bağlı yok** | Hidrolik özetin boş hâli; §8 *No … yet* ailesi |
| Live editing isn't connected for this project, so views and sheets can't be made here yet. | **Bu proje için canlı düzenleme bağlı değil, bu yüzden görünümler ve paftalar burada henüz oluşturulamaz.** | Salt okunur görünümün **tek** gerekçesi: araç uyarısı, ribbon'ın devre dışı sebepleri, özellik panelleri ve toast aynı cümleyi gösterir (`editingOffReason()`), ikinci bir söylem tutulmaz |
| You can look, but you don't have editing access to this model. Ask a project lead. | **Görüntüleyebilirsiniz, ama bu modelde düzenleme yetkiniz yok. Proje yöneticisinden izin isteyin.** | §8 *Bu modeli düzenleme yetkiniz yok* + "ne yapmalı" adımı |
| Connecting to the model server… | **Model sunucusuna bağlanılıyor…** | §8 |
| This model server doesn't merge branches yet. / …doesn't open branches yet, so the design can't be updated here. | **Bu model sunucusu henüz dalları birleştirmiyor.** / **Bu model sunucusu henüz dal açmıyor, bu yüzden tasarım burada güncellenemez.** | Sunucunun yetmediği yer; §9/Ç8 *branch* = **dal** (tasarım dalı) |


### 4.3 Aşama 4 · Task 4.5: ribbon ipuçları ve komut sözcükleri (2026-11-10)

Ribbon'un **her araç ipucu** (`description`, `tooltipFor()` ile hover'da görünür) ve
araç etiketleri bu görevde anahtarlanırken sözlükte olmayan sözcükler çıktı. Hepsi
burada karara bağlandı; §4.1 ve §4.2'de zaten karara bağlı olanlar tekrar yazılmadı.

| EN (ipucu / komut) | TR | Not |
|----|----|-----|
| Ribbon (şeridin kendisi) | **şerit** | "Şeridi genişlet", "Şeridi tek satıra daralt"; sekme/grup **adları** değişmez |
| Crop box (3D crop box) | **kırpma kutusu** | §3 *Crop* = Kırp; kutu onun aracı. "3B kırpma kutusu" |
| Rise / Drop (güzergâh) | **yükselme / iniş** | Fiil: "yüksel", "in"; §4.1 *Height* = Yükseklik bunlardan ayrı |
| {{angle}} rises | **{{angle}} eğimli yükselme** | §8: sayıdan sonra çoğul eki gelmez |
| Reducer / Eccentric | **redüksiyon** / **eksantrik** | "Ortalanmış ya da üstten veya alttan düz (eksantrik)" |
| Masking region / Filled region | **maskeleme bölgesi** / **dolu bölge** | §2.4 *Region* = bölge |
| Component (detail component) | **bileşen** | §2.1 *Part* = parça'dan ayrı: bu 2B detay bileşenidir |
| Spline | **spline** | Türkçe yerleşik karşılığı yok; çevrilmez (§0.3 mantığı) |
| Plan north | **plan kuzeyi** | §2.3 *True north* = gerçek kuzey, *Working angle* = çalışma açısı |
| Survey point / Project base point | **ölçüm noktası** / **proje temel noktası** | §2.3 *Site point* = şantiye noktası'ndan ayrı üç kavram |
| Shared coordinates / Shared site | **ortak koordinatlar** / **ortak şantiye** | |
| Code (of record) / Code study | **kural** / **kural çalışması** | "Kurallar" grubu; *code* = kural (yönetmelik değil) |
| Live table / Load summary / Keynote list | **canlı tablo** / **yük özeti** / **anahtar not listesi** | §2.4 *Keynote* = anahtar not |
| Performance (FPS sayacı) | **başarım** | "Başarım"; "performans" değil |
| Area load / Separation line / Vendor list | **alan yükü** / **ayırma çizgisi** / **tedarikçi listesi** | §2.3 *Space* = mekan; alan yükü mekanın yüküdür |
| Dimension kinds: Linear / Aligned / Angle / Radius / Diameter / Arc length / Spot elevation / Spot coordinate | **Doğrusal / Hizalı / Açı / Yarıçap / Çap / Yay uzunluğu / Nokta kotu / Nokta koordinatı** | §2.4 *Dimension* = ölçü; bunlar ölçünün **türleri** |
| Keep / Skip (pencere seçimi süzgeci) | **korunur / atlanır** | Cümle içinde: "Pencere seçimlerinde Kanal korunur" |
| Open as a spreadsheet (çizelge) | **elektronik tablo olarak aç** | §9/Ç3: *sheet* = **pafta**; *spreadsheet* yalnız burada *elektronik tablo* |
| Quick (araç arama sekmesi) | **Hızlı** | §4'teki **Hızlı erişim** ile aynı kök |

> **İpucu = cümle, etiket = emir kipi.** §0.7 burada en çok uygulanan kural oldu:
> `description` alanları kibar çoğul emir kipidir ("…tıklayın", "…seçin", "…basın"),
> `label` alanları tekil emir kipidir (*Seç*, *Böl*, *Kırp*, *Güzergâh çiz*). Bir
> ipucunu kısaltıp ada çevirmek yasak: ipucu **ne yaptığını ve sonra ne olacağını**
> söyler. Ölçüldü: ribbon kaynaklarında 590 `ribbon.*` anahtarı var; hepsi bu kurala
> göre yazıldı.

> **İngilizce yer tutucu sırası.** Şablonla kurulan ipuçlarında İngilizce
> değişmedi (`Draw a {{shape}} on this drawing…`), Türkçede ise etiket cümlenin
> başına alındı (`{{kind}} ölçüsü çiz`): Türkçede **nesne fiilden önce** gelir, bu
> yüzden İngilizce sırası birebir çevrilmez. Bu bir sapma değil, §0.2'nin sonucudur.

### 4.3 Aşama 4'ün üst düzey dosyalarında eklenen sözcükler (2026-11-10)

`packages/bim-editor/src/editor/*.ts|tsx` — yani kabuk (`BuildingModelSurface`), oturum
(`model-session`), yerleştirme (`placement`), güzergâh yardımcıları (`route-*`) ve
sekmeyle seçim (`tab-select`) — çevrilirken bu sözcüklerin sözlükte hiç olmadığı görüldü.
§0.1 gereği her kavram tek Türkçeye indi:

| EN | TR | Not |
|----|----|-----|
| Slab | **döşeme** | §2.2 *Part* = parça; döşeme bir ev sahibi elemandır |
| Riser (düşey boru/kanal) | **düşey hat** | §2.8 *Run* = **hat**; düşey olanı |
| Elbow | **dirsek** | §2.8 *Fitting* = bağlantı parçası; dirsek onun bir türü |
| Offset (bir engelin çevresinden dolanma) | **kaydırma** | Güzergâh komutu; §3'teki *Move* = taşı ile karışmaz |
| Stretch (Tab'ın seçtiği düz kesim) | **düz parça** | §2.1: *piece* = eleman; bu, bir hattın tek düz kesimi |
| Duct segment / Run segment | **kanal parçası** / **hat parçası** | §2.8 ve §9/Ç17 |
| Segment (silme onayındaki genel ad) | **eleman** | §2.1: kullanıcıya görünen metinde *piece*/*segment* sözcüğü kullanılmaz |
| Tap off / Branch off (fiil) | **ayrım çıkar** / **branşman çıkar** | §2.8 *Tap* = **ayrım**; *çıkmak* fiiliyle |
| Mounting plane | **montaj düzlemi** | §2.3'te vardı; burada yalnız doğrulandı |
| Work plane | **çalışma düzlemi** | §2.3 *Reference plane* = referans düzlemi ile karışmaz |
| Axis lock | **eksen kilidi** | §2.3 *Axis* = eksen |
| Linear feet / slope | **doğrusal fit** / **eğim** | §7 birim sembolleri çevrilmez (`in. w.c.`, `CFM`, `fpm`) |

> **Ölçü birimi notu.** `session.measureAnswer` ve `session.routeReadout` gibi satırlarda
> birim sembolleri (`CFM`, `fpm`, `in. w.c./100 ft`) §7 gereği çevrilmez; yalnızca
> cümle Türkçedir. Yön adları (**kuzey/güney/doğu/batı**) çevrilir, çünkü bunlar birim
> değil sözcüktür.

---

## 5. Çizelgeler ve metraj

**Alan adları:** İşaret · Tip · Kat · Oda · Oda içinde · Kaynak yolu · Parça tipi · Açıklama · Birim · Genişlik · Uzunluk · Yükseklik · Yangın dayanımı · K faktörü · Sıcaklık dayanımı · Moment · Depolama · Gaz girişi · Beslenen yük · Besleme yükü · Tahliye yükü · Besler · Pano · Sütun başlığı · Formül · Formül adı · Grupla · Sırala · Bölüm · Sıra · Çizelge adı · Boş hücreler · Yalnızca şu koşuldaki satırlar · Tek özet değeri · Bir sayı · Evet veya hayır · Metin · Yazdırılmaz · Kullanımdan kaldırıldı · Toplam (sum/max/min/none → **toplam/azami/asgari/yok**)

**Miktar türleri:** Sayı · Oran · Eğim · Adet · Kullanıcı yükü · Uzunluk · Alan · Hacim · Ağırlık · Süre · Açı · Kuvvet · Moment · Gerilme · Basınç · Alan yükü · Çizgi yükü · Yoğunluk · Hız · Hava debisi · Sıvı debisi · Gaz debisi · Kütle debisi · Aktif güç · Motor gücü · Görünür güç · Reaktif güç · Isıtma/soğutma kapasitesi · Gaz girişi · Enerji · Akım · Gerilim · Direnç · Birim uzunluk direnci · Frekans · Sıcaklık · Sıcaklık farkı · Işık akısı · Aydınlık düzeyi · Işık şiddeti · Sprinkler yoğunluğu · K faktörü · Su tesisatı yük birimi (WSFU) · Pis su yük birimi (DFU) · Sürtünme oranı · Yağış şiddeti · Kullanıcı yük faktörü · Maliyet · Güç yoğunluğu · Alan başına hava debisi · Kişi başına hava debisi · Kesit modülü · Atalet momenti

### 5.1 Aşama 4'te eklenen çizelge, pafta ve görünüm sözcükleri (2026-11-10)

Aşama 4 (Task 4.1–4.2) çizelgeleri, hesap sayfalarını, paftaları, görünüm özelliklerini, yönlendirmeyi ve diyagramları çevirirken bu sözcükler gerekti. Yukarıda **zaten** karara bağlı olanlar tekrar yazılmadı (`İşaret`, `Tip`, `Kat`, `Oda`, `Açıklama`, `Birim`, `Genişlik`, `Gaz girişi`, `Pafta`, `Antet`, `Çizelge`, `Görünüm`, `Detay seviyesi`, `Bölge`, `Etiket`, `Metin`, `Ölçü`, `Sembol`, `Maliyet kodu`, `Birim fiyat`, `Toplam`, `Metraj`).

| EN | TR | Not |
|----|----|-----|
| Roll-up: sum / max / min / none | **toplam / azami / asgari / yok** | §5'in "Toplam" alanının dört seçeneği; kodda `sum/max/min/none` |
| Roll-up: count / avg / list | **adet / ortalama / liste** | İlişkili eleman sütununun özet fonksiyonları (`count`, `avg`, `list`) |
| Stage (inşaat aşaması) | **aşama** | §2.3 *Phase* = faz ile karışmaz; maliyet tablosunun sütunu |
| Quantity | **miktar** | §6 |
| Amount | **tutar** | Maliyet tablosunun son sütunu |
| Element (çizelge satırı) | **eleman** | §2.1 |
| Calculation | **hesap** | §2.4 |
| Governing cell | **belirleyici hücre** | Hesap tablosunda sonucu belirleyen satır/hücre |
| Explanation / trace | **açıklama** | §2.4 *Annotation* = açıklama ile aynı sözcük; bağlam ayrıştırır |
| Visual style: wireframe / hidden line / shaded / shaded with edges | **tel kafes / gizli çizgi / gölgeli / gölgeli ve kenarlı** | Görünüm özellikleri › Çizgiler ve renkler |
| Cut fill: cross / solid / hatch | **artı / dolu / tarama** | Kesilen kanal ve borunun dolgusu |
| Drafting: detail lines / hatching / masking regions / detail components / insulation / text and notes / dimensions / tags / revision clouds | **detay çizgileri / tarama ve dolgular / maskeleme bölgeleri / detay bileşenleri / yalıtım / metin ve notlar / ölçüler / etiketler / revizyon bulutları** | §2.4 |
| Perspective / Orthographic | **perspektif / ortografik** | 3B görünümün izdüşümü; kısa düğme yazısı **Orto** |
| Crop box / Crop view / Annotation crop | **kırpma kutusu / görünümü kırp / açıklama kırpması** | Paftaya yerleşen görüntü alanı kırpmayı izler |
| Fit crop to content / to the drawing | **kırpmayı içeriğe sığdır / çizime sığdır** | Plan vs detay görünümü |
| Far clip depth | **uzak kırpma derinliği** | Kesitin kesit çizgisinin ötesini görme mesafesi |
| View orientation / Home view | **görünüm yönü / ana görünüm** | Yönlendirme araç çubuğu |
| Above, from the south-east | **yukarıdan, güneydoğudan** | Dörtte üç görünümler; yön adları §2.3 |
| Three-quarter views | **dörtte üç görünümler** | "three-quarter" = **dörtte üç**; *çeyrek* "a quarter" demektir — bu bir çeviri hatasıydı, düzeltildi (2026-11-10). |
| Diagram / One-line / Riser / Isometric | **diyagram / tek hat / kolon şeması / izometrik** | §2.4 *Riser diagram* = kolon şeması |
| Grid | **ızgara** | §2.3 |
| Title block / Paper | **antet / kâğıt** | §2.4 |
| Machine / Project information | **proje bilgileri** | Her paftanın antedine yazılan künye |
| Retired (library item) | **kullanımdan kaldırıldı** | §5 alan adları |

### 5.2 Aşama 4 düzeltme turunda eklenen sözcükler (2026-11-10)

Çizelge/pafta/görünüm çevirisinin ikinci geçişi (çizim araçları, notlar, etiketler, çizim seti, koordinatlar) bu sözcükleri gerektirdi. Yukarıda karara bağlı olanlar tekrar yazılmadı.

| EN | TR | Not |
|----|----|-----|
| Arrange / Even grid / Rows, in order | **Düzenle** / **Eşit ızgara** / **Sırayla satırlar** | Paftadaki görünümleri yerleştirme |
| Half tone / halftone | **yarım ton** | §2.4 |
| Drawing aids | **çizim yardımcıları** | Orto ve kutup izleme ile birlikte |
| Snap: endpoint / midpoint / centre / intersection / perpendicular / nearest | **uç noktalar / orta noktalar / merkezler / kesişimler / dik / en yakın nokta** | |
| Ortho / Polar | **Orto / Kutup** | Kısa düğme yazıları |
| Hatch pattern: solid / diagonal / crosshatch / dots / concrete / earth / rigid insulation / masonry | **dolu dolgu / çapraz / çapraz tarama / noktalar / beton / toprak / sert yalıtım / duvar örgüsü** | |
| Inscribed / Circumscribed | **içten teğet / dıştan teğet** | Çokgen oturtma |
| Detail group / Ungroup | **detay grubu** / **grubu çöz** | |
| Leader / Elbow / Arrowhead: arrow / dot / tick / none | **kılavuz / dirsek / ok ucu: ok / nokta / çentik / oksuz** | Etiket ve nota kılavuzları |
| Dimension: linear / aligned / angular / radius / diameter / arc length / spot elevation / spot coordinate | **doğrusal ölçü / hizalı ölçü / açısal ölçü / yarıçap / çap / yay uzunluğu / nokta kotu / nokta koordinatı** | §2.4 *Dimension* = ölçü |
| Tag template (mark, equipment mark, air terminal…) | **etiket şablonu** (*işaret*, *ekipman işareti*…) | §5 *Mark* = işaret |
| Note formatting: bold / italic / underline / bullets / numbered list / align left / centre / right / justify | **kalın / italik / altı çizili / madde işaretleri / numaralı liste / sola hizala / ortala / sağa hizala / iki yana yasla** | |
| Print set / Print the set again / Issue set / Verify pages / Issued drawings | **seti yazdır / seti yeniden yazdır / set yayınla / doğrulama sayfaları / yayınlanmış çizimler** | |
| Revision row / add revision | **revizyon satırı** / **revizyon ekle** | §2.3 *Revision* = revizyon |
| Layout / plan north / true north up | **yerleşim** / *plan kuzeyi* / *gerçek kuzey yukarı* | §2.3 |
| Snap to (verb) | **yakalanmak** ("… elemanına yakalandı") | §2.1: `öğe` değil |

### 5.3 Aşama 4 ikinci düzeltme turunda eklenen sözcükler (2026-11-10)

Çizim araçları, modify komutları, çizim seti ve etiket kılavuzlarının tamamı çevrilirken bunlar gerekti.

| EN | TR | Not |
|----|----|-----|
| Move / Copy / Rotate / Mirror / Scale / Align / Offset | **Taşı / Kopyala / Döndür / Aynala / Ölçekle / Hizala / Kaydır** | §3 komutları |
| Array / Radial array | **Dizi / Açısal dizi** | |
| Trim/Extend (to corner / single / multiple) | **Kısalt/Uzat** (*köşeye kadar / tek / çoklu*) | §3 *Trim* = Kısalt, *Extend* = Uzat |
| Split element / Split with gap | **Elemanı böl / Aralıklı böl** | |
| Fillet arc | **Yuvarlat** | §3 *Fillet* = Yuvarlat |
| Pin / Unpin | **Sabitle / Sabitlemeyi kaldır** | |
| Nudge (arrow keys) | **kaydır** | Ok tuşlarıyla |
| Base point / centre | **taban nokta / merkez** | |
| Snap word: endpoint / midpoint / centre / intersection / perpendicular / nearest | **uç nokta / orta nokta / merkez / kesişim / dik / en yakın nokta** | Yakalama ipucu ve izleme satırı |
| Grip | **tutamak** | Sürükleme tutamacı |
| Chain of lines / closed chain | **çizgi zinciri / kapalı çizgi zinciri** | |
| Repeating detail / insulation run | **tekrarlanan detay / yalıtım hattı** | |
| Draw / drafting prompt | **"… tıklayın"** cümlesi | §0/7 kibar çoğul emir |
| Spread tags | **Etiketleri dağıt** | Bir tutamaçla; "dağıt" §3 |
| Straighten leader / bend the leader | **Kılavuzu düzelt / kılavuzu kır** | Kılavuz = leader (§2.4 *Annotation*) |
| Elbow | **kırık** | Kılavuzun elle konan kırığı |
| Verify pages / issued drawings | **doğrulama sayfaları / yayınlanmış çizimler** | §6 *Issue* = yayın |
| Print and issuing sets | **Set yazdırma ve yayınlama** | Hizmet adı; `unavailableWords` cümlesine girer |
| Title block library | **Antet kitaplığı** | §2.4 *Title block* = antet |
| Pictures on sheets | **Paftalardaki resimler** | Hizmet adı |
| Drawing / sheet paper | **Çizim / pafta** | §2.4 |
| Keynote list | **anahtar not listesi** | §2.4 *Keynote* = anahtar not |

### 5.4 Aşama 4 üçüncü düzeltme turunda eklenen sözcükler (2026-11-10)

Çizim tutamaçları, geri alma etiketleri ve görünüm kategorileri çevrilirken bunlar gerekti.

| EN | TR | Not |
|----|----|-----|
| Crop box grip: top / bottom / left / right edge | **üst / alt / sol / sağ kenar** | |
| Crop box grip: top-left / top-right / bottom-left / bottom-right corner | **sol üst / sağ üst / sol alt / sağ alt köşe** | |
| Note edge grip: left / right edge (width), bottom edge (fixed height) | **sol / sağ kenar (genişlik), alt kenar (sabit yükseklik)** | |
| Leader bend (aria) | **kılavuz kırığı** | §2.4 *Annotation* = açıklama; kılavuz = leader |
| View category: duct / duct fittings / pipe and fittings / air terminals / equipment / walls / doors and windows / rooms / grids / structure / tags / dimensions / electrical devices / lighting fixtures / panels and electrical equipment / duct and pipe insulation | **kanal / kanal bağlantı parçaları / boru ve bağlantı parçaları / hava terminalleri / ekipman / duvarlar / kapılar ve pencereler / odalar / ızgaralar / strüktür / etiketler / ölçüler / elektrik cihazları / aydınlatma armatürleri / panolar ve elektrik ekipmanı / kanal ve boru yalıtımı** | Kernel'in `VIEW_CATEGORY_LABELS` verisi İngilizce kalır; Türkçesi `viewCategoryWord` ile söylenir (sahibi Aşama 5'in alan haritası) |
| Undo label group | **geri alma etiketi** | `undo.*` anahtarları; metinleri emir kipidir (§0.5) |
| A wall / a grid line / a duct / a run (the noun a prompt names) | **bir duvar / bir ızgara çizgisi / bir kanal / bir hat** | |

### 5.5 Aşama 4, Task 4.3–4.4'te eklenen sözcükler (2026-11-10)

MEP panelleri (basınçlandırma, havalandırma, yükler) ile proje yönetimi panelleri
(imalat onayları, değişiklik emirleri, sürümler, birleştirme, imza onayı, katlar,
ayarlar, parça listesi, IFC içe/dışa aktarma) çevrilirken bunlar gerekti. Yukarıda
**zaten** karara bağlı olanlar tekrar yazılmadı (`Pafta`, `Çizelge`, `Bölge`,
`Kat`, `Mekan`, `Maliyet`, `Birim fiyat`, `Metraj`, `Değişiklik emri`,
`İmalat onayı`, `Sürüm`, `Dal`, `Hat`, `Branşman`, `Yalıtım`, `İç kaplama`).

| EN | TR | Not |
|----|----|-----|
| Pressurization | **basınçlandırma** | §2.4 *Pressure* = basınç (sütun), basınçlandırma = bir mekanın/bölgenin |
| Makeup air / Makeup air load | **takviye hava / takviye hava yükü** | `MUA` kısaltması korunur (§0.3) |
| Outdoor air / Exhaust | **dış hava / egzoz** | `OA`, `EA` kısaltmaları korunur |
| Governing (code/standard) | **yürürlükteki** | "Yürürlükteki kod"; `Governing standard` = yürürlükteki standart |
| Ventilation (the command/panel) | **havalandırma** | |
| Fitting type / Loss coefficient / Velocity pressure | **bağlantı parçası tipi / kayıp katsayısı / hız basıncı** | §2.8 *Fitting* = bağlantı parçası |
| Critical path | **kritik yol** | Basınç hesabı; programlama anlamı yok |
| External static | **dış statik** | Fan basıncı; birim `in. w.c.` çevrilmez (§7) |
| Straight through / Branch / Upstream / Small end (fitting paths) | **düz geçiş / branşman / akış yukarısı / küçük uç** | §9/Ç8: MEP branşmanı *branşman* |
| Duct run / Pipe run (the noun) | **kanal hattı / boru hattı**; kısaca **hat** | §9/Ç9: komut *çalıştır* ile karışmaz |
| Wrap (disserve) / Liner (inliner) | **dış kaplama / iç kaplama** | §2.3 *Insulation/Liner* = yalıtım / iç kaplama |
| Faced / Spray-coated (liner surface) | **kaplamalı / püskürtmeli kaplama** | |
| Flat (transition side) | **düz taraf** | `flat on the top` = üst tarafta düz |
| Concentric / Eccentric / Centred (transition) | **konsantrik / eksantrik / ortalanmış** | |
| Flex (a duct connection) | **esnek bağlantı** | `Run flex` = esnek bağlantı çiz |
| Load status: open / assigned / placed / connected / attached / mismatch | **henüz kaynak yok / kaynak adlandırıldı, çizilmedi / yerleştirildi / bir boru, kanal ya da devrede / bir cihaz onu temsil ediyor / ilgi bekliyor** | §8: sayıdan sonra çoğul eki yok |
| Load trade word: Water and drainage / Gas / Power / Air | **su ve drenaj / gaz / elektrik / hava** | Kernel'in `LOAD_TRADE_PROGRESS` etiketi İngilizcedir; sözcük `loadTradeWord` ile seçilir (sahibi Aşama 5 alan haritası) |
| Submittal / Approved product / Approved substitution | **imalat onayı / onaylı ürün / onaylı ikame** | §6/Ç19 |
| Review of / Rev | **… incelemesi / rev** | `Rev` kısaltması korunur (§0.3) |
| Change order (the record) | **değişiklik emri** | §6; *tasarım değişikliği* ayrı kavramdır |
| Addressee / Address to | **muhatap / … kişisine yönelt** | |
| No cost / Mark no cost | **maliyetsiz / maliyetsiz işaretle** | §6 |
| Price book / Priced with a book | **fiyat kitabı / … kitabıyla fiyatlandırıldı** | §6 |
| Quantity change / Quantity only | **miktar değişimi / yalnız miktar** | §6, §8 |
| Saved version / Issued set / New branch from this version | **kayıtlı sürüm / yayın seti / bu sürümden yeni dal** | §2.2/§6; *dal* = sürüm dalı (§9/Ç8) |
| Kind of change / What kind of change was this? | **değişiklik türü / bu ne tür bir değişiklikti?** | |
| Take responsibility / Responsible for the difference | **sorumluluk al / farktan sorumlu** | §2.2 *Responsible role* = sorumlu rol |
| Merge / Propose merge to Main / Approved parts | **birleştir / Ana hatta birleştirme öner / onaylı parçalar** | `Main` = **Ana hat** (dalın karşısındaki ana hat) |
| Sign-off / Verified / One-time code | **imza onayı / doğrulandı / tek kullanımlık kod** | §6 |
| Architect's levels | **mimarın katları** | §2.8 |
| Storey (linked model) | **kat** | §2.3 |
| Floor (elevation in ft) | **kat kotu (ft)** | `ft` birim sembolü çevrilmez (§7) |
| Part type / Part types / Edit part | **parça tipi / parça tipleri / parçayı düzenle** | §2.2 |
| Add-on / Switch on / Switch off | **eklenti / aç / kapat** | §2.7 |
| Export IFC / IFC export | **IFC dışa aktar / IFC dışa aktarma** | `IFC` kısaltması korunur (§0.3) |
| Linked model (IFC içe aktarma) | **bağlı model** | §2.2 |
| Data-use agreement | **veri kullanım anlaşması** | |
| Country of origin: unit symbols | `kVA`, `CFM`, `fpm`, `in. w.c.`, `A`, `V`, `Pa`, `ft`, `Btu/h` **çevrilmez** | §7 — bu turda yalnız `bal.`/`vent.` sütun başlıklarında görünür |

> **Bu turda kapanmayan ağaçlar.** `questions/` (213), `equipment-list/` (110),
> `library/` (68) ve `coordination/` (58) **henüz tamamlanmadı**; bu yüzden Ç20
> (*Sahip* / *İşveren*) hâlâ İngilizcedir ve negatif-alan koruması o ağaçları
> **taramasın** diye `NOT_YET_GUARDED` listesinde adlandırılmıştır
> (`packages/bim-editor/__tests__/i18n-negative-space.test.ts`).
> Sahibi: Aşama 4'ün kalan turları; gerekçe ve sayılar görev raporundadır
> (`.superpowers/sdd/2026-11-10-bilingual-ui/trees-electrical-spaces-plumbing-report.md`).
>
> **`plumbing/` kapandı (2026-11-10, beşinci tur).** Ağacın tamamı anahtarlı:
> 402 site sıfıra indi (0 site, 0 dosya) ve ağaç `NOT_YET_GUARDED`'dan çıktı;
> sözcükleri §5.7'dedir. Ç12'nin sıhhi tesisat yarısı (*armatür* / *yük birimi*,
> WSFU/DFU sütunları), Ç8'in tesisat tarafı (*branşman*), Ç9 (*hat* / *çalıştır*),
> Ç17 (*boru* / *kanal*) ve Ç13 (*debi* / *eğim* / *sürtünme*) artık
> `i18n-plumbing.test.tsx` içinde ölçülür.

> **`spaces/` kapandı (2026-11-10, dördüncü tur).** Ağacın tamamı anahtarlı:
> 427 site sıfıra indi ve ağaç `NOT_YET_GUARDED`'dan çıktı; sözcükleri §5.6'dadır.
> Türkçesi `i18n-spaces.test.tsx` içinde ölçülür: §2.3 (*mekan*, asla *alan*),
> §7 (birim sembolleri yerinde kalır) ve §8 (sayıdan sonra çoğul eki yok).
>
> **`electrical/` kapandı (2026-11-10, üçüncü tur).** Ağacın tamamı anahtarlı:
> 265 site sıfıra indi, yarım kalan turun bıraktığı **97** ulaşılamaz anahtar
> (`electrical.aBus`, `electrical.aServiceLayout`,
> `electrical.yourFirmAposSConventionTheFirstRuleThatMatch` gibi cümle
> artıklarından otomatik türetilmiş adlar) silindi ve ağaç
> `NOT_YET_GUARDED`'dan çıktı. Ç7 (*pano* / *panel*), Ç8'in elektrik yarısı
> (*branşman devresi*) ve Ç12 (*armatür*) artık `i18n-mep.test.tsx` içinde
> ölçülür. Aşağıdaki elektrik satırları bu turda kesinleşti:
>
> | EN | TR | Not |
> |----|----|-----|
> | Branch circuit | **branşman devresi** | §9/Ç8; sürüm dalı *dal* kalır |
> | Home run | **ana hat** | |
> | Slot / Position (panel) | **pozisyon** | |
> | Bus / Bus amps | **bara** / **bara amperi** | `A` çevrilmez (§7) |
> | Density (receptacles) | **sıklık** | Kod asgarisi değil, kişinin seçimi |
> | Designator | **tanımlayıcı** | |
> | Room template / Rule | **oda şablonu** / **kural** | |
> | Dedicated space | **ayrılmış boşluk** | *alan* DEĞİL (§2.3) |
> | Panel schedule / Panel view | **pano çizelgesi** / **pano görünümü** | §2.4 |
> | Toggle group: New work / Existing | **Yeni iş / Var olan** | §8 durum sözlüğü |
> | Undo labels | emir kipi, tek satır | §0.5/§0.7 |


>
> **Aşama 4 · Task 4.3 elektrik sözcükleri (2026-11-10, ikinci tur).** Elektrik
> panolarının çevrilen kısmı için karara bağlananlar:
>
> | EN | TR | Not |
> |----|----|-----|
> | Panel / Panelboard (electrical) | **pano** | §9/Ç7; UI yan paneli **panel** kalır |
> | Panel schedule / Panel view | **pano çizelgesi** / **pano görünümü** | §2.4 |
> | Switchboard | **şalter panosu** | Ana şalter panosu = **ana şalter panosu** |
> | Main breaker / Main lugs | **ana şalter** / **ana pabuç** | |
> | Feeder / Feeder type / Feeder schedule | **besleme** / **besleme tipi** / **besleme çizelgesi** | |
> | Receptacle | **priz** | Duplex = **ikili priz**; GFCI korunur |
> | Light / Luminaire (fixture) | **armatür** | §9/Ç12; panel armatür, gömme spot |
> | Junction box | **bağlantı kutusu** | |
> | Disconnect / Safety switch | **ayırıcı** / **şalter** | |
> | Transfer switch / ATS | **transfer şalteri** / **otomatik transfer** | |
> | Meter and CT cabinet | **sayaç ve akım trafo kabini** | |
> | Tap box | **branşman kutusu** | |
> | Home run | **ana hat** | |
> | Branch circuit | **branşman devresi** | §9/Ç8 |
> | Load center | **yük merkezi** | |
> | Service / Service size / Service layout | **servis** / **servis boyutu** / **servis yerleşimi** | |
> | Dedicated space (NEC 110.26(E)) | **ayrılmış boşluk** | *alan* DEĞİL (§2.3) |
> | Fault current / Available fault current | **kısa devre akımı** / **mevcut kısa devre akımı** | |
> | Load class | **yük sınıfı** | |
> | Continuous load | **sürekli yük** | |
> | Unit (dwelling) | **ünite** | Konut ünitesi; §2.3 *space* = mekan |
> | Room template | **oda şablonu** | §2.3 *room* = oda |
> | Connection type / Designator | **bağlantı tipi** / **tanımlayıcı** | |
> | Riser diagram / One-line diagram | **kolon şeması** / **tek hat diyagramı** | §2.4 |

---

### 5.6 Aşama 4, Task 4.4: mekanlar paneli sözcükleri (2026-11-10)

`packages/bim-editor/src/editor/spaces` çevrilirken bunlar gerekti. Yukarıda
**zaten** karara bağlı olanlar tekrar yazılmadı (`Mekan`, `Oda`, `Kat`, `Bölge`,
`Yangın bölgesi`, `Altlık`, `Alan`, `Kullanım`, `Kullanıcı`, `Yük`).

| EN | TR | Not |
|----|----|-----|
| Fire area (the zone made from rated walls) | **yangın bölgesi** | §2.3/Ç15; adı `spaces.fireAreaName` = *Yangın bölgesi {{number}}* |
| Rated wall / Rating / At least | **dereceli duvar / derece / en az** | `1 hour or more` = *1 hour ve üzeri* — derece verisi çevrilmez |
| Separation line / Sub-room | **ayrım çizgisi / alt oda** | Bir odayı bölen çizgi; alt odalar o odanın altındadır |
| Room from walls / Find rooms from walls | **duvarlardan oda / duvarlardan oda bul** | Komut etiketi tekil (§0.5), menü satırı cümle |
| Propose rooms from this drawing | **bu çizimden oda öner** | Hiçbir şey kabul edilene kadar yazılmaz |
| Dismiss / Dismissed | **yok say / yok sayıldı** | Öneriyi reddetmek değil, listeden düşürmek |
| Keep mine / Update from the link | **benimkini koru / bağlantıdan güncelle** | Ç10: izlenen nesne *kopya*, komut *Kopyala* |
| Code zone / Code clearance | **kod bölgesi / kod boşluğu** | Ç15; NEC 110.26(E) boşluğu *ayrılmış boşluk* olarak §5.5'te |
| Drawn outline / Follows (a derived zone) | **çizilmiş sınır / … izler** | `zoneBoundsLine` |
| Scale set / Not calibrated: tracing is off / Rescale | **ölçek ayarlandı / kalibre edilmedi: üzerinden çizme kapalı / ölçeği değiştir** | Ölçek yoksa üzerinden çizme kapalıdır |
| Tracing over {{drawing}} | **{{drawing}} üzerinden çiziliyor** | Altlık = *altlık* (§2.3) |
| Load basis: Total / Per sq ft | **toplam / ft² başına** | §5 miktar türleri; `sq ft` birim sembolü çevrilmez (§7) |
| Counting policy: max / actual only / allocation only | **ikisinden büyüğü / yalnız cihazlar / yalnız tahmin** | Cümleleri `spaces.policyMax`, `policyActualOnly`, `policyAllocationOnly` |
| Occupants typed / from the use | **kullanıcı (yazıldı) / (kullanımdan)** | Kullanıcı yükü veriden gelir, cümle değildir |
| Zone purpose: thermal / ventilation / electrical load area / lighting control / fire area / drainage area | **termal (HVAC) / havalandırma / elektrik yük alanı / aydınlatma kontrolü / yangın bölgesi / drenaj alanı** | *HVAC* kısaltması korunur (§0.3); *alan* burada **area**'dır, *mekan* değil |
| Heating and cooling / Electrical / Plumbing equipment (zone server headings) | **ısıtma ve soğutma / elektrik / sıhhi tesisat ekipmanı** | `zoneFitHeading`, ekran okuyucuya da bu gider |

> **`Spaces` grup adı bir kelime değildir.** `spaces.windowArea` = *Pencere alanı*
> doğrudur: §2.3 *Space* = *mekan* kuralı anahtarın **kelimesine** bakar, ait
> olduğu grubun adına değil. `packages/bim-ui/__tests__/i18n-glossary.test.ts`
> bu yüzden anahtarın ilk nokta öncesi parçasını (grup) atar — `WORKSPACE_KEY`
> istisnasının bir seviye yukarısı. Kelime gerçekten *space* ise
> (`spaces.spaceName`, `ventilation.space`, `panel.spaces`) kural aynen işler.

---

### 5.7 Aşama 4, Task 4.3: sıhhi tesisat ağacı sözcükleri (2026-11-10)

`packages/bim-editor/src/editor/plumbing` çevrilirken bunlar gerekti. Yukarıda
**zaten** karara bağlı olanlar tekrar yazılmadı (`Boru`, `Kanal`, `Hat`,
`Branşman`, `Yalıtım`, `Kat`, `Oda`, `Sistem`, `Panel`, `Pafta`, `Çizelge`,
`İşaret`, `Tip`, `Açıklama`, `Malzeme`, `Ölçü`, `Numara`).

| EN | TR | Not |
|----|----|-----|
| Plumbing (the discipline, the tab) | **sıhhi tesisat** | §5.6 *sıhhi tesisat ekipmanı*; *tesisat* tek başına yetmez |
| Stack (sanitary / vent / storm) | **kolon** | *pis su kolonu*, *havalandırma kolonu*, *yağmur suyu kolonu* |
| Stack number / Stack tag / Base of stack | **kolon numarası / kolon etiketi / kolon dibi** | `stackBaseRule` bir *firma kuralı*, kod maddesi değil |
| Manhole | **baca** | `MH-1` işareti çevrilmez |
| Invert / Rim (ft) | **invert kotu / üst kot** | `ft` çevrilmez (§7); değer tahmin edilmez |
| Building drain / Outfall | **bina tahliye hattı / deşarj noktası** | |
| Backwater valve | **geri akış valfi** | |
| Cleanout / Trap / Valve | **temizleme ağzı / sifon / vana** | |
| Regulator / Line · Service · Appliance regulator | **regülatör / hat · servis · cihaz regülatörü** | |
| Vent limiter / Vent to outdoors | **havalandırma sınırlayıcısı / dışarı havalandırma** | Regülatörün tahliyesi; *havalandırma kolonu* ayrı kavram |
| Load point / Lump load / Break out | **yük noktası / toplu yük / böl** | Toplu yük sonra bölünür; toplam değişmez |
| Fixture (a plumbing fixture) | **armatür** | §9/Ç12 |
| Fixture unit (WSFU / DFU) | **yük birimi** | §9/Ç12; `WSFU`, `DFU` kısaltmaları korunur (§7) |
| Fixture mark | **armatür işareti** | |
| Demand curve / Design point | **talep eğrisi / tasarım noktası** | Hunter eğrisi = **Hunter eğrisi** (özel ad) |
| Auto-size / Sizing | **otomatik boyutlandır / boyutlandırma** | Boru boyutlandırma, gaz boyutlandırma |
| Design rainfall (in/h) | **tasarım yağış şiddeti** | §5 *Yağış şiddeti*; `in/h` çevrilmez |
| Slope / Fall / Offsets | **eğim / düşü / kaydırmalar** | §9/Ç13: eğim ≠ debi |
| Hydraulics / Loss / Friction | **hidrolik / kayıp / sürtünme** | |
| Capacity at slope | **eğimdeki kapasite** | |
| Pipe insulation schedule | **boru yalıtım çizelgesi** | §2.4 *çizelge* |
| Wrap (pipe insulation) | **dış kaplama** | §5.5 ile aynı karar; "sargı" kullanılmaz |
| Pipe types / Connection types | **boru tipleri / bağlantı tipleri** | |
| Product standard | **ürün standardı** | |
| Building type / Nursing home | **bina türü / bakımevi** | |
| Riser diagram | **kolon şeması** | §5.5 ile aynı karar |
| Stack capacity | **kolon kapasitesi** | |

> **Kernel'in ve paketin etiket tabloları bu ağaçta `label(t)` erişimcileriyle okunur.**
> `DEMAND_CURVE_LABEL`, `BUILDING_TYPE_LABEL`, `GAS_FUEL_LABEL`
> (`@permitzip/bim-pack-plumbing`) ve `SYSTEM_PATTERN_LABEL`, `SYSTEM_WEIGHT_LABEL`
> (`@permitzip/bim-kernel`) İngilizce **veridir**; veri İngilizce kalır, ekranın
> sözcüğü `plumbing-words.ts` içindeki erişimciden gelir — `viewCategoryWord` ve
> `loadTradeWord` ile aynı desen. İngilizce varsayılan her erişimcide tablonun
> kendi sözcüğü olarak yazılır (anahtar bir değişkenden gelirse `npm run i18n:review`
> ve `editorSourceCaptions()` onu göremez) ve `i18n-plumbing.test.tsx` bunu
> tabloyla **karakter karakter** karşılaştırır.

### 5.8 Aşama 4, Task 4.6: sorular ağacı sözcükleri (2026-11-10)

`packages/bim-editor/src/editor/questions` çevrilirken bunlar gerekti. Yukarıda
**zaten** karara bağlı olanlar tekrar yazılmadı (`Panel`, `Pafta`, `Kat`,
`Mekan`, `Tip`, `İşaret`, `Açıklama`, `Dal`, `Pano`).

| EN | TR | Not |
|----|----|-----|
| Question (the record) | **soru** | §6; panel başlığı `panel.questions` = **Sorular** |
| Answer (the record) / to answer | **yanıt** / **yanıtla** | Yanıt bir kayıttır; *cevap* kullanılmaz |
| Assumption / to go ahead on one | **varsayım** / **varsayım üzerinden devam et** | |
| Open / Closed | **açık** / **kapalı** | §8 durum sözcüğü; *kapatıldı* bir eylem, durum *kapalı* |
| Asked of / Asked by / Carried by | **kime soruldu / kim sordu / kim taşıyor** | *Soran* = asker, *taşıyan* = owner (§9/Ç20: *sahip* yalnız modelin sahibi) |
| Ask again / Withdraw | **yeniden sor** / **geri çek** | Geri çekmek geçmişi korur, silmek korumaz |
| Decline / Not in scope | **yanıtlamayı reddet** / **kapsam dışı** | İkisi de *decline_question* yazar; sözcükleri ayrı kalır |
| Holds the issue | **işi durdurur** | Bir soru paftaların yayınını durdurur; *engeller* değil |
| Needed by | **son tarih** | Tarih zorunlu değildir: "kimse yanıtlamak zorunda değil" |
| Reply / Thread / Conversation | **yanıt yaz** / **konuşma** | *Konu* bir başlık; sorunun altındaki kayıtlar bir **konuşma** |
| Take over / Forward | **devral** / **ilet** | Devralan kişi soruyu **taşır** |
| Clarify / Record a decision / Revise the design | **açıklığa kavuştur / karar kaydet / tasarımı revize et** | §6 *decision* = karar; §3 *revise* = revize et |
| Outcome: Clarification / Decision recorded / Design revision / Branch opened | **Açıklama / Karar kaydedildi / Tasarım revizyonu / Dal açıldı** | Kernel'in `QUESTION_OUTCOME_POINT` satırları; İngilizce etiket veridir |
| Pin (on the plan) | **iğne** | *Sabitlenmiş* durumdur, *iğne* nesnedir (§8) |
| Read-only reader / Stop sharing | **salt okunur okuyucu / paylaşmayı durdur** | §8 *Salt okunur* |
| Link (record) / to link | **bağ** / **bağla** | *Bağlantı* bir oturumdur (§4.3); proje kaydına giden **bağ** |

> **Kernel'in durum ve olay sözcükleri bu ağaçta erişimciyle okunur.** `STATUS_ACT`
> ve `eventWords` (`src/contracts/bim/questions/thread-words.ts`) proje dışındaki
> okuyucuya **saklanan** kopyanın sözcükleridir ve İngilizce kalır; ekranın sözcüğü
> `thread-rows.ts` içindeki `statusAct`, `eventLine` ve `outcomeWord`
> erişimcilerinden gelir. `i18n-questions.test.tsx` her erişimcinin İngilizcesini
> kernel'in tablosuyla **karakter karakter** karşılaştırır.

### 5.9 Aşama 4, Task 4.6: ekipman listesi sözcükleri (2026-11-10)

`packages/bim-editor/src/editor/equipment-list` çevrilirken bunlar gerekti.
Yukarıda **zaten** karara bağlı olanlar tekrar yazılmadı (`Ekipman`, `Armatür`,
`Yük birimi`, `Panel`, `Çizelge`, `Tip`, `Aile`, `Kategori`, `Parametre`,
`Bağlantı`, `Gerilim`, `Faz`, `Devre`, `Kat`, `Mekan`).

| EN | TR | Not |
|----|----|-----|
| Item (a row of the list) | **kalem** | §2.1; planlı bir **kalem** olur, *eleman* değil |
| Element / Part | **eleman** / **parça** | §2.1; bu ağaçta sayılan şey kalemdir |
| Listed item (the part type it makes) | **listelenen kalem** | Modelde saklanan tip adı; Türkçe ekranda Türkçe yazılır |
| Mark / Qty / Load / Conn. | **işaret / adet / yük / bağlantı** | §5 alan adları; `DRAFT_FIELD_LABELS` erişimciye döndü |
| Load (kW, VA, A or hp) | **Yük (kW, VA, A veya hp)** | §7: birim sembolleri çevrilmez, bağlaç çevrilir |
| Planned equipment | **planlı ekipman** | Henüz çizilmemiş, modelde var olan parça |
| Not placed yet | **Henüz yerleştirilmedi** | §4.2 ile aynı karar |
| Column (a parameter shown as one) | **sütun** | *Kolon* sıhhi tesisatta bir stack'tir (§5.7) — burada asla |
| Firm / Project column | **firma sütunu / proje sütunu** | Kitaplık katmanları: proje, firmayı; firma, yerleşiği ezer |
| Built-in column | **yerleşik sütun** | |
| From the library | **kitaplıktan** | §2.2 *kitaplık* |
| Unit (of a number column) | **birim** | §7; sembolü çevrilmez |
| Reading a pasted sheet | **yapıştırılan çizelgeyi okumak** | *Paste* = **yapıştır**, *Schedule* = **çizelge** |
| Circuit them | **devreye al** | §9/Ç5 *devre*; tek hat üzerinde bir devreye bağlamak |
| Water and drain connections | **su ve tahliye bağlantıları** | §5.7 *tahliye*; *dren* kullanılmaz |
| Gas input (MBH) | **gaz girdisi (MBH)** | `MBH` sembolü çevrilmez (§7) |
| Horsepower | **beygir gücü** | §7 açık yazım; `hp` sembolü kalır |

### 5.10 Aşama 4, Task 4.6: kitaplık ağacı sözcükleri (2026-11-10)

`packages/bim-editor/src/editor/library` çevrilirken bunlar gerekti. Yukarıda
**zaten** karara bağlı olanlar tekrar yazılmadı (`Kitaplık`, `Tip`, `Aile`,
`Kategori`, `Disiplin`, `Eklenti`, `Panel`, `Parametre`, `Parça`).

| EN | TR | Not |
|----|----|-----|
| Firm library | **firma kitaplığı** | `save.theLibrary` = *kitaplığa* ile aynı ad; *kütüphane* kullanılmaz |
| Built in | **yerleşik** | *dahili* değil |
| Pin to this model / Unpin | **bu modele sabitle / sabitlemeyi kaldır** | Sabitleme sıradan bir düzenlemedir, geri alınabilir |
| Pinned | **sabitlemeyi kaldır** karşıtı olarak **sabitlendi** | §8 durum sözcüğü |
| Suggested responsible role | **önerilen sorumlu rol** | §9/Ç20: sorumlu kişiyi proje yöneticisi belirler |
| Part of / Comes from | **parçası olduğu / nereden geliyor** | Disiplinin üst disiplini ve kaynağı |
| Add-on / Not installed / Preview | **eklenti / kurulu değil / önizleme** | `panel.addOns` = **Eklentiler** (§4.2) |
| What it adds | **ne ekliyor** | Bir eklentinin kattığı hizmetler ve ekranlar |
| Import part types | **parça tiplerini içe aktar** | *İçe aktar* ≠ *yükle* (§3) |
| Connector report | **bağlantı raporu** | §5.5 ile aynı karar |
| Firm / project scope | **firma / proje kapsamı** | Kitaplık katmanları |
| Save to firm library | **firma kitaplığına kaydet** | Yönelme hâli: *kitaplığına* |

### 5.11 Aşama 4, Task 4.6: koordinasyon ağacı sözcükleri (2026-11-10)

`packages/bim-editor/src/editor/coordination` çevrilirken bunlar gerekti. Yukarıda
**zaten** karara bağlı olanlar tekrar yazılmadı (`Çakışma`, `Girişim`, `Bulgu`,
`Birleşik model`, `İnceleme`, `Panel`, `Pafta`, `Rev`, `Kat`).

| EN | TR | Not |
|----|----|-----|
| Finding (a lint result) | **bulgu** | §2.4; *tespit* kullanılmaz |
| Clash / Interference | **çakışma / girişim** | §2.4: çakışma bir çarpışmadır, girişim bir örtüşmedir |
| Check (the ruleset being run) | **denetim** | *Kontrol* değil; §4.2 *çizelge denetimi* ile aynı kök |
| Everything / Clashes and placement / Drawings and sheets / Before issuing a set | **Her şey / Çakışmalar ve yerleşim / Çizimler ve paftalar / Set yayınlanmadan önce** | Dört hazır kural kümesi |
| Accept / Retract (an acceptance) | **kabul et / geri al** | §8 *kabul*; geri alma gerekçesiyle saklanır |
| Accepted / Accepted, not in this check | **Kabul edilenler / Kabul edildi, bu denetimde yok** | |
| Tolerance | **tolerans** | `in.` sembolü çevrilmez (§7) |
| Save default | **varsayılanı kaydet** | Model başına bir varsayılan |
| Linked model | **bağlı model** | §4.2 ile aynı karar |
| Severity | **önem düzeyi** | Bir bulgunun `error` / `warning` / `info` derecesi |
| Error / Warning (counts) | **hata / uyarı** | §8 durum sözcükleri |
| Needs / Checks / Questions / Submittals (chips) | **Gereken / Denetimler / Sorular / İmalat onayları** | Kontrol listesinin dört çipi |
| Select / Select all | **seç / tümünü seç** | §0.7: tekil emir |

---

### 5.12 Aşama 4 son turu: son sekiz üst düzey dosya (2026-11-10)

`packages/bim-editor/src/editor` kökünde kalan sekiz dosya (`RunProperties`,
`RunMoveForm`, `LinkedElementProperties`, `LinkModelDialog`, `GroupProperties`,
`PartSpaceProperties`, `DocsPickerDialog`, `LinkedModelsPanel`) çevrilirken bunlar
gerekti. Yukarıda **zaten** karara bağlı olanlar tekrar yazılmadı (`Eleman`,
`Parça`, `Hat`, `Branşman`, `Ana hat`, `Tip`, `Kat`, `Mekan`, `Pafta`, `Antet`,
`Model`, `Bağlı model`, `Yalıtım`, `Panel/Pano`).

| EN | TR | Not |
|----|----|-----|
| Reducer (pipe) / Transition (duct) | **redüksiyon / geçiş parçası** | Bir boyut değişiminde araya giren bağlantı parçası; §2.8 *fitting* = bağlantı parçası |
| Concentric / Eccentric (transition) | **konsantrik / eksantrik** | Eksenleri ortak / kaçık |
| Trunk | **ana hat** | §2.8; `Along the trunk` = *Ana hat boyunca* |
| Straight piece (Tab scope) | **düz parça** | §5.7 ile aynı karar |
| Curb (an equipment base on a slab) | **kaide** | *Bordür* (yol/kenar) değil; çatı kaidesi |
| Rail (beside a curb) | **korkuluk** | `Curb or rail` = *Kaide ya da korkuluk* |
| Host (the element a part stands on) | **taşıyıcı** | Bir *bağlı model* değil; parçanın durduğu eleman |
| Slab | **döşeme** | §2.1 ile aynı karar |
| Clearance (the free distance a part needs) | **açıklık** | ⚠️ **boşluk** DEĞİL — o *void*'tir (§2.3). Zone = *açıklık bölgesi* |
| Working space (NEC 110.26) | **çalışma boşluğu** | §2.3 *Space* = **mekan** yalnız mimari mekan içindir; NEC boşluğu bir hacimdir, *alan* (area) değildir |
| Dedicated equipment space | **ayrılmış ekipman boşluğu** | §2.3 notuyla aynı |
| Service access / Keep clear | **servis erişimi / açık tut** | Açıklık bölgesinin amacı |
| Instance (Revit parameter group) | **örnek** | Revit TR; karşıtı **tip** (§2.2) |
| Quantities (a Revit property group) | **miktarlar** | §5 *metraj* değil: bu bir özellik grubudur, metraj kalemi değil |
| Curb height / Depth / Slide / Side | **kaide yüksekliği / derinlik / kaydırma / yüz** | `Slide` = §2.8 *offset* → **kaydırma**; `Side` bir yüzdür, *taraf* değil |
| Volts to ground / Condition (1, 2, 3) | **toprağa göre volt / koşul** | NEC 110.26(A)(1) koşulları; `V`, `in.`, `ft` çevrilmez (§7) |
| Fan static (external static pressure) | **fan statik basıncı** | `in. w.c.` bir birim sembolüdür, çevrilmez (§7) |

### 5.13 Aşama 4 dışında kalan ağaçlar (2026-11-10)

Aşama 4 planı bazı ağaçları hiç adlandırmadı, ama Türkçe bir kullanıcı onlarla yine
karşılaşıyor: kenar çubukları, bağlı model ekranı, parça düzenleyici, gruplar ve
fazlar. Bu ağaçlar çevrilirken gereken sözcükler burada toplanır. Yukarıda **zaten**
karara bağlı olanlar tekrar yazılmadı (`Eleman`, `Parça`, `Tip`, `Kat`, `Mekan`,
`Pafta`, `Görünüm`, `Grup`, `Faz`, `Bağlı model`, `Panel/Pano`).

| EN | TR | Not |
|----|----|-----|
| Layout (the person's saved sidebars: width, collapsed sections) | **düzen** | §5.2'deki *Layout = yerleşim* **pafta yerleşimi** içindir; buradaki arayüz düzenidir, `rail.defaultLayout` (*Varsayılan düzen*) ile aynı sözcük |
| Sidebar / Side rail / Rail (the docked panel strip) | **kenar çubuğu** | `rail.resizeSidebar` = *Sol kenar çubuğunu yeniden boyutlandır*; §5.12 *Rail (beside a curb)* = **korkuluk**, ayrı kavram |
| Collapse to a strip | **şeride daralt** | §4.2 `panel.collapseRailToStrip` ile aynı |
| Drag to resize | **yeniden boyutlandırmak için sürükleyin** | §4.2 *Resize {{name}}* = **{{name}} panelini yeniden boyutlandır**; fiil aynı |
| Your layout wasn't saved | **Düzeniniz kaydedilmedi** | §0.7: cümleler kibar çoğul, düğmeler tekil |
| Opening (a door or window hosted in a wall) | **boşluk** | §5.12'nin **açıklık**'ı bir *clearance*'tır; ikisi yer değiştirmez |
| Face (of a wall, on a snap marker) | **yüz** | §5.12 *Side* = yüz ile aynı sözcük |
| Centre line | **merkez hattı** | §2.3 *Axis* = eksen; bir duvarın orta çizgisi |
| Snap marker noun (wall / window / door / roof / column / beam) | **duvar / pencere / kapı / çatı / kolon / kiriş** | Paketlerin `kernel.linked_reference` satırlarındaki `noun`; paketin adlandırmadığı IFC varlığı kendi adıyla (veri) gelir |
| Copy a linked element (keep it in step with the link) | **bağlı modelden kopyala** | Eş adımda tutma: *bağlı modelle eş adımda tutulur* (`spaces.copyEnvelopeWhy`) |
| Update from the link / Keep mine | **Bağlantıdan güncelle / Kendiminkini koru** | `spaces.updateFromLink`, `spaces.keepMine` ile aynı karar |
| Halftone (the linked model's look) | **Yarım ton** | §2.4/§5 ile aynı |
| See-through | **Yarı saydam** | *Saydam* değil: arkası görünür ama silik |
| Underlay (a linked model's look) | **Altlık** | §2.3 *Underlay* ile aynı |
| Hidden (a linked model's look) | **Gizli** | §4.2 *Hide* = **Gizle** (fiil), bu bir sıfattır |
| Custom (a hand-set look) | **Özel** | |
| Cut lines / Lines below the cut | **kesme çizgileri / kesme düzleminin altındaki çizgiler** | Revit TR *kesme düzlemi* |
| Line weight (thin / medium / wide / heavy) | **çizgi kalınlığı (ince / orta / geniş / kalın)** | |
| Discipline (of a linked model) | **disiplin** | §1 disiplinler; `linkedModel.*` |
| Contributor (company and contact) | **katkı veren** (firma ve ilgili kişi) | *İşveren* (§9/Ç20) değil — bu, modeli paylaşan taraftır |

### 5.14 Aşama 4, Task 4.6: gruplar ve fazlar ağacı sözcükleri (2026-11-10)

`packages/bim-editor/src/editor/organization` (gruplar, fazlar, faz filtreleri,
"tipik" kopyalar ve etiket stilleri) çevrilirken bunlar gerekti. Yukarıda **zaten**
karara bağlı olanlar tekrar yazılmadı (`Grup`, `Faz`, `Faz filtresi`, `Filtre`,
`Etiket`, `Kılavuz`, `Yarım ton`, `İşaret`, `Kat`, `Pafta`, `Mekan`, `Oda`,
`Eleman`, `Parça`, `İşveren`).

| EN | TR | Not |
|----|----|-----|
| Groups & phases (the whole breadcrumb) | **Yönet › Gruplar ve fazlar** | §2.3: *Manage* = **Yönet** (`ribbon.tab.manage`), *Groups & phases* = **Gruplar ve fazlar**. Yol tek anahtardır (`org.managePath`), `Manage › …` diye İngilizce kalmaz |
| Phase status: New / Existing / Demolished / Temporary | **Yeni / Mevcut / Yıkılan / Geçici** | §8 durum sözlüğü; *Yıkılan*, `ribbon.description.howNewExistingDemolishedAnd` ile aynı sözcük (`Yıkılmış` değil) |
| Phase display: show / halftone / dashed / hide | **Göster / Yarım ton / Kesikli / Gizle** | §5.2 *halftone* = yarım ton; dördüncü seçenek *kesikli çizgi* |
| Typical (a repeated unit or bay), typical copies | **tipik**, **tipik kopyalar** | Revit TR *tipik*; tek bir kopya **kopya**dır (§9/Ç10) |
| Contract covers (the typical cap) | **Sözleşme kapsamı** | 10 tipik varsayılanı; *kontrat* değil (Gündelik: *sözleşme*) |
| Across / Spacing between rows (a typical's array) | **Yan yana / Satırlar arası aralık** | *Yan yana* = kaç kopya bir satırda |
| Mirror every other one: left for right / front for back | **Her iki taneden birini aynala: sağ-sol / ön-arka** | Cümle içinde **sağ sola** / **ön arkaya** |
| Spread copies over the phases | **Kopyaları fazlara dağıt** | §3 *dağıt* (§5.3 *Etiketleri dağıt*) ile aynı fiil |
| Tag style / Tag styles | **etiket stili / etiket stilleri** | §2.4 *Tag* = etiket (§5.2 *etiket şablonu* ayrı kavram: hazır satırlar) |
| Tag style: what it says (its lines) | **Ne söylediği** | Etiketin bastığı satırlar |
| Tag style: outline (none / box / rounded / circle / hexagon / diamond) | **çerçeve**: **çerçevesiz / kutu / yuvarlatılmış kutu / daire / altıgen / eşkenar dörtgen** | *Anahat* değil; çizim terimi *çerçeve* |
| Tag style: words read (level / along the duct or pipe) | **Sözcüklerin yönü**: **paftada düz / kanal veya boru boyunca** | *okunuş* değil — yön kastediliyor |
| Tag style: arrow along the run (none / downhill / uphill) | **Hat boyunca ok**: **yok / aşağı eğimli / yukarı eğimli** | §5.2 *ok ucu* = arrowhead; buradaki ok hattın eğimini gösterir |
| Tag style: it labels / new tags on these use it | **Etiketlediği / Bunlardaki yeni etiketler onu kullanır** | İki onay kutusu kümesi: hangi türleri etiketler, hangilerinde varsayılandır |
| Leader ends in: dot / arrow / tick / nothing | **Kılavuzun ucu**: **nokta / ok / çentik / hiçbiri** | §5.2 *ok ucu: nokta / ok / çentik* ile aynı sözcükler |
| Text size on paper | **Kâğıtta metin boyu** | `electrical.textSizeOnPaper` ile **tek** sözcük (§0.1) |
| Tag style: type it should say, like `{size}` | **… {{token}} gibi** | `{size}` bir alan yazımıdır; sözcüğü çevrilir, süslü parantezli alan adı çevrilmez (§5 alan adları) |
| Bracket/Prefix and Suffix on a tag | **Öncesi / Sonrası** | ` TYP.` örneği **TİP.** olur (yazılan değer değil, örnek) |
| Group colour / Group name | **Grup rengi / Grup adı** | |
| New work goes here (the active group) | **yeni iş buraya girer** | `status.newWorkGoesIn` (*Yeni iş şu gruba girer:*) ile aynı fiil |
| Locked / Unlock it before deleting it | **Kilitli / Silmeden önce kilidini açın** | §8 *kilitli* |
| Keep it (decline a delete) | **Kalsın** | §3 *Cancel* = Vazgeç; bu **silmemeyi** seçer |
| Element count on a group row | **{{n}} eleman** | §8: sayıdan sonra çoğul eki yok; İngilizcedeki `element`/`elements` tek Türkçeye iner |
| On paper / Dashed in a phase filter | **Kesikli** | Faz filtresinin dördüncü çizimi |

> **`organization/` kapandı (2026-11-10, altıncı tur).** Ağacın tamamı anahtarlı:
> **195** site (11 dosya) sıfıra indi ve ağaç `NOT_YET_GUARDED`'dan çıkıp
> `OWNED_DIRS`'a girdi; Türkçesi `i18n-organization.test.tsx` içinde ölçülür
> (§2.3, §2.4, §5 *işaret*, §7 birim sembolleri, §8 sayı + çoğul, §9/Ç20 işveren).
> Etiket tabloları artık **erişen** (accessor): `groupVisibilityLabel`,
> `phaseDisplayLabel`, `phaseStatusLabel`, `tagStyleKindLabel`, `shapeLabel`,
> `unitsLabel`, `leaderEndLabel`, `TAG_TEXT_SIZES[].label(t)` ve `managePath(t)`
> bir `Translate` alır — İngilizce bir `Record<…, string>` anahtarlı bir çerçevenin
> altında kalmadı. `MANAGE_PATH` sabiti kalktı: `{{path}}` artık dile göre yazılır,
> böylece Türkçe cümlenin içinde İngilizce bir yol durmuyor.
>
> **Ertelenen: çekirdek verisi İngilizce kalır.** Etiket stilinin `labelOf(name)`
> alan adları (`TAG_FIELDS`, `fieldPaths`), hazır stil adları ve açıklamaları
> (`tagStylePresets()`), grup/faz/filtre adları (`DEFAULT_GROUPS`, `DEFAULT_PHASES`,
> `DEFAULT_PHASE_FILTERS`) ve `typicalCapStatus().message` **veri**dir; ağaç onları
> yazmaz. Bir cümleyi çevirmek için uydurmak §0.1'in "tek kavram, tek terim"
> kuralını kırar. Sahibi: Aşama 5'in alan haritası (çekirdek etiketleri) ve
> çekirdeğin prose haritası. `typicalCapStatus().message` bu turda **splice'ta**
> çevrildi: uyarı başlığı artık `org.typicalCap.overTitle` ve `status.count` /
> `status.cap` ile kurulur, çekirdeğin İngilizce cümlesi gösterilmez.

### 5.15 Aşama 4 dışı: parça düzenleyici, denetçi ve tasarım limitleri (2026-11-10)

`packages/bim-editor/src/editor` altında Aşama 4'ün adlandırmadığı üç ağaç —
`part-editor` (parça düzenleyici), `inspector` (Özellikler panelinin parametre
denetçisi) ve `design-limits` (Tasarım limitleri) — çevrilirken bunlar gerekti.
Yukarıda **zaten** karara bağlı olanlar tekrar yazılmadı (`Parça`, `Tip`,
`Kategori`, `Referans düzlemi`, `Eskiz`, `Katı`, `Boşluk`, `Bağlantı noktası`,
`Ölçü`, `Görünüm`, `Detay seviyesi`, `Açıklık`, `Servis erişimi`, `Çalışma
boşluğu`, `Yüz`, `Sürüm`, `Revizyon`, `İşveren`, `Pafta`, `Çizelge`, `Mekan`,
`Alan`, `Bölge`, `İşaret`, `Sınıflandırma`).

| EN | TR | Not |
|----|----|-----|
| Part editor | **parça düzenleyici** | §2.1: *editor* = **düzenleyici**, *editör* değil; *part* = **parça** |
| Parameters / Sizes / Size row | **parametreler / boyutlar / boyut satırı** | Bir parçanın her boyutu bir satırdır; §8 sayıdan sonra çoğul eki yok (*3 boyut*) |
| Feature (a sketch's extrude or revolve) | **nitelik** | ⚠️ **özellik** DEĞİL: *Özellikler* = Properties panelidir (§4), aynı ekranda dururlar. Tek kavram tek terim: CAD niteliği **nitelik** |
| Extrude / Revolve | **ekstrüzyon / döndürme** | Fiil olarak da aynı ad kullanılır (*Ekstrüzyon* düğmesi); Revit TR *ekstrüde/döndür* fiilini kullanır ama düğme bir eylem adıdır |
| Solid / Void (a feature's operation) | **katı / boşluk** | §2.3; *Make solid/void* = *Ne yapar: Katı / Boşluk*, üçüncüsü **Yalnızca kesişim** |
| Sketch on plane / Finish sketch | **Düzlem üzerinde eskiz / Eskizi bitir** | §2.3 *sketch* = **eskiz**; cümle değil komut, tekil |
| Reference plane: Front / Back / Left / Right / Top / Base | **Ön / Arka / Sol / Sağ / Üst / Taban** | Bir parçanın kendi düzlemleri; yüz adları ayrı ve küçük harflidir (*ön, arka, …*) |
| Centre (left/right) / Centre (front/back) | **Merkez (sol/sağ) / Merkez (ön/arka)** | Ölçünün başladığı orijin düzlemi |
| Square to (a new plane's axis) | **Dik olduğu eksen** | §2.3 *Axis* = **eksen**; *Up (a level, z)* = **Yukarı (yatay düzlem, z)** — buradaki *level* **kat** değil, yatay düzlem |
| Offset (a plane's distance) / Slide | **kaydırma / kaydırma** | §5.12 *Slide* = **kaydırma**; ikisi de aynı sözcük, tek kavram |
| Ribbon-side nouns: Overlap only | **Yalnızca kesişim** | Bir niteliğin katı olmayan üçüncü işlemi |
| Detail level: Coarse / Medium / Fine | **Kaba / Orta / İnce** | §2.4 *Detail level* = **detay seviyesi** |
| Parameter kind: Length / Angle / Number / Yes–no / Text / Material | **Uzunluk / Açı / Sayı / Evet–hayır / Metin / Malzeme** | *Yes / no* = **Evet / hayır** |
| Fully defined / Constraints disagree / Has a problem | **Tam tanımlı / Kısıtlar çelişiyor / Sorunlu** | Eskiz durumu; üçüncüsü §8 durum sözlüğü |
| Direction free (*3 directions free*) | **{{n}} yönü serbest** | §8: sayıdan sonra çoğul eki yok |
| Clearance zone name: Dedicated space above | **Üstte ayrılmış boşluk** | §5.12 *Dedicated equipment space* = **ayrılmış ekipman boşluğu**; buradaki ad *üstte* olanı söyler |
| Clearance to combustibles | **Yanıcılara mesafe** | `partSpace.purposeCombustible` ile **aynı** Türkçe (§0.1) |
| End type / Not set | **uç tipi / Ayarlanmadı** | §8 *Not set* |
| Load class / Load (VA) / Motor (hp) / Voltage (V) | **Yük sınıfı / Yük (VA) / Motor (hp) / Gerilim (V)** | §9/Ç12 *fixture unit* = **yük birimi** ile karışmaz; §7 birim sembolleri çevrilmez |
| Continuous (3 h or more) | **Kesintisiz (3 saat ya da daha çok)** | §9/Ç9 *runs* burada bir süredir: **çalışır**, *hat* değil |
| Model in place (the editor opened on a spot) | **yerinde model** | §2.2; cümlede *{{level}} üzerinde tıkladığınız nokta* |
| Publish / Publish revision {{n}} | **Yayınla… / {{n}}. revizyonu yayınla** | §2.2 *revision* = **revizyon**, *version* = **sürüm**; ikisi karışmaz |
| Update / Keep (a newer library revision) | **Güncelle / Koru** | §3 *Update* = **Güncelle**, *Keep* = **Koru** |
| Review update | **Güncellemeyi incele** | §3 *Review* burada fiil; ad hâliyle **inceleme** |
| Placed copy / {{n}} placed copies | **yerleştirilmiş kopya / {{n}} yerleştirilmiş kopya** | §9/Ç10 *copy* = **kopya**; §8 çoğul eki yok |
| Inspector: Fields / Columns / Units / Grouping | **alanlar / sütunlar / birimler / gruplama** | §5 alan adları; *alan* burada bir form alanıdır (§2.3 *alan* = area ile karışmaz, bağlam form) |
| Value / Default / Override | **değer / varsayılan / geçersiz kılma** | |
| Design limit | **tasarım limiti** | §4 panel adı **Tasarım limitleri**; *kısıt* DEĞİL (§8 *constraint* eskiz kısıtıdır) |

> **`part-editor/` kapandı (2026-11-10).** Ağacın tamamı anahtarlı: **285** site
> (14 dosya) sıfıra indi ve ağaç `OUTSIDE_STAGE_4`'ten çıkıp `OWNED_DIRS`'a girdi;
> Türkçesi `i18n-part-editor.test.tsx` içinde ölçülür. Etiket tabloları erişen
> oldu: `partCategoryLabel`, `purposeWord`, `faceWord`, `faceTitle`, `viewTitle`,
> `drawingOn`, `planeName`, `domainWord`, `systemWord`, `axisWord`, `partCategoryLabel`
> ve `sketchState` bir `Translate` alır. Çekirdeğin `PART_CATEGORY_LABELS` /
> `CLEARANCE_PURPOSE_LABELS` İngilizcesi anahtarlı bir çerçeveye ham
> **splice edilmez**: bilinmeyen bir kategori/purpose paketin kendi sözcüğüyle
> gelir. Bağlantı domainleri ve sistem türleri `domainLabelOf` ile
> `locales/tr/domain.json`'dan okunur; eksik altı satır (hava ve yangın koruma
> sistemleri) aynı commit'te eklendi.
>
> **Yeni parçanın varsayılanları çalışılan dilde yazılır.** `blankDraft`,
> `addStarterBox`, `addExtrude` ve `addRevolve` bir `Translate` alır (varsayılan
> `englishOnly`, yani bugüne kadarki İngilizce birebir). Parçanın adı, tek boyutu
> (`Standart`), üç parametresi (`Uzunluk/Genişlik/Yükseklik`), beş düzlemi
> (`Ön/Arka/Sol/Sağ/Üst`), eskizi ve nitelikleri **tanıma yazılan veri**dir; Türkçe
> çalışan biri Türkçe parça yazar. Parametre **adları** (`length`, `width`,
> `height`) şemadır, dille yer değiştirmez.
>
> **Ertelenen: kitaplıktan gelen veri İngilizce kalır.** Yerleştirilmiş bir parçanın
> bağlantı etiketleri (`p.connectorLabel`), çekirdeğin `PartImportReport`
> cümleleri (`p.message`, `p.nextStep`), `connectorEndTypeTable()` satır adları ve
> paketlerin kendi uç tipleri **veri**dir; ağaç onları yazmaz. Sahibi: Aşama 5'in
> alan haritası ve çekirdeğin prose haritası.
>
> **`inspector/` kapandı (2026-11-10).** Özellikler panelinin parametre formu
> (`PartInspector`, `parameter-model`, `Inspector`): **30** site sıfıra indi, ağaç
> `OUTSIDE_STAGE_4`'ten `OWNED_DIRS`'a girdi, Türkçesi
> `i18n-inspector.test.tsx` içinde ölçülür. `parseDisplayText` ve
> `planParameterEdit` bir `Translate` alır, böylece *"Genişlik ft cinsinden bir
> sayı olmalı."* Türkçe ekranda Türkçe çıkar; `run.notLive` bu ağaçta iki yeni
> site kazandı (kaydet ipucu ve «yazılan metni temizle»), `i18n-mep` içindeki
> sayım 6 → 8 oldu.
>
> **Ertelenen: bölüm başlıkları çekirdek verisidir.** Formun bölüm adları
> (*Identity*, *Electrical*, *Mechanical* …) facet kayıt defterinden gelir
> (`groupParametersByFacet`, `BUILTIN_FACET_REGISTRY`) — `organization` ağacının
> `DEFAULT_GROUPS`'u gibi **veri**dir; panel onları yazmaz. Sahibi: facet kayıt
> defterinin kendi çeviri turu. Bir bölüm adı cümle içinde kullanılırken
> (`More electrical fields`) Türkçede **küçük harfe indirilmez** (§4.2, `İ`/`I`).
>
> **`design-limits/` kapandı (2026-11-10).** Kitaplık › Tasarım limitleri paneli
> (`DesignLimitsSection`), ekle/değiştir penceresi (`DesignLimitEditor`) ve
> kitaplık istemcisi (`design-limits-client`): **60** site sıfıra indi, ağaç
> `OUTSIDE_STAGE_4`'ten `OWNED_DIRS`'a girdi, Türkçesi
> `i18n-design-limits.test.tsx` içinde ölçülür. `SEVERITY_WORDS` ve `LAYER_WORDS`
> tabloları erişen oldu (`severityWords`, `layerWord`); `appliesToWords`,
> `bandWords` ve `publishDesignLimitFrom` bir `Translate` alır.
>
> **Bir aralık cümledir, cümle de düzenleyicinin.** `bandWords` çekirdeğin
> `policy.bandWords`'ından **splice edilmez**: çekirdeğinki kendi okuyucuları için
> veridir, ama ekranda bir cümledir (*at most 8 ft/s*) ve Türkçe satırın içinde
> İngilizce kalıyordu. Düzenleyici onu `band.between` / `band.atMost` /
> `band.atLeast` / `band.aim` anahtarlarıyla kurar; sayılar çekirdeğin kendi
> `limitNumber`'ından geçtiği için İngilizce birebir aynı okunur, birim sembolü
> (`ft/s`) §7 gereği çevrilmez.
>
> **`rate` = `debit` değil burada.** Tasarım limitleri hız, basınç kaybı, yedek
> kapasite ve paylardır; §9/Ç13'ün *debit*/*birim fiyat* ayrımı bu ekranda geçmez.
> `Limit` = **limit**; *kısıt* (§8 eskiz kısıtı) ile karıştırılmaz.

---

### 5.16 Aşama 4 dışı: mimarlık ağacı (2026-11-10)

`packages/bim-editor/src/editor/architecture` — Mimarlık sekmesi, araç tablosu, plan
ipuçları, yakalama işaretleri, duvarın Üst/Taban alanları, tip menüsü ve Tipi düzenle
penceresi — çevrilirken bunlar gerekti. Yukarıda **zaten** karara bağlı olanlar tekrar
yazılmadı (`Duvar`, `Oda`, `Mekan`, `Kat`, `Tip`, `Aile`, `Döşeme`, `Pafta`, `Görünüm`,
`Referans düzlemi`, `Eskiz`).

| EN | TR | Not |
|----|----|-----|
| Architecture (the discipline and its tab) | **Mimarlık** | §1; sekme adı **Mimarlık**, *mimari* değil |
| Datums / Build / Types (the tab's three groups) | **Referanslar / Kur / Tipler** | §4.2 *Datums* = referanslar (`ribbon.group.datum` = **Referans**); §2.2 *type* = **tip** |
| Ceiling / Roof / Stair | **tavan / çatı / merdiven** | §2.3 *Level* = **kat**, *Grid* = **ızgara** |
| Column (a structural member, on a plan) | **kolon** | §5.9'un *Column* = **sütun**'u bir **tablo sütunu**dur; bir yapı elemanı **kolon**dur (§5.13 yakalama sözcükleriyle aynı) |
| Opening (cut in a wall) | **boşluk** | §5.12 *Açıklık* = *clearance*; ikisi yer değiştirmez |
| Type / New type… / Duplicate type… / Edit type… | **Tip / Yeni tip… / Tipi çoğalt… / Tipi düzenle…** | Bir tip **tip**tir, *tür* değil; §2.2 *family* = **aile** |
| Fire rating / Fire resistance | **yangın derecesi / yangın dayanımı** | `spaces` ağacı *yangın derecelerini denetleyin* der; **derece verisi çevrilmez** |
| Rated / Not rated | **dereceli / dereceli değil** | §8 durum sözlüğü; *derecesiz* değil |
| Top / Base (a wall's) | **Üst / Taban** | *Üst* bir yükseklik değil, duvarın üstüdür; yükseklik **duvar yüksekliği** |
| Top offset / Base offset | **üst kaydırması / taban kaydırması** | §2.8 *offset* = **kaydırma** |
| Up to {{level}} / Unconnected (set height) | **{{level}} katına kadar / Bağlantısız (yükseklik ver)** | Cümlede kat adı veri olarak gelir |
| Underside of slab above / To ceiling / To roof | **Üstteki döşemenin altı / Tavana / Çatıya** | *Slab* = **döşeme** (§2.3) |
| Run the wall to {{to}} / Run the wall up to a level | **Duvarı {{to}} kadar uzat / Duvarı bir kata kadar uzat** | §9/Ç9: *run* burada **uzatmak**tır; *çalıştırmak* değil (§7 *runs* = çalışır) |
| Wall end / Wall midpoint / Corner / Perpendicular to the wall | **Duvar ucu / Duvar orta noktası / Köşe / Duvara dik** | §5.2 *midpoint* = orta nokta, *perpendicular* = dik |
| First corner: closes the loop | **İlk köşe: döngüyü kapatır** | Zincirin kendi köşesine yakalanma |
| On {{datum}} / {{datum}} at the wall | **{{where}} üzerinde / Duvarda {{where}}** | Izgara ve referans düzlemi etiketleri **veri**dir (A, B, 1, 2) |
| 6" drafting grid / {{step}} mm drafting grid | **6" çizim ızgarası / {{step}} mm çizim ızgarası** | §7: `"` ve `mm` birim sembolüdür, çevrilmez |
| Perpendicular to the linked {{what}}'s face | **… bağlı {{what}} modelinin yüzünde** | Bağlı modelin *noun*'ı paketin verisidir (`ReferenceSnapLine.noun`), çevresi bizim |
| Used by {{count}} {{what}}s / Not used by anything yet | **{{count}} {{what}} tarafından kullanılıyor / Henüz hiçbir şey tarafından kullanılmıyor** | §8: çoğul eki İngilizce varsayılanın kendi içinde (`{{what}}s`), Türkçede yok |
| A door / A window / An opening | **Bir kapı / Bir pencere / Bir boşluk** | Yakalama reddi: *{{what}} bir duvara oturmalı* |
| Sill height | **denizlik yüksekliği** | *Eşik* değil: pencerenin altı **denizlik** |
| Flip hinge / Flip swing | **Menteşeyi çevir / Kanadı çevir** | *Hinge* = **menteşe**, *leaf* = **kanat**, *jamb* = **kasa** |
| Bounds rooms | **Odaları sınırlar** | §2.3 *Room* = **oda** |
| Draw {{noun}} (an undo label) | **{{noun}} çiz** | Fiil + çevrilmiş ad; İngilizce ada asla çevrilmemiş ad katılmaz |

> **`architecture/` kapandı (2026-11-10).** Ağacın tamamı anahtarlı: **177** site (on beş
> dosya) sıfıra indi ve ağaç `OUTSIDE_STAGE_4`'ten çıkıp `OWNED_DIRS`'a girdi; Türkçesi
> `i18n-architecture.test.tsx` içinde ölçülür.
>
> **Etiket tablosu erişen oldu.** `ARCHITECTURE_TOOLS` artık `label(t)`,
> `description(t)` ve `noun(t)` taşır: şerit düğmesi, ipucu ve arama aynı sözcüğü
> çalışılan dilde yazar. `chainHint`, `draftHint`, `aimOpening`, `openingHint`,
> `doorFlipCommand`, `wallTopCommand`, `wallBaseCommand`, `parseWallHeight`,
> `usedByWords`, `changedValues` ve `snapPoint` bir `Translate` alır (varsayılan
> `englishOnly`, yani bugüne kadarki İngilizce birebir); `count`/`changedValues`
> `{{label}} bir sayı olmalı` der, İngilizce aynı kalır.
>
> **Bağlı modelin adı veridir, çevresi bizim.** `snap.ts` çekirdeğin İngilizce
> `On the linked wall's face` etiketini **splice etmez**: çekirdek artık
> `ReferenceSnapPoint`/`ReferenceSnapLine` üzerinde `noun` alanını taşır ve düzenleyici
> çerçeveyi `linkedNounWord` ile kurar (§5.13 *duvar / pencere / kapı / çatı / kolon /
> kiriş*). Paketin adlandırmadığı varlık kendi adıyla (veri) gelir.
>
> **Ertelenen: paket ve çekirdek verisi İngilizce kalır.** `typeDescription()` bir
> başlangıç tipinin paket açıklamasını olduğu gibi gösterir; `TypeField.group`
> (*Ratings*, *Identity*, *Other*) alan sağlayıcısının kendi bölüm adıdır — `inspector`
> ağacının facet başlıkları gibi **veri**dir. Sahibi: paketlerin ve facet kayıt
> defterinin kendi çeviri turu. `ratingOf`'un okuduğu `1 hr` / `90 min` yazım
> örnekleri de veridir: alan onları **yazıldığı gibi** bekler (§7).

### 5.17 Aşama 4 dışı: düzenleyicideki çizelgeler ağacı (2026-11-10)

`packages/bim-editor/src/editor/schedules` — hazır listeler ve başlıkları, ızgaranın
reddetmeleri, kaydedilmiş sütun genişlikleri, proje ağacının çizelge satırları ve fiyat
tablosunun “kimin kitabı”sı — çevrilirken bunlar gerekti.

**Ad alanı:** bu ekranların sözcükleri `editor` ad alanında, `schedule.*` altında yaşar;
`packages/bim-schedules-ui/locales/tr/schedules.json` ise **çizelge yüzeylerinin**
(`ScheduleBuilder`, `ScheduleGrid`, `ScheduleColumnsSheet`) kendi sözcüklerini taşır.
Çizelge ızgarasının kendi adları oradadır; düzenleyicinin onun çevresindeki kabuğu
(başlık, yükleme satırı, hata kartı, hazır liste adları, fiyat tablosu) buradadır.

| EN | TR | Not |
|----|----|-----|
| Equipment list / Not placed yet / Loads / Space loads / Panel loads | **Ekipman listesi / Henüz yerleştirilmedi / Yükler / Mekan yükleri / Pano yükleri** | §2.3 *Space* = **mekan**; §9/Ç7 *panel* = **pano** |
| PLANNED LEVEL / CONNECTION TYPE | **PLANLANAN KAT / BAĞLANTI TİPİ** | Başlıklar **büyük harf** basılır (§5 alan adları) |
| CW WSFU / HW WSFU / TOTAL WSFU | **SOĞUK SU WSFU / SICAK SU WSFU / TOPLAM WSFU** | §7: `WSFU` bir birim sembolüdür; `plumbing.totalWsfu` = *Toplam WSFU* ile aynı |
| HW DEMAND / GAS INPUT / GAS FLOW / ELEC LOAD | **SICAK SU TALEBİ / GAZ GİRİŞİ / GAZ DEBİSİ / ELEKTRİK YÜKÜ** | §5.7 *gas flow* = **gaz debisi**; *load* burada **yük** (§9/Ç12 *load unit* = yük birimi) |
| ESTIMATE (VA) / DEVICES SO FAR (VA) / COUNTED (VA) | **TAHMİN (VA) / ŞİMDİYE KADARKİ CİHAZLAR (VA) / SAYILAN (VA)** | §7 birim sembolleri parantez içinde aynen kalır |
| ESTIMATE VS DEVICES | **TAHMİN / CİHAZLAR** | Tek başlık, iki taraf |
| Schedule cell edit / Schedule edit ({{count}} cells) | **Çizelge hücresi düzenlemesi / Çizelge düzenlemesi ({{count}} hücre)** | Geri alma etiketi; §2.4 *schedule* = **çizelge** |
| The model hasn't loaded yet. Try again in a moment. | **Model henüz yüklenmedi. Birazdan yeniden deneyin.** | §0.7 kibar çoğul |
| Changes to several items at once can't be saved as one step yet. | **Birden çok öğedeki değişiklikler henüz tek adımda kaydedilemiyor.** | §8 reddetme sözlüğü: *henüz* |
| Served items are changed on their own rows. | **Sunulan öğeler kendi satırlarında değiştirilir.** | *Served* = bir kaynaktan beslenen satır |
| The model's schedules list / Retry | **Modelin çizelge listesi / Yeniden dene** | `unavailableIn` ile çerçevesi de Türkçe |
| Your column widths for this schedule couldn't be loaded. | **Bu çizelgenin sütun genişlikleriniz yüklenemedi.** | *Width* burada **genişlik** (§5.2 *kalınlık* değil) |
| Put a row from the Loads list here | **Yükler listesinden bir satırı buraya koy** | Borunun açık ucundaki denetim; ipucu ve Özellikler aynı anahtarı yazar |
| {{shown}} isn't drawn yet. To pipe it: … | **{{shown}} henüz çizilmedi. Boruya bağlamak için: …** | §3 *Route* = **Boru çiz**; satır adı veri olarak tırnak içinde gelir |
| another company / estimate · budget · contract | **başka bir firma / tahmin · bütçe · sözleşme** | §2.2 *firm* = **firma**; §9/Ç20: *İşveren* değil |
| {{book}}, {{owner}}'s {{basis}} as of {{date}} | **{{book}}, {{owner}} firmasının {{basis}} fiyatları, {{date}} itibarıyla** | İyelik ve “as of” o dilin işidir; İngilizce birebir aynı kalır |

> **`schedules/` kapandı (2026-11-10).** Ağaç **39** siteden (altı dosya) sıfıra indi ve
> `OUTSIDE_STAGE_4`'ten çıkıp `OWNED_DIRS`'a girdi; Türkçesi `i18n-schedules.test.tsx`
> içinde (yeni satırlarla birlikte) ölçülür.
>
> **Hazır listenin sözcükleri yapıldığı dilde yazılır.** `builtinList(id, t)` ve
> `builtinListDefinition(model, id, t)` bir `Translate` alır: Türkçe çalışan biri Türkçe
> başlıklarla bir liste açar (parça düzenleyicideki “yeni parçanın varsayılanları”
> kararıyla aynı). `BUILTIN_LIST_LABELS` / `BUILTIN_LIST_DESCRIPTIONS` tabloları kalktı:
> İngilizce artık `builtinListLabel` / `builtinListDescription` erişenlerinde, tek yerde.
>
> **Ertelenen: bir listenin *adı* İngilizce kalır.** `builtinListStoredName(id)` bir
> görünümün modelde saklandığı addır ve `findBuiltinListView` geçen hafta yapılmış
> listeyi **onunla** bulur; çevirmek eşlemeyi bozar. Ağaç satırı, şerit ve Yeni çizelge
> penceresi `builtinListLabel(id, t)` der. Sahibi: çizelge görünümlerinin adı için bir
> kimlik alanı (Aşama 5'in alan haritası).
>
> **Ertelenen: çekirdeğin ve kitaplığın şablon verisi.** `takeoffScheduleDefinition()`
> (metraj şablonunun adı ve başlıkları), `equipmentListDefinition()`
> (`@permitzip/bim-library`) ve `connection_type.mark` gibi alan **yolları** veridir;
> ağaç onları yazmaz. `PRICE_BOOK_BASIS_LABELS` de sözleşme katmanının verisidir; cümle
> içinde kullanılan biçimi `basisWord` söyler.

### 5.18 Aşama 4 dışı: kontrol listesi ağacı (2026-11-10)

`packages/bim-editor/src/editor/checklist` — gereklilik satırları ve durumları, geçersiz
kılma ve karar formları, Doğrula ve Kod Haritası bağlantısı, “En çok neyi belirliyor” ve
“Sizi bekleyen birleştirmeler” — çevrilirken bunlar gerekti. Yukarıda **zaten** karara
bağlı olanlar tekrar yazılmadı (`Doğrulandı`, `Karşılandı`, `Bekliyor`, `Çakışma`,
`Bulgu`, `Önem düzeyi`, `Gerekçe`, `Branşman`, `Sahip/İşveren`).

| EN | TR | Not |
|----|----|-----|
| Verified / Overridden / Withdrawn | **Doğrulandı / Geçersiz kılındı / Geri çekildi** | §8 durum sözlüğü; `questions` ağacının *Geri çekildi*'siyle aynı |
| Verified in its code study / Ruled out in its code study | **Kod çalışmasında doğrulandı / Kod çalışmasında elendi** | *Ruled out* = **elendi**, *kaldırıldı* değil |
| Found by an agent / Proposed | **Bir ajan buldu / Önerildi** | §8; *öneri* bir durumdur, *teklif* değil |
| Met / Not met / Not drawn yet | **Karşılandı / Karşılanmadı / Henüz çizilmedi** | §8: *met* = karşılanmak |
| No model check; a person confirms it | **Model denetimi yok; bir kişi onaylar** | *check* burada **denetim** (bir *kontrol* değil) |
| at least / at most | **en az / en çok** | §5.5'in toplam/azami/asgari sözlüğünden ayrı: bu bir **karşılaştırma**dır |
| Open / Met or decided | **Açık / Karşılandı veya karara bağlandı** | §8 |
| Override… / Override / Reason (required) | **Geçersiz kıl… / Geçersiz kıl / Gerekçe (zorunlu)** | §3 *override* = **geçersiz kıl**; *gerekçe* zorunludur |
| Record decision / What you decided / Answer / Reasoning / Confidence | **Kararı kaydet / Karar verdiğiniz konu / Yanıt / Gerekçe / Güven düzeyi** | Bir karar **karar**dır (*hüküm* değil) |
| High / Medium / Low (confidence) | **Yüksek / Orta / Düşük** | Başlıksız, tek sözcük |
| Verify / Verify it as a person with code-study edit rights | **Doğrula / Kod çalışması düzenleme yetkisi olan bir kişi olarak doğrulayın** | Ajanlar asla doğrulamaz; cümle kişiyi söyler |
| Overridden in the model and offered to the Code Map | **Modelde geçersiz kılındı ve Kod Haritası’na sunuldu** | *Code Map* bir ürün adıdır, çevrilmez |
| Link to Code Map / Open in Code Map | **Kod Haritası’na bağla / Kod Haritası’nda aç** | |
| Also from {{provider}}: … / no model check | **{{provider}} tarafından da: … / model denetimi yok** | Aynı yer için ikinci kaynağın gerekliliği (karar 11) |
| {{count}} open / and {{count}} more | **{{count}} açık / ve {{count}} tane daha** | §8: sayıdan sonra çoğul eki yok |
| Show {{count}} more causes ({{left}} left) | **{{count}} neden daha göster ({{left}} kaldı)** | *Cause* = burada **neden** (kuralın dayanağı) |
| What drives the most | **En çok neyi belirliyor** | *Drive* burada **belirlemek**; §9/Ç9 *run* = çalıştır ile karışmaz |
| Drives {{count}} requirement(s) | **{{count}} gereklilik belirliyor** | §8 |
| nothing drives a requirement yet | **henüz bir gerekliliği belirleyen bir girdi yok** | *input* = **girdi** |
| Merges waiting for you | **Sizi bekleyen birleştirmeler** | §9/Ç8 *branch* = **dal**; *merge* = **birleştirme** |
| Branch: {{name}} / proposed by … / version … | **Dal: {{name}} / öneren … / sürüm …** | §2.2 *version* = **sürüm**, *revizyon* değil |
| 1 conflict with Main to resolve on the branch first | **Önce dalda çözülecek 1 çakışma (Main ile)** | §5.11 *clash/conflict* = **çakışma**; *Main* dal adıdır (veri) |
| Design change. Not a change order. | **Tasarım değişikliği. Değişiklik emri değil.** | §5.1 *change order* = **değişiklik emri** |
| You were named responsible for {{what}}. Accept? | **{{what}} için sorumlu olarak adlandırıldınız. Kabul edilsin mi?** | §0.7 kibar çoğul; *accept* = **kabul et** |
| Take responsibility / Take responsibility for this | **Sorumluluğu üstlen / Bunun sorumluluğunu üstlen** | §9/Ç20 *responsibility* = **sorumluluk** |
| Approve / Decline… / Decline | **Onayla / Reddet… / Reddet** | *Reddet*, *geri çevir* değil |
| Say why you decline, so the proposer knows what to change. | **Neden reddettiğinizi yazın, öneren neyi değiştirmesi gerektiğini bilsin.** | İki yerde aynı anahtar (ipucu ve engel nedeni) |
| Yours / Yours (as project lead) | **Sizin / Sizin (proje lideri olarak)** | §4.1 *project lead* = **proje lideri** |
| Approved / Declined / Waiting / Changed since approval | **Onaylandı / Reddedildi / Bekliyor / Onaydan beri değişti** | §8 |
| {{count}} change / changes | **{{count}} değişiklik** | §8: tek biçim |
| Request sent to {{who}} | **Talep {{who}} kişisine gönderildi** | |
| No merges are waiting for you. | **Sizi bekleyen birleştirme yok.** | |
| Couldn't accept it. Try again. | **Kabul edilemedi. Yeniden deneyin.** | Fiil + ad birleştirilmez: her eylemin **kendi cümlesi** vardır |

> **`checklist/` kapandı (2026-11-10).** Ağaç **119** siteden (dört dosya) sıfıra indi ve
> `OUTSIDE_STAGE_4`'ten çıkıp `OWNED_DIRS`'a girdi; Türkçesi `i18n-checklist.test.tsx`
> içinde ölçülür.
>
> **Durum ve karşılama sözcükleri erişen oldu.** `statusLabel`, `fulfilmentLabel` ve
> `valueLabel` bir `Translate` alır (`MODEL_STATUS_LABEL` tablosu kalktı; İngilizce
> `englishOnly` ile birebir aynı). Grafiğin yazdığı `fulfilment.summary` **veri**dir:
> olduğu gibi gösterilir.
>
> **Bir cümle bir anahtardır.** `act(fn, what)` “Couldn’t ${what}. Try again.” diye
> fiil + ad kuruyordu — bu sıra İngilizcenin sırasıdır. Her eylem artık **kendi
> cümlesini** taşır (`acceptFailed`, `grantFailed`, `takeFailed`, `decideFailed`).
>
> **Ertelenen: `VERIFY_NEEDS_RIGHTS`.** “Doğrulamak için kod çalışması düzenleme
> yetkisi gerekir” cümlesi `../code-study/code-study-client` sabitidir; satır onu
> olduğu gibi gösterir. Sahibi: `code-study` ağacının kendi turu.

### 5.19 Aşama 4 dışı: kalan ağaçlar (2026-11-10)

Aşama 4 planının hiç adlandırmadığı on dokuz ağaç — `calc-sheets`, `diagrams`,
`connection-types`, `graph`, `graphics`, `contributions`, `connect-grip`,
`connect-agent`, `code-study`, `loads-policy`, `construction`, `view-input`,
`blocks`, `ceilings`, `copies`, `branches`, `code-change`, `planned`,
`responsibilities` — bu son turda ölçüldü ve çevrildi. Ölçüm tahmin değil: her ağaç
`i18n-negative-space.test.ts` taramasından geçti (**625** bulgu, 19 ağaç) ve sıfıra
indi. Yukarıda **zaten** karara bağlı olanlar tekrar yazılmadı (`Pafta`, `Hesap`,
`Görünüm`, `Kat`, `Mekan`, `Eleman`, `Parça`, `Tip`, `Kopya`, `Yük`, `Politika`,
`Diyagram`, `Tek hat diyagramı`, `Kolon şeması`, `Talep eğrisi`, `Kanal`, `Boru`,
`Hat`, `Branşman`, `Panel/Pano`, `Armatür`, `Yük birimi`, `İşveren`).

| EN | TR | Not |
|----|----|-----|
| Connection type (a trade form's pick list) | **bağlantı türü** | §2.8 *Fitting* = **bağlantı parçası**, §2.3 *Connector* = **bağlantı noktası**: üçü karışmaz |
| Starter types (a project does not have them yet) | **başlangıç türleri** | §5.10 *starter pack* = **başlangıç paketi** ile aynı sözcük; *başlatıcı* değil |
| (not in the project's types) | **(projenin türlerinde yok)** | Kayıtlı *designator* artık katalogda değil; designator **veri**dir, çevrilmez (§7 ruhu) |
| Why is this here? (the Inspector's first graph question) | **Bu neden burada?** | §5.18 karar formunun sorduğu soruyla **tek** söylem; başlık ve `aria-label` aynı anahtar |
| What depends on this (the second) | **Buna bağlı olanlar** | “Neye bağlı” değil: *this* bağımlı olandır, bağımlılık değil |
| Record a decision / for {{name}} | **Bir karar kaydet** / **{{name}} için bir karar kaydet** | §5.18 `checklist.decision.record` = *Kararı kaydet*; ikisi ayrı cümledir, ikisi de karar kaydeder |
| and {{count}} more | **ve {{count}} tane daha** | §8: sayıdan sonra çoğul eki yok |

> **`graph/` kapandı (2026-11-10).** **7** bulgu (bir dosya) sıfıra indi; ağaç
> `OWNED_DIRS`'a girdi ve Türkçesi `i18n-graph.test.tsx` içinde ölçülür.
>
> **Ertelenen: grafiğin kendi cümleleri.** `answer.empty`, her `item.cause` ve
> `depends.quantityDeltas[].label` çekirdeğin yazdığı **veri**dir; bölüm onları
> olduğu gibi gösterir. Sahibi: çekirdeğin prose haritası (Aşama 5).


---

## 6. Maliyet ve ticari terimler

| EN | TR | Not |
|----|----|-----|
| Cost | **maliyet** | |
| Cost code | **maliyet kodu** | |
| Unit price / Unit rate | **birim fiyat** | |
| Price book | **fiyat kitabı** | |
| Not priced / Not priced (quantities only) | **fiyatlanmadı** / **fiyatlanmadı (yalnız miktar)** | |
| Estimate | **keşif** | ⚠️ bkz. §9/Ç14 |
| Takeoff / Takeoff item | **metraj** / **metraj kalemi** | |
| Quantity / Quantity change | **miktar** / **miktar değişimi** | |
| Total / Totals | **toplam** / **toplamlar** | |
| Change order | **değişiklik emri** | |
| Submittal | **imalat onayı** | ⚠️ bkz. §9/Ç19. Panel başlığı da aynı sözcüğü kullanır: `panel.submittals` = **İmalat onayları** (*Onay belgeleri* değil — 2026-11-10 son tur) |
| RFI | **bilgi talebi (RFI)** | |
| Approval / Approved | **onay** / **onaylandı** | |
| Approved product | **onaylı ürün** | |
| Approved substitution | **onaylı ikame** | |
| Rejected | **reddedildi** | |
| Issue purpose / Issue set / Issued | **yayın amacı** / **yayın seti** / **yayınlandı** | |
| Sign-off / Signed | **imza onayı** / **imzalandı** | |
| Hard cost | **inşaat maliyeti** | |
| Gross area | **brüt alan** | |
| Rentable area | **kiralanabilir alan** | |
| Yield on cost | **maliyet getirisi** | |
| Parcel | **parsel** | |
| Client | **müşteri** | |
| Owner | **işveren** | ⚠️ yalnız **sözleşme tarafı**; modelin sahibi olan kişi **sahip** — bkz. §9/Ç20 |
| Contractor | **yüklenici** | |
| Engineer of record | **sorumlu mühendis** | |
| Permit | **ruhsat** | |
| Licence no. / state | **ruhsat no. / ili** | |

---

## 7. Birimler

**Kural:** Birim *sembolleri* çevrilmez (`mm`, `m²`, `Pa`, `kW`, `CFM`). Yalnızca **açık yazılmış adlar** çevrilir.

| EN (açık yazım) | TR |
|-----------------|-----|
| Amps | Amper |
| Volts | Volt |
| Horsepower | Beygir gücü |
| Pounds | Libre |
| Degrees | Derece |
| Inches / Feet | İnç / Fit |
| Unitless | Birimsiz |
| per person | /kişi |
| per area | /alan |

**Türkçe varsayılan birim sistemi:** SI (metrik). `in. w.c.`, `ft/100 ft`, `psf`, `plf`, `kip`, `pcf`, `MBH`, `tons` (soğutma) gibi ABD kısaltmaları **varsayılan olarak gösterilmez**; `en-US` yerelinde kalır. Türk kullanıcı `Pa`, `kW`, `m³/h`, `L/s` görür.

---

## 8. Sayı, çoğul ve durum metinleri

Türkçede **çoğul eki yoktur** sayıdan sonra: "3 eleman" (~~"3 elemanlar"~~). Bu yüzden İngilizcedeki `1 element / 2 elements` ayrımı Türkçede **tek biçime** iner.

> ⚠️ **Yer tutucu sözdizimi.** Bu bölümdeki `{n}` yalnızca **gösterim** kolaylığıdır. Gerçek `tr` çeviri dosyalarında i18next'in varsayılan sınırlayıcısı **`{{n}}`** (çift süslü parantez) kullanılır: `"{{n}} eleman"`. Tek süslü parantez (`{n}`) yazılırsa i18next onu **değiştirmez** ve arayüzde harfi harfine `{n} eleman` görünür. `packages/bim-ui/__tests__/i18n-parity.test.ts` bu hatayı yakalar.

> ⚠️ **Bu bölümün denetçisi biçime bakar, sözcük türüne bakmaz.** `packages/bim-ui/__tests__/i18n-glossary.test.ts` sayıdan sonra gelen **her** sözcüğün sonuna bakar, dolayısıyla `-lar/-ler` ile biten ama çoğul **olmayan** doğru bir cümleyi de reddeder: "bir istek 30 dakika **bekler**" (fiil) uyarı üretir. Böyle bir cümleyi denetçiyi memnun etmek için **anlamı silerek** kısaltmayın — *bekler* → *bekledikten sonra* gibi, anlamı koruyan bir biçime çevirin. Denetçinin bu bilinen sınırı bilinçli kabul edilmiştir: yanlış alarm, kaçırılmış bir çoğuldan daha ucuzdur.

| EN | TR |
|----|-----|
| `{n} element` / `{n} elements` | `{n} eleman` |
| `{n} selected` | `{n} seçili` |
| `{n} of {m}` | `{m} içinden {n}` |
| `{freeSlots} of {spaces} slots free` | `{spaces} yerden {freeSlots} boş` |
| `{n} edits` / `1 edit` | `{n} düzenleme` |
| `and {n} more` | `ve {n} tane daha` |
| `None yet` / `No … yet` | `Henüz yok` |
| `Nothing …` | `Hiçbir şey …` |
| `All levels` | `Tüm katlar` |
| `Mixed phases` / `Mixed` | `Karışık fazlar` / `Karışık` |
| `Not set` | `Ayarlanmadı` |

**Durum/hata terimleri (kelime dağarcığı — cümle değil).** Bu liste çevirirken kullanılacak
**terimlerdir**; hiçbiri gönderilen bir cümlenin birebir alıntısı değildir. Gönderilen
cümleler §8.1'dedir ve sözlük onlarla eşleşmek zorundadır. (Bu satır bir zamanlar alıntı
listesi gibi okunuyordu: `Salt okunur`, `Hazır değil`, `İlgi gerekiyor` hiçbir tr dosyasında
geçmiyor — terim olarak duruyorlar, cümle olarak değil; `bağlı elemanlar var` ise artık
gönderilen cümle değil, §8.1'de `Buna bağlı başka şeyler var`.)

bağlantı kurulamıyor · Bu bilgisayar çevrimdışı · Bağlantı kontrol ediliyor · Oturumunuz kapalı ·
Model sunucusu oturum açmanızı reddetti · Bu proje için canlı düzenleme henüz kurulmadı · Bu
modeli düzenleme yetkiniz yok · Yalnızca görüntüleme · Salt okunur · Bağlandı. Tüm değişiklikler
kaydedildi · Bağlanıyor… · Yeniden bağlanıyor… · Kaydediliyor… · Kaydedilmemiş değişiklikler ·
Kaydedilmemiş değişiklik yok · Kaydedilmedi · Hazır değil · İlgi gerekiyor · Önce boyutu düzeltin ·
reddedildi · çakışma · geçersiz · kilitli · kullanımda · eski · desteklenmiyor · yasak ·
bağlı · sabitlenmiş · dolu · geri alınamadı · devre dışı · engellendi

#### §8.1 Hata kodu → cümle (gönderilen metin)

Kernel reddetmeleri `CommandError` ile bir **kod** ve serbest İngilizce bir cümle
taşır. Cümle bir şablona eşlenebiliyorsa Türkçesi gösterilir; eşlenemiyorsa (cümle
bir ad ya da çoğul taşıyorsa) **koda ait genel cümle** gösterilir. Bu tablo o genel
cümlelerdir ve **gönderilen metindir** — sözlük gerçeğe uymak zorundadır.

| kod | gönderilen Türkçe |
|-----|-------------------|
| `element_not_found` | O eleman bulunamadı. Modelden yeniden seçin. |
| `wrong_kind` | O eleman bu şekilde değiştirilemez. |
| `outside_host` | Bu, ait olduğu elemanın dışına çıkıyor. İçeri taşıyıp tekrar deneyin. |
| `tap_spacing` | Başka bir branşman ayrımına çok yakın. Aralarında en az bir ayrım genişliği bırakın. |
| `min_straight_length` | Bu, bir elemanı en kısa düz uzunluğundan kısa bırakır. Kaydırıp tekrar deneyin. |
| `anchored_would_move` | Bu, bağlı olduğu şeyi hareket ettirir. Önce bağlantısını kesin. |
| `unsupported_geometry` | Model bu biçimi henüz kuramıyor. Güzergâhı değiştirip tekrar deneyin. |
| `profile_incompatible` | Bu boyut, birleştiği bağlantı parçalarına uymuyor. |
| `disconnected` | Uçlar birleştirilemedi. Birbirine baktıklarını kontrol edin. |
| `invalid_value` | Bu değer geçerli değil. Kontrol edip tekrar deneyin. |
| `already_exists` | Bu zaten var ya da başka bir şeyle çakışıyor. Başka birini seçin. |
| `in_use` | Bu işlem yapılamadı. Eleman kilitli, sabitlenmiş ya da başka bir yerde kullanımda olabilir. |
| `stale_base` | Aynı anda başka biri bunu değiştirdi. Tekrar denemeden önce yenileyin. |
| `conflict` | Aynı anda başka biri bunu değiştirdi, bu yüzden hiçbir şey kaydedilmedi. Kontrol edip tekrar deneyin. |
| `forbidden` | Bu modeli düzenleme yetkiniz yok. |
| `has_dependents` | Buna bağlı başka şeyler var, bu yüzden hiçbir şey değişmedi. |
| `undo_refused` | Bu değişiklik artık geri alınamıyor. |
| `locked` | Kilitli olduğu için değiştirilemedi. Kilidi açıp tekrar deneyin. |

> **Kural — genel cümle tek bir neden ileri sürmez.** Bir kodun cümlesi, o koda düşen
> **her** cümle için doğru olmak zorundadır. İki ayrı yasak vardır ve ikisi de
> `packages/bim-editor/__tests__/i18n-refusal-sentences.test.ts` içinde ölçülür:
>
> 1. **Ekran adı yasağı** (`SCREEN_NOUNS`): genel cümle bir ekranı (*pafta*, *grup*,
>    *faz*, *devre*…) ancak o kodun **bütün** cümleleri o ekrandan söz ediyorsa
>    adlandırabilir.
> 2. **Tek neden yasağı** (`CAUSE_WORDS`): genel cümle bir neden (*kilit*, *sabitlen*,
>    *dolu*, *kullan*…) ancak o kodun **bütün** cümleleri o nedenle ilgiliyse ileri
>    sürebilir; aksi hâlde cümle **seçenek sunmak** zorundadır (`ya da` / `veya` /
>    `or`).
>
> `in_use` bunun örneğidir: **ölçülen 19** cümlesi üç kilit cümlesi, varsayılan grup,
> varsayılan faz, iki "en az bir" kuralı (faz, faz filtresi), üç devre cümlesi, iki yük
> noktası cümlesi, **başka bir bağlantı üzerinde** duran bir eleman, iki "yayılmış"
> metraj cümlesi, üç "başka bir filtre/faz/stil verin" cümlesi ve bir "fazda oluşturuldu
> veya yıkıldı" cümlesi hakkındadır — nedeni tek değildir, çaresi de. Bu yüzden
> gönderilen cümle nedeni **seçenek olarak** sayar ve **hiçbir çare adı vermez**: ekranın yapamayacağı bir adım önermek, yanlış nedeni
> söylemekten daha kötüdür. Tek nedenli bir kod (`locked`) tek nedenini söyleyebilir,
> çünkü bütün cümleleri aynı nedenledir.
>
> **Üçüncü yasak — uydurulmuş çare, yalnızca incelemede denetlenir.** Genel cümle,
> ekranın yerine getiremeyeceği ya da yalnızca bazı aileler için doğru olan bir adım
> önermez ("paftadan kaldırın", "grubun kilidini açın"). Nedeni tek olan bir kodda çare
> de tektir ve yazılabilir (`locked`: "Kilidi açıp tekrar deneyin"); nedeni çok olan bir
> kodda cümle çare **önermez**. Bunu ölçen bir test yoktur — `CAUSE_WORDS` yalnızca
> nedeni olan bir cümlenin aileye uyup uymadığını ölçer; "bu adım doğru mu" sorusu
> inceleyenin işidir.
>
> **Ölçüm sınırı.** "19" **ölçülen** sayıdır, cümlelerin tamamı değil:
> `tools/i18n/extract-prose.mjs` yalnızca motorun `refuse(kod, cümle, ids)` çağrısını
> okuyor. Dosyaların kendi sarmalayıcıları görünmüyor — bugüne kadar bulunanlar
> `fail(cümle, ids, kod)` (`annotation/text-note-commands.ts`, `commands/views.ts:700`,
> `commands/view3d.ts`) ve `refusal(cümle, ids, kod)` (`commands/views.ts:1725`); bir
> sonraki dosyanın uyduracağı şekil de aynı kurala girer. `${…}` içine yuvalanmış şablon
> dizeleri de kayıp. Bu yüzden **üç aile** `in_use` koduna ulaşır ama ölçülen 19'un
> içinde **değildir**: sabitlenmiş pafta elemanı (`commands/views.ts:1518,1595`), dolu pano
> (`connections/commands.ts:253`) ve bütün gerçek pafta aileleri
> (`commands/views.ts:1390,1704`). Gönderilen cümle onları **tasarım gereği** kapsar
> ("kilitli, sabitlenmiş ya da başka bir yerde kullanımda" bu yüzden var). Aile listesine
> yeni bir cümle eklerken önce bu boşluğu kapatın (rapor, erteleme listesi).
>
> **Bilinen sınır:** bu iki liste elle yazılmıştır; test, listede olmayan bir neden
> kelimesini göremez. Bir koda yeni bir cümle ailesi eklenirse listeye o ailenin
> kelimesini de ekleyin — sayıyı test değil, liste belirler.

---

## 9. Çakışan terimler — onay gerektiren kararlar

Bunlar sözlüğün en kritik kısmı. Her biri için **benim önerim** yazılı; farklıysa söyle.

| # | Çakışma | Önerim |
|---|---------|--------|
| Ç1 | **`Model`** — (a) BIM modeli, (b) ribbon sekmesi, (c) **yapay zekâ modeli** (`ai-model`) | Üçü de *model*. Çakışma bağlamla çözülür: AI alanı `Yapay zekâ modeli` (`AI model`), ribbon sekmesi `Model`. Kullanıcı karışmaz çünkü biri form alanı, biri sekme. |
| Ç2 | **`Element` / `Part` / `Piece` / `Item`** | *eleman* / *parça* / *eleman* / *kalem*. `piece` kullanıcıya hiç gösterilmez. |
| Ç3 | **`Sheet`** — yalnızca çizim paftası; asla tablo | *pafta*. `Sheets` sekmesi *Paftalar*, `Schedules` sekmesi *Çizelgeler* — karışmaz. |
| Ç4 | **`Schedule`** — (a) model verisi tablosu, (b) "scheduled insulation" (planlanmış), (c) pano çizelgesi | (a) *çizelge*, (b) *planlanmış*, (c) *pano çizelgesi*. |
| Ç5 | **`Type` / `Part type` / `Edit type`** | *tip* / *parça tipi* / *tipi düzenle*. `category` = *kategori* (ayrı tutulur). |
| Ç6 | **`Level`** — kat, çizelge alanı, "Detail level" | *kat* / *kat* / *detay seviyesi*. |
| Ç7 | **`Panel`** — elektrik panosu vs UI yan paneli | *pano* (elektrik) / *panel* (UI). |
| Ç8 | **`Branch`** — MEP branşmanı vs tasarım dalı | *branşman* (MEP) / *dal* (sürüm). |
| Ç9 | **`Run`** — MEP hattı, komut "Run", süre "runs 3 hours" | *hat* (MEP) / *çalıştır* (komut) / *sürer* (süre). |
| Ç10 | **`Copy`** — panoya kopyalama vs "Copies from linked model" (kopya izleme) | *Kopyala* (komut) / *kopyalar* (izlenen nesneler). |
| Ç11 | **`Section`** — kesit çizgisi vs form bölümü | *kesit* (çizim) / *bölüm* (form). |
| Ç12 | **`Fixture`** — sıhhi armatür, aydınlatma armatürü, "fixture units" | *armatür* / *armatür* / *yük birimi* (WSFU/DFU). |
| Ç13 | **`Rate`** — debi, birim fiyat, sürtünme oranı | *debi* / *birim fiyat* / *sürtünme oranı*. |
| Ç14 | **`Estimate`** — maliyet keşfi vs elektrik talep tahmini | *keşif* (maliyet) / *tahmin* (talep). |
| Ç15 | **`Zone`** — mekan bölgesi, yangın bölgesi, kod bölgesi | *bölge*, nitelikli: *yangın bölgesi*, *kod bölgesi*. |
| Ç16 | **`Mark`** — işaret numarası vs fiil | *işaret* (alan) / *işaretle* (fiil). |
| Ç17 | **`Duct` / `Pipe`** — isim ve fiil | *kanal* / *boru*; fiil *kanal çiz* / *boru çiz* (asla "borula"). |
| Ç18 | **ABD mühendislik kısaltmaları** | Varsayılan SI; ABD kısaltmaları yalnız `en-US` yerelinde. |
| Ç19 | **`Submittal`** | *imalat onayı* (sektörde yerleşik). Alternatif *malzeme onayı*. |
| Ç20 | **`Owner`** — (a) sözleşmede işi veren taraf, (b) bir modelin/hesabın sahibi olan kişi | (a) **işveren** (§6), (b) **sahip**. Ayrım bağlamla çözülür ve iki terim karıştırılmaz. **Karar (2026-11-10):** barındırılan uygulamanın “Who has it” listesindeki `share.owner` = (b) → **Sahip**; sözleşme/parsel/maliyet ekranlarındaki `Owner` = (a) → **işveren**. Bir modelin sahibi için "işveren" yazmak yanlıştır — o kişi işveren değil, modeli oluşturan kişidir. |
| Ç21 | **`Clearance`** — parçanın ihtiyaç duyduğu serbest mesafe vs **`Void`** | *açıklık* (clearance) / *boşluk* (void). Aynı sözcüğü ikisine de vermek, "açıklık bölgesi" ile "boşluk"u karıştırır. `working space` bir *çalışma boşluğu*'dur (NEC), *çalışma alanı* değil — *alan* = area (§2.3). |

---

## 10. Sözlüğe nasıl uyulur

- Çeviri yapacak ajan/kişi, her yeni string için **önce bu dosyaya bakar**.
- Sözlükte olmayan terim çıkarsa: **uydurmaz**, `docs/i18n/glossary.md`'ye öneri olarak ekler ve bildirir.
- `en` metni **değişmez**; `tr` çevirisi bu sözlüğe göre yazılır.
- Terim tutarlılığı test edilir: aynı İngilizce terim kod tabanında tek Türkçeye eşlenmelidir.
