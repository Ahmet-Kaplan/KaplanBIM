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

---

## 5. Çizelgeler ve metraj

**Alan adları:** İşaret · Tip · Kat · Oda · Oda içinde · Kaynak yolu · Parça tipi · Açıklama · Birim · Genişlik · Uzunluk · Yükseklik · Yangın dayanımı · K faktörü · Sıcaklık dayanımı · Moment · Depolama · Gaz girişi · Beslenen yük · Besleme yükü · Tahliye yükü · Besler · Pano · Sütun başlığı · Formül · Formül adı · Grupla · Sırala · Bölüm · Sıra · Çizelge adı · Boş hücreler · Yalnızca şu koşuldaki satırlar · Tek özet değeri · Bir sayı · Evet veya hayır · Metin · Yazdırılmaz · Kullanımdan kaldırıldı · Toplam (sum/max/min/none → **toplam/azami/asgari/yok**)

**Miktar türleri:** Sayı · Oran · Eğim · Adet · Kullanıcı yükü · Uzunluk · Alan · Hacim · Ağırlık · Süre · Açı · Kuvvet · Moment · Gerilme · Basınç · Alan yükü · Çizgi yükü · Yoğunluk · Hız · Hava debisi · Sıvı debisi · Gaz debisi · Kütle debisi · Aktif güç · Motor gücü · Görünür güç · Reaktif güç · Isıtma/soğutma kapasitesi · Gaz girişi · Enerji · Akım · Gerilim · Direnç · Birim uzunluk direnci · Frekans · Sıcaklık · Sıcaklık farkı · Işık akısı · Aydınlık düzeyi · Işık şiddeti · Sprinkler yoğunluğu · K faktörü · Su tesisatı yük birimi (WSFU) · Pis su yük birimi (DFU) · Sürtünme oranı · Yağış şiddeti · Kullanıcı yük faktörü · Maliyet · Güç yoğunluğu · Alan başına hava debisi · Kişi başına hava debisi · Kesit modülü · Atalet momenti

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

**Durum/hata sözlüğü:** Bağlantı kurulamıyor · Bu bilgisayar çevrimdışı · Bağlantı kontrol ediliyor · Oturumunuz kapalı · Model sunucusu oturum açmanızı reddetti · Bu proje için canlı düzenleme henüz kurulmadı · Bu modeli düzenleme yetkiniz yok · Yalnızca görüntüleme · Salt okunur · Proje dışındakiler için salt okunur · Bağlandı. Tüm değişiklikler kaydedildi · Bağlanıyor… · Yeniden bağlanıyor… · Kaydediliyor… · Kaydedilmemiş değişiklikler · Kaydedilmemiş değişiklik yok · Kaydedilmedi · Hazır değil · İlgi gerekiyor · Önce boyutu düzeltin · reddedildi · çakışma · geçersiz · kilitli · kullanımda · eski · desteklenmiyor · yasak · bağlı elemanlar var · geri alınamadı · devre dışı · engellendi · Bu adda veya numarada bir kayıt zaten var · Aynı anda başka biri bunu değiştirdi · Görünümünüz güncellendi; tekrar deneyin · O eleman başka biri tarafından kaldırıldı · Hiçbir şey silinmedi

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
