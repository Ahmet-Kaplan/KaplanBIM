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
| Drawn items | **Çizilmiş öğeler** | `Modify · Drawn items` sekmesi → **Değiştir · Çizilmiş öğeler** |
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
| Above, from the south-east | **yukarıdan, güneydoğudan** | Çeyrek açılı görünümler; yön adları §2.3 |
| Three-quarter views | **çeyrek açılı görünümler** | |
| Diagram / One-line / Riser / Isometric | **diyagram / tek hat / kolon şeması / izometrik** | §2.4 *Riser diagram* = kolon şeması |
| Grid | **ızgara** | §2.3 |
| Title block / Paper | **antet / kâğıt** | §2.4 |
| Machine / Project information | **proje bilgileri** | Her paftanın antedine yazılan künye |
| Retired (library item) | **kullanımdan kaldırıldı** | §5 alan adları |

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
| Submittal | **imalat onayı** | ⚠️ bkz. §9/Ç19 |
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
| `in_use` | Bu işlem yapılamadı. Öğe kilitli, sabitlenmiş ya da başka bir yerde kullanımda olabilir. |
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
> içinde **değildir**: sabitlenmiş pafta öğesi (`commands/views.ts:1518,1595`), dolu pano
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

---

## 10. Sözlüğe nasıl uyulur

- Çeviri yapacak ajan/kişi, her yeni string için **önce bu dosyaya bakar**.
- Sözlükte olmayan terim çıkarsa: **uydurmaz**, `docs/i18n/glossary.md`'ye öneri olarak ekler ve bildirir.
- `en` metni **değişmez**; `tr` çevirisi bu sözlüğe göre yazılır.
- Terim tutarlılığı test edilir: aynı İngilizce terim kod tabanında tek Türkçeye eşlenmelidir.
