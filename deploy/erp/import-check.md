# IFC içe aktarım + otomatik metraj + BOQ taslağı kontrol listesi

Bu belge **Görev 0.4**'ün çıktısıdır: bir Revit modelini (yerleşik, ücretsiz
Revit IFC export'uyla) IFC'ye dönüştürüp OpenConstructionERP'ye yükleme, bu
ortamın `bim_hub`/`takeoff` modüllerinde çalıştırma, sonucu (boş/atlanan
eleman açısından) doğrulama ve bir BOQ taslağı üretme prosedürü.

> **Bu ortamda doğrulanmadı.** Bu geliştirme ortamında ne bir Revit kurulumu
> ne de ayağa kaldırılmış bir OpenConstructionERP sunucusu var (bkz.
> `deploy/README.md` başındaki aynı not). Aşağıdaki adımlar; (a) Revit'in
> kendi belgelenmiş IFC export arayüzü hakkındaki genel, sektörde bilinen
> bilgiden ve (b) OpenConstructionERP'nin **gerçek** `MODULES.md` + kullanıcı
> kılavuzu + mimari-karar kayıtlarından (ADR) alınmıştır — hiçbir uç nokta,
> buton adı veya dosya adı **uydurulmamıştır**; kaynağı bulunamayan her
> ayrıntı açıkça "doğrulanamadı" olarak işaretlenmiştir. "Beklenen:" satırları
> canlı bir kurulumda gözlenmesi gereken sonuçtur, gözlenmiş bir sonuç
> değildir.

---

## 0. Terminoloji ve kapsam notu — "cad2data'yı kullanma" ne anlama geliyor

Görev tanımı şunu söylüyor: Revit'in **yerleşik, ücretsiz** IFC export'unu
kullanın, DDC'nin **tescilli/ücretli** `cad2data` dönüştürücüsünü (ör.
`RVT2IFCconverter.exe`) **kullanmayın** — bu araç KaplanBIM tasarım
belgesinin kısıtları tarafından yasaklanmıştır.

Fakat kaynakları tararken önemli bir bulgu çıktı, dürüstçe not edilmeli:

- OpenConstructionERP'nin kendi `MODULES.md`'si, § 6 "Core rules" madde 2'de
  **harfiyen** şunu yazıyor: *"No IfcOpenShell, no native IFC parsing - CAD
  and BIM are always converted through DDC cad2data to the canonical JSON
  format."* Bu, `cad` modülünün tanımıyla da uyuşuyor: *"imports and
  converts DWG, DGN, RVT **and IFC** through the canonical pipeline."*
- Bu kuralı doğrulayan ayrı bir mimari karar kaydı da var:
  `docs/adr/002-no-ifcopenshell-ddc-canonical-only.md` — "Use DDC `cad2data`
  canonical format as the single source of truth for ALL BIM operations."
- DDC Skills deposundaki `oce-bim-takeoff` SKILL.md bunu operasyonel olarak
  da doğruluyor: *"Conversions run in-process via the bundled DDC
  converters"* — yani ERP'nin backend'i, yüklenen **her** IFC dosyasını
  zaten kendi içinde, gömülü (bundled) bir cad2data türevi ile kanonik
  formata çeviriyor.

**Bu bir çelişki değil, iki farklı katman:**

1. **Bizim kontrolümüzdeki adım (bu belgenin § 1'i):** Revit modelinden
   `.ifc` dosyasını **biz** üretiyoruz. Burada görev tanımının yasağı
   geçerli: DDC'nin ayrı, ücretli `RVT2IFCconverter.exe` aracını (bkz. DDC
   Skills `1_DDC_Toolkit/CAD-Converters/rvt-to-ifc/SKILL.md` — bu aracın
   kendi "Problem Statement"i bile "Native Revit IFC export requires
   Autodesk license" diyerek Revit'in **kendi** export'unun ayrı,
   zaten-sahip-olunan bir Autodesk lisansıyla çalıştığını, bu DDC aracının
   ise *onun yerine* bir alternatif olduğunu doğruluyor) **çalıştırmıyoruz**.
   Bunun yerine Revit'in **File → Export → IFC** menüsünü kullanıyoruz.
2. **ERP'nin kendi kontrolündeki adım (§ 2.2):** Biz ürettiğimiz `.ifc`
   dosyasını ERP'ye yükledikten **sonra**, ERP'nin backend'i bu dosyayı
   kendi gömülü dönüştürücüsüyle kanonik formata çevirir — bu, bizim
   seçimimiz değil, ERP'nin kendi belgelenmiş mimarisi. Bunu biz
   tetiklemiyoruz, ayrıca bir lisans/ücret ödemiyoruz (gömülü), ve görev
   tanımının yasağı bunun için geçerli değil (yasak, *bizim* hangi aracı
   çalıştırdığımızla ilgili, ERP'nin kendi iç işleyişiyle ilgili değil).

Bu notu buraya koymamızın nedeni: aşağıdaki adımları izleyen biri "ERP zaten
içeride cad2data kullanıyorsa Revit'in export'una neden bu kadar dikkat
ediyoruz" diye sorabilir. Cevap: ERP'nin iç dönüştürücüsü, ancak **bizim**
verdiğimiz `.ifc` dosyasındaki veriyle çalışabilir — eksik/yanlış ihraç
edilmiş bir IFC'yi ERP'nin iç cad2data'sı da "düzeltemez", olduğu gibi
kanonikleştirir. Bu yüzden § 1'deki ihraç ayarları hâlâ kritik.

---

## Kaynaklar

**OpenConstructionERP deposu** (`datadrivenconstruction/OpenConstructionERP`,
`main`, commit `4993a21b19d9f7a308764d02ce84e36c4020d3cd` — Görev 0.2/0.3'te
de kullanılan aynı commit; 2026-11-10'da `gh api` ile tekrar çekildi, içerik
değişmemiş):
- `MODULES.md` — modül kataloğu (`boq`, `cad`, `bim_hub`, `takeoff`,
  `match_elements`, `match`, `validation`, `requirements` tanımları) ve
  § 6 "Core rules" madde 2 (cad2data zorunluluğu).
- `docs/adr/002-no-ifcopenshell-ddc-canonical-only.md` — cad2data kararının
  gerekçesi.
- `docs/BIM-STORAGE-ARCHITECTURE.md` — gerçek `bim_hub` uç noktaları
  (`POST /api/v1/bim_hub/upload-cad/`, `GET /api/v1/bim_hub/{model_id}/elements/`,
  element-group → BOQ bağlama akışı) ve `oe_bim_model.element_count` alanı.
- `docs/user-guide/quantity-takeoff.md` — takeoff iş akışı (PDF/DWG/BIM).
- `docs/user-guide/bim-to-cost-and-carbon.md` — model → maliyet (5D)
  eşleme akışı, `costs/suggest-for-element` eşleme adımı.
- `docs/user-guide/validation.md` — doğrulama hattı ("traffic-light" rapor,
  her bulgunun pozisyona/elemana bağlanması).

**DDC Skills deposu**
(`datadrivenconstruction/DDC_Skills_for_AI_Agents_in_Construction`, `main`,
commit `410ed1e71e4a5c6fd231afd0c8d1e586a9f546e8` — Görev 0.2/0.3'te de
kullanılan aynı commit; 2026-11-10'da tekrar çekildi):
- `6_OpenConstructionERP/oce-bim-takeoff/SKILL.md` — desteklenen formatlar
  tablosu (IFC dahil, "no IfcOpenShell required"), yükleme/gözat/toplu
  bağlama akışı, dürüst sınırlamalar bölümü.
- `6_OpenConstructionERP/oce-validation-engine/SKILL.md` — doğrulama kural
  paketleri, `POST /api/v1/boqs/{id}/validate/`.
- `1_DDC_Toolkit/CAD-Converters/rvt-to-ifc/SKILL.md` — **karşılaştırma
  amaçlı**: DDC'nin yasaklı, ücretli alternatifinin kendi belgesi; Revit'in
  kendi export'unun ayrı ve lisanslı olduğunu doğrulayan cümle burada.
- `1_DDC_Toolkit/BIM-Analysis/ifc-qto-extraction/SKILL.md` — Revit'in
  kendi "Schedule/Quantities" özelliğinin bağımsız referans sayım için
  kullanılabileceğine dair bağlam (bkz. § 1.5).
- `1_DDC_Toolkit/BIM-Analysis/bim-validation-report/SKILL.md` — **sadece
  bağlam için**: bu, OpenConstructionERP'nin bir parçası **değil**, DDC'nin
  bağımsız bir Python şablonu. § 3'te neden ERP'nin kendi doğrulama hattından
  (yukarıdaki `oce-validation-engine`) ayrı tutulduğu açıklanıyor.

Revit'in kendi IFC export diyaloğunun sekme/alan adları (§ 1), bu iki
depodan **değil**, genel, sektörde belgelenmiş Revit bilgisinden
alınmıştır — bu ortamda canlı bir Revit kurulumuyla doğrulanmamıştır; her
alt madde kendi güven seviyesiyle işaretlenmiştir.

---

## Ön koşullar

- § 5'teki BOQ taslağının fiyatlanabilmesi için `deploy/README.md` § 7
  (`TR_NATIONAL` maliyet tabanı) ve `deploy/blackbox/README.md`'deki firma
  BlackBox kataloğunun zaten yüklenmiş olması beklenir — bu belge onları
  tekrar üretmez, sadece onlara bağlanır.
- API çağrıları için `deploy/README.md` § 7.0'daki `oe`/`oe_api()`
  yardımcılarını ve aynı bölümdeki `curl` varlığı konusundaki açık soruyu
  (bu backend imajında doğrulanmamış) aynen miras alıyoruz — aşağıdaki
  örnekler o yardımcıyla yazılmıştır; dosya yükleme (`multipart/form-data`)
  için ek bir uyarı § 2.1'de var.

---

## 1. Revit → IFC ihracı (Adım 1)

**Menü yolu:** Revit'te modeli açın → **File → Export → IFC**. Açılan
"Export IFC" diyaloğunda "Modify Setup…" düğmesiyle ayarları düzenleyin.

### 1.1 İhraçtan önce: proje birimleri tutarlılığı

IFC kendi birimini dosyanın içinde tanımlar (`IFCUNITASSIGNMENT` /
`IFCSIUNIT`) — yani Revit'in export diyaloğunda "mm mi m mi" diye ayrı bir
seçim **yoktur**; Revit, projenin kendi birim ayarından doğru SI birimini
otomatik yazar. Dolayısıyla asıl risk, export diyaloğunda yapılan yanlış bir
seçimden çok, **modelin kendisinin** zaten yanlış/tutarsız kurulmuş
olmasıdır:

- Model içinde birden fazla disiplin/bağlantılı model (linked model)
  varsa, hepsinin **Manage → Project Units** altında aynı uzunluk/alan/hacim
  birim ayarına sahip olduğunu ihraçtan önce kontrol edin.
- Çok küçük veya çok büyük sayısal değerler (ör. bir duvar kalınlığının
  "2400" görünmesi — mm yerine cm/m karıştırılmış bir aile parametresi)
  ihraçtan önce model içinde fark edilmeli; IFC bunu "doğru" biçimde
  (olduğu gibi) dışa aktarır, hatayı düzeltmez.
- **Doğrulanmadı:** OpenConstructionERP'nin kendi cad2data tabanlı iç
  dönüştürücüsünün, IFC dosyasının kendi `IFCSIUNIT` bildirimini okuyup
  okumadığı, yoksa sabit bir birim varsayıp varsaymadığı hiçbir kaynakta
  açıkça yazmıyor. Bu, § 4'teki doğrulama adımının neden atlanmaması
  gerektiğinin gerekçesi.

### 1.2 IFC sürümü ve temel miktarlar — "General" sekmesi

- **IFC sürümü:** **IFC4** seçin (diyalogda genellikle "IFC4 Design
  Transfer View" / "IFC4 Reference View" gibi varyantlar listelenir; metraj
  için geometri ve özellik verisini en eksiksiz taşıyan varyant tercih
  edilmeli — Reference View bazı Revit sürümlerinde koordinasyon amaçlı
  daha kısıtlı veri taşır). *Hangi varyantın tam adının hangi Revit
  sürümünde göründüğü bu ortamda doğrulanmadı; canlı export'ta diyalog
  metnini kontrol edin.*
- **"Export base quantities" kutucuğunu işaretleyin.** Bu, Revit'in
  belgelenmiş, bilinen bir IFC export ayarıdır ve DDC'nin kendi (yasaklı)
  dönüştürücüsünde de aynı kavram `ExportBaseQuantities=true` olarak
  karşılığını bulur (`1_DDC_Toolkit/CAD-Converters/rvt-to-ifc/SKILL.md`),
  yani bu isim/kavramın gerçekliği iki bağımsız kaynaktan teyitli.
  **Bu kapalıysa** IFC elemanları `IfcElementQuantity` taşımaz — yani
  dosya "geçerli" görünür (açılır, elemanlar vardır) ama alan/hacim/uzunluk
  **boş** gelir. Bu, Review Focus 1'in (§ 3) yakalamaya çalıştığı sessiz
  boşluk sınıfının **Revit tarafındaki** en yaygın nedenidir.

### 1.3 Origin / koordinat seçimi — neden önemli (Review Focus 2)

Revit üç referans noktası tutar: **Internal Origin** (dosyaya gömülü, sabit,
değiştirilemez 0,0,0), **Project Base Point** (yerel, taşınabilir; şantiye
ölçümleri/kotlar için kullanılır) ve **Survey Point** (gerçek dünya/paylaşılan
koordinatlar — "Shared Coordinates"; genellikle büyük easting/northing
değerleri). IFC export, geometriyi bunlardan hangisine göre konumlandıracağını
sorar (DDC'nin kendi dönüştürücüsünde bu ayarın adı `SitePlacement`, değeri
`Shared` ya da iç/yerel seçenek — aynı kavramın Revit'in kendi export
diyaloğundaki karşılığı genellikle "Advanced" sekmesinde veya saha/paylaşılan
koordinat ayarları altındadır; *bu ortamda canlı diyalogda doğrulanmadı*).

**Neden metrajı bozar, iki ayrı mekanizma:**

1. **Doğrudan miktar bozulması değil, hassasiyet kaybı.** Tek bir elemanın
   alanı/hacmi/uzunluğu, elemanın kendi yerel geometrisinden hesaplanır ve
   normalde orijin seçiminden **bağımsızdır** (öteleme, hacmi değiştirmez).
   Fakat model gerçek coğrafi koordinatlara (Survey Point/Shared, genellikle
   yüz binler–milyonlar mertebesinde easting/northing) göre ihraç edilirse,
   kayan noktalı (floating-point) hassasiyet kaybı nedeniyle ince
   elemanların (ör. ince bir döşeme/duvar katmanı) üçgenlenmiş geometrisinde
   gözle görülür bozulmalar ("far-from-origin" sorunu olarak BIM/IFC
   koordinasyon pratiğinde genel olarak bilinir) ve bunun sonucunda hacim
   hesaplarında küçük ama tutarsız sapmalar oluşabilir. *Bu, OpenConstructionERP'ye
   özgü değil, genel bir BIM/geometri motoru davranışıdır — ERP'nin kendi
   cad2data tabanlı dönüştürücüsünün bu duruma özel bir toleransı olup
   olmadığı hiçbir kaynakta belgelenmemiş, doğrulanmadı.*
2. **Federasyon/kat (storey) tutarsızlığı.** Aynı projenin farklı
   disiplinlerinden (mimari/statik/mekanik) ayrı ayrı ihraç edilen IFC
   dosyaları **farklı** orijin seçimleriyle (biri Internal Origin, diğeri
   Survey Point) dışa aktarılırsa, ERP'de üst üste bindirildiklerinde
   (federasyon) elemanlar doğru kat/bölgeye düşmeyebilir — bu da kat bazlı
   gruplanmış metraj özetlerini (§ 2.3'teki "level/storey'e göre gruplama")
   dolaylı olarak yanlışlar, tekil eleman miktarını değil.

**Pratik kural:** Tek-model, tek-disiplinli bir metraj taslağı için
**Internal Origin / Project Base Point** (küçük, yerel sayılar) tercih
edin — hassasiyet kaybı riskini en aza indirir. Çok disiplinli bir
federasyon ve saha/civil koordinasyonu planlanıyorsa **Survey Point /
Shared Coordinates** kullanın, ama **tüm disiplinlerin aynı seçimi**
yaptığından emin olun.

### 1.4 Kategori ve faz filtreleri — neden önemli

- **Faz (Phase):** Export diyaloğunda hangi fazın (ör. "New Construction")
  ihraç edileceğini seçin. Yanlış faz seçimi iki yönlü hata üretir: mevcut
  olmayan bir eski/yıkılacak eleman IFC'ye girip metrajı şişirir, **ya da**
  yeni inşa edilecek kapsam dışarıda kalıp metraj eksik çıkar — her iki
  durumda da dosya "geçerli" görünür, hata vermez.
- **Kategori filtresi:** Revit'in görünürlük/grafik geçersiz kılmaları
  (View → Visibility/Graphics) veya bir görünüm filtresiyle istenmeyen
  kategorileri (ör. Mobilya, Genel Modeller, Açıklama elemanları) gizleyip
  "Current view only" seçeneğiyle o görünümü ihraç etmek, pratikte en
  güvenilir kategori kısıtlama yoludur. Diyalog içinde ayrıca kategori
  bazlı bir dışlama/ eşleme aracı olabilir; *bu diyalog öğesinin tam adı ve
  Revit sürümüne göre konumu bu ortamda doğrulanmadı.*
- **Neden kritik:** yanlışlıkla dışlanan bir kategori (ör. taşıyıcı sistem),
  IFC'den **tamamen** kaybolur — dosya küçük bir hatayla değil, sessizce
  eksik üretilir. Bu da Review Focus 1'in yakalaması gereken ikinci büyük
  sınıftır (Revit tarafı): eleman sayısı değil, **bütün bir kategori**
  yok.

### 1.5 İhraçtan sonra: bağımsız referans sayım (Review Focus 1'in hazırlığı)

İhraç ettiğiniz `.ifc`'yi ERP'ye yüklemeden önce, Revit'in kendi (ücretsiz,
yerleşik) **View → Schedules → Schedule/Quantities** özelliğiyle, ihraç
ettiğiniz kapsam için birkaç referans sayı çıkarın — ör. "Kapı sayısı",
"Duvar toplam alanı", "Döşeme toplam hacmi". Bunlar § 3'te ERP'nin
döndürdüğü sayılarla karşılaştırılacak **bağımsız** bir taban çizgisi
olacak. (DDC Skills'teki `ifc-qto-extraction` SKILL.md, Revit'in kendi
Schedule özelliğinin aynı amaçla DDC'nin `RvtExporter.exe …schedule`
seçeneğiyle de dışa aktarılabileceğini belgeliyor — ama o araç da aynı
ücretli DDC ailesinden olduğu için burada **kullanılmıyor**; sadece
Revit'in kendi, zaten ücretsiz Schedule özelliğini kullanın.)

---

## 2. IFC'yi ERP'ye yükle ve takeoff çalıştır (Adım 2)

### 2.1 Yükleme

`MODULES.md` modül tanımı: **BIM Hub** `bim_hub` — *"model and element
store with BOQ linking, quantity maps and model diffs."* Gerçek, somut uç
nokta `docs/BIM-STORAGE-ARCHITECTURE.md`'de örneklenmiş:

```
POST /api/v1/bim_hub/upload-cad/   (multipart/form-data)
```

DDC Skills'teki `oce-bim-takeoff` SKILL.md desteklenen formatlar tablosunda
IFC'yi açıkça listeler — *"IFC | upload (no IfcOpenShell required) |
JSON/GLB"* — yani yüklenen IFC, ERP'nin backend'inde IfcOpenShell **değil**,
§ 0'da açıklanan gömülü cad2data türevi ile işlenir.

> **Doğrulanmadı — multipart yükleme aracı.** `deploy/blackbox/README.md`
> § 1'de ve `deploy/README.md` § 7.0'da zaten işaretlenen aynı açık soru
> burada da geçerli: `backend` imajında `curl` olup olmadığı
> doğrulanmamış (healthcheck kasıtlı olarak `python3 -c "import
> urllib.request…"` kullanıyor). Çıplak `urllib`/`email.mime.multipart` ile
> büyük bir ikili dosyayı (`.ifc`, genellikle onlarca-yüzlerce MB) elle
> multipart kodlamak hataya açık; canlı ortamda önce `backend` imajında
> `curl` veya `httpie` olup olmadığını kontrol edin, yoksa host'ta
> `caddy`/`frontend` üzerinden (DOMAIN doğrulandıktan sonra) tarayıcıdan
> yüklemeyi tercih edin — bu, ERP'nin kendi web arayüzünün zaten desteklediği
> yoldur ve script yazmaya gerek bırakmaz.

**Beklenen:** yükleme isteği bir `model_id` döner; model başlangıçta
`status="processing"` olur.

### 2.2 Dönüşüm (ERP'nin iç cad2data hattı)

`docs/BIM-STORAGE-ARCHITECTURE.md`'nin belgelediği yazma yolu:

```
Background → Convert RVT/IFC → canonical → COLLADA + parquet
             BULK INSERT oe_bim_element (...)
             UPDATE oe_bim_model SET status="ready", element_count=N
```

Bu adım tamamen ERP tarafında, arka planda çalışır (§ 0'da açıklanan gömülü
cad2data). Operatör olarak sizin yapacağınız tek şey, `model_id` üzerinden
`status`'un `"processing"`'den `"ready"`'e geçtiğini ve `element_count`'un
**sıfırdan büyük** olduğunu görmek — bu, § 3'ün ilk ve en kaba kontrolüdür.

**Beklenen:** `status="ready"`, `element_count` Revit'in kendi Schedule
sayımına (§ 1.5) yakın bir değer.

### 2.3 Takeoff: eleman gözden geçirme ve BOQ'a bağlama

`MODULES.md`: **Quantity Takeoff** `takeoff` — *"manual and assisted
quantity takeoff from drawings and models."* `docs/user-guide/quantity-takeoff.md`'nin
BIM için yazdığı akış: model için ölçüm yapmazsınız, miktarlar zaten
geometride vardır (*"For a model, the quantities are already in the
geometry"*) — yapılacak olan:

1. Elemanları kategori/tip/kat/aile gibi bir boyuta göre gruplayın (BOQ
   yapınızla eşleşsin diye).
2. "Quantity picker" ile bağlı elemanlardan alan/hacim/uzunluk alıp bir BOQ
   pozisyonuna gönderin; aynı işi temsil eden birçok elemanı tek bir BOQ
   satırına bağlayabilirsiniz.

`docs/BIM-STORAGE-ARCHITECTURE.md`'de somutlaşan toplu bağlama uç noktası
(§ "Group → BOQ link"):

```
POST /api/v1/bim_hub/element-groups/{group_id}/link-to-boq/
  body: { "boq_position_id": "..." }
```

**Beklenen:** her bağlı eleman için `oe_bim_boq_link` kaydı oluşur; BOQ
pozisyonunun miktarı, bağlı elemanların toplamı kadar artar.

### 2.4 Eleman → maliyet eşleme

`MODULES.md`: **CAD-BIM Match to Cost** `match_elements` — *"maps model and
drawing elements to cost positions and loads scaled resources into the
BOQ."* ve **Element Match** `match` — *"returns ranked cost-position
candidates for a BIM, PDF, DWG or photo element."* `oce-bim-takeoff`
SKILL.md'nin belgelediği somut uç nokta:

```
POST /api/v1/costs/suggest-for-element
```

Bu, bir BIM elemanı için (tip, malzeme, boyut, sınıflandırma) sıralanmış
maliyet kalemi adayları döndürür; her aday bir güven/kesinlik rozetiyle
gelir. `docs/user-guide/bim-to-cost-and-carbon.md`'nin dediği gibi, düşük
kesinlikli eşleşmeleri **onaylamadan önce gözden geçirin** — bu, ERP'nin
"öneri her zaman bir kişi tarafından onaylanır" ilkesinin (`MODULES.md` § 6
madde 4) burada somutlaştığı yerdir.

---

## 3. Boş/atlanan eleman raporunu doğrula (Review Focus 1)

Görev tanımındaki `report.json`/`summary.json` ifadesi **bu projenin kendi
varsayımıydı** — ne OpenConstructionERP'nin ne de DDC Skills'in fetch
edilen hiçbir kaynağında bu birebir dosya adıyla bir rapor **bulunamadı**.
Bu, dürüstçe açık bir boşluk: aşağıdakiler, aynı amaca hizmet eden,
**gerçekten belgelenmiş** eşdeğerler.

### 3.1 Kaba kontrol: `element_count`

§ 2.2'de görüldüğü gibi `oe_bim_model.element_count` alanı, dönüşümden
sonra doldurulur. Bu sayı:
- **Sıfırsa** → model "ready" olsa bile hiçbir eleman çıkarılmamış demektir
  (örn. § 1.2'deki "Export base quantities" kapalı kalmış veya IFC boş
  gelmiş olabilir). Bu, **en sessiz** başarısızlık türüdür: ne hata, ne
  uyarı — sadece boş bir model.
- **Revit'in Schedule sayımına (§ 1.5) göre çok düşükse** → bir kategori
  ihraçta sessizce dışlanmış olabilir (§ 1.4).

### 3.2 Asıl doğrulama katmanı: `validation` modülü

`MODULES.md`: **Validation Engine** `validation` — *"data-quality
validation with configurable rule sets."* `docs/user-guide/validation.md`'nin
açıkladığı gibi doğrulama, CAD/BIM dönüşümünden geldiğinde **otomatik**
çalışır (*"It runs when data comes in from a CAD or BIM conversion"*) ve
denetlediği şeyler arasında açıkça şunlar var: *"checks on converted BIM
and CAD data such as required properties and geometry validity"*. İsteğe
bağlı olarak elle de tetiklenebilir (`oce-validation-engine` SKILL.md):

```
POST /api/v1/boqs/{id}/validate/
```

**Sağlıklı bir rapor neye benzer:** `docs/user-guide/validation.md`'nin
tarif ettiği "trafik ışığı" biçiminde — genel bir kalite skoru (0–100),
geçti/uyarı/hata olarak gruplanmış bulgular, ve **her bulgu** ilgili BOQ
pozisyonuna ya da model elemanına bağlı (*"every individual finding links
to the exact BOQ position, drawing region or model element it refers
to"*). Yani "sağlıklı" demek rapor **boş** demek değil — sıfır **hata**
(error) demek; uyarılar (warning) olabilir ama her biri hangi elemana ait
olduğu belli, isimlendirilmiş bir bulgu olmalı. Hiçbir bulgu olmadan ama
`element_count`'un beklenenin çok altında olduğu bir durum (§ 3.1) —
yani "rapor temiz ama sayı az" — **kendi başına bir uyarı işaretidir**: bu,
doğrulama kurallarının o eksikliği yakalayacak bir kural içermediği
anlamına gelir, modelin eksiksiz olduğu anlamına gelmez.

### 3.3 Kapsam dışı / doğrulanamayan

- `requirements` modülü (`MODULES.md`: *"extract, validate and track
  construction requirements"*) bir modelin beklenen tüm kategorileri
  içerip içermediğini "eksiksizlik" kapısı olarak doğrulayabilecek bir
  modül gibi görünüyor, ama fetch edilen kaynaklarda bunun için somut bir
  API/UI adımı **bulunamadı** — `deploy/blackbox/README.md`'nin
  `waste_factors`/`norm_expansion` için yaptığı aynı dürüst açıklama
  burada da geçerli: modül adı gerçek, prosedür belgelenmemiş.
- DDC Skills'teki `bim-validation-report` SKILL.md (bağımsız bir Python
  şablonu, `ValidationReport`/`ValidationIssue` veri sınıflarıyla) bu
  görevin aradığı "atlanan eleman listesi" kavramına çok yakın duruyor,
  ama bu **OpenConstructionERP'nin bir parçası olduğu doğrulanmamış** —
  sadece aynı DDC ekosisteminde ayrı, bağımsız bir araç şablonu. Bu belge
  onu bir ERP adımı gibi sunmuyor, sadece kavramsal bir referans olarak
  anıyor.

---

## 4. Birim/origin tutarlılığını doğrula (Review Focus 2)

Somut, uygulanabilir kontrol sırası:

1. **İhraç öncesi kaydet:** § 1.3'te hangi orijini (Internal/Survey) ve
   hangi "Site Placement" değerini seçtiğinizi not edin — bu, sorun
   çıkarsa geri izlenebilirlik için gerekli.
2. **Görsel ölçek kontrolü:** model ERP'nin 3B görüntüleyicisinde
   (`bim_hub`) açıldığında, bilinen boyutlu bir eleman (ör. standart bir
   kapı, ~0,9 m genişlik) görsel olarak makul mü? 1000 kat küçük/büyük
   görünen bir model, birim hatasının en basit, gözle görülür işaretidir.
3. **Sayısal çapraz kontrol:** ERP'nin eleman tarayıcısında tek bir
   elemanın (ör. bir duvarın) alan/hacim değerini açın; **aynı** elemanın
   Revit'teki Özellikler paletinde veya § 1.5'te çıkardığınız Schedule'daki
   değeriyle karşılaştırın. Sapma 1000× veya 1.000.000× mertebesindeyse
   (mm↔m veya mm³↔m³ karışıklığının klasik imzası) birim hatası kesinleşmiş
   demektir.
4. **Konum/federasyon kontrolü (çok disiplinli projelerde):** birden fazla
   model federe ediliyorsa, hepsinin aynı görünür konumda (üst üste, aynı
   kat hizasında) oturduğunu 3B görüntüleyicide doğrulayın — § 1.3 madde
   2'de açıklanan orijin tutarsızlığının gözle görülür belirtisi budur.

**Herhangi biri başarısız olursa:** o modeldeki **hiçbir** miktara
güvenmeyin; § 5'e geçmeyin. Kök nedeni (yanlış export ayarı mı, ERP'nin
birim varsayımı mı — bu ikincisi § 1.1'de "doğrulanmadı" olarak
işaretlendi) bulup modeli yeniden ihraç edip yeniden yükleyin.

**Beklenen (canlı ortamda):** adım 2 ve 3'teki sayılar birbirine (küçük
yuvarlama farkları dışında) eşit; adım 4'teki modeller görsel olarak hizalı.

---

## 5. BOQ taslağını üret ve doğrula

1. § 2.3–2.4'te bağlanan ve eşleşen miktarlar, zaten BOQ (`boq` modülü,
   `MODULES.md`: *"core hierarchical BOQ editor with positions, quantities
   and cost roll-up"*) içinde pozisyon olarak durur.
2. Fiyat kaynağı **`deploy/README.md` § 7**'deki `TR_NATIONAL` CWICR
   tabanından ve/veya **`deploy/blackbox/README.md`**'deki firma
   kataloğundan gelir — bu görev o ikisini tekrar üretmez, sadece
   `match_elements`/`costs/suggest-for-element` ile seçilen eşleşmelerin
   hangi kaynaktan fiyatlandığını teyit eder (eşleşme sonucunda dönen
   maliyet kaleminin `region`/`catalog` alanına bakın).
3. Taslak tamamlandığında, fiyatlı haliyle **§ 3.2'deki doğrulamayı tekrar
   çalıştırın** (`POST /api/v1/boqs/{id}/validate/`) — bu kez `oce-validation-engine`
   SKILL.md'nin listelediği mutabakat kuralları da devreye girer (ör.
   `qty × unit_price = cost`, `Σ bileşenler = toplam kaynak maliyeti`).
   Hatasız ve her uyarısı izlenebilir bir rapor, taslağın TR rayiçle
   fiyatlanabilir duruma geldiğinin kanıtıdır.

**Beklenen (canlı ortamda):** örnek projede BOQ ekranı açılır, her
pozisyonun miktarı modelden gelen bir eleman grubuna bağlı görünür, birim
fiyat `TRY` cinsindendir ve doğrulama raporu hatasız/izlenebilir.

---

## 6. Commit

```bash
git add deploy/erp/import-check.md
git commit -m "docs: IFC import checklist for takeoff"
```

---

## Kapsam dışı / açık sorular (dürüstçe listelenmiş)

1. **Revit export diyaloğunun tam sekme/alan adları** (§ 1.2–1.4) genel,
   sektörde bilinen Revit bilgisinden yazıldı; bu ortamda canlı bir Revit
   kurulumuyla doğrulanmadı. Revit sürümleri arasında diyalog metni
   değişebilir.
2. **ERP'nin iç cad2data dönüştürücüsünün `IFCSIUNIT`'i okuyup okumadığı**
   (§ 1.1, § 4) hiçbir kaynakta açıkça yazmıyor — bu yüzden § 4'teki
   sayısal çapraz kontrol atlanabilir bir adım değil, zorunlu.
3. **`report.json`/`summary.json` adıyla literal bir dosya** bulunamadı
   (§ 3) — görev tanımının bu ismi kendi varsayımıydı; gerçek eşdeğer
   `element_count` + `validation` modülünün trafik-ışığı raporudur.
4. **`requirements` modülünün "eksiksizlik" doğrulaması için somut bir
   API/UI adımı yok** (§ 3.3) — sadece modül tanımı var.
5. **`multipart/form-data` yükleme için `backend` imajında `curl` olup
   olmadığı** (§ 2.1) hâlâ doğrulanmadı — `deploy/blackbox/README.md` ve
   `deploy/README.md`'deki aynı açık sorunun üçüncü tekrarı; bir sonraki
   görevde (API köprüsü) bu soruyu kapatmak faydalı olur.
6. Bu belgenin hiçbir adımı, gerçek bir Revit modeli + gerçek bir
   OpenConstructionERP sunucusuyla uçtan uca **çalıştırılmadı**. Canlı
   doğrulama, bu checklist'in kendisinin kabul kriteridir.
