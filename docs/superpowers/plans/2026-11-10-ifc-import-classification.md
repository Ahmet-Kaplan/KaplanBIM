# IFC Import Sınıflandırma Katmanı — Implementation Planı

- **Tarih:** 2026-11-10
- **Dayanak:** `docs/decisions/2026-11-10-pascal-editor-assessment.md` §6
- **Amaç:** Revit → IFC → keşif yolundaki zayıf halkayı kapatmak. Bugün kapalı CAD/BIM dosyalarından gelen veri **sınıflandırılmamış mesh**; hiçbir metraj onu fiyatlayamıyor.

---

## Mevcut durum (ölçüldü, tahmin değil)

`readIfcSource` (`packages/bim-ifc/src/import/read-products.ts:119`) el yazımı bir STEP okuyucu. Her yerleşimi olan varlık nötr bir `ImportProduct`'a dönüşüyor (`packages/bim-kernel/src/import/types.ts:56-89`) — "ne olacağına asla karar vermez". Dönüşüm ikinci, ayrı bir adım: `planIfcImport` (`bim-kernel/src/import/plan.ts:57`) sınıf kaydındaki `ifc` ipucuna bakıp on kuraldan birini çalıştırıyor (`import/rules.ts`): wall, slab, room, column, beam, opening, run_segment, part, component, ceiling (sonuncusu adım 4 ile eklendi).

**Gerçek örnek modelde sonuç** — `sample-models/IfcOpenHouse_IFC4.ifc`, ilk-parti pack'lerle:
**34 ürün → 3 kayıt** (2 duvar, 1 temel).
- 2 duvar "şekli başka bir şekille kesilmiş" diye düşüyor (`geometry.ts:178-182`)
- kapı düşüyor ("içinde olduğu duvar bağlı modelde kalıyor")
- 20 `IfcMember` + 5 `IfcPlate` + 1 `IfcStairFlight` düşüyor ("bu modelde onu alacak sınıf yok")

Yani sorun **sınıflandırma değil, önce duvarın hiç oluşmaması.**

---

## Sıralı boşluk listesi (takeoff değeri / efor)

| # | Adım | Ne açıyor | Efor | Risk |
|---|------|-----------|------|------|
| **1** | **Boolean-kesilmiş gövde "okunamaz" sayılmasın** — `geometry.ts:178-182` taban katıya zaten iniyor ve temiz bir ekstrüzyon buluyor; `shape.ts:29-31` `unread` yüzünden onu atıyor. Vetoyu **uyarıya** çevir. | Kesilen/eklenen duvarlar ve arkalarındaki kapı-pencere dönüşür. Örnekte duvarlar **2→4**, kapı açılır. | **2-4 saat** | Kesilmiş katı sessizce eksik ölçülebilir → `unread`'i **raporda uyarı** olarak tut, `verticalPrism`/`straightSweep` reddi için değil |
| **2** | **`IfcRelDefinesByType` → `element_type` kayıtları** — ilişki zaten okunuyor (`read-products.ts:159`), sadece kullanılmıyor | Metrajda Revit tipi başına satır ("WD-01 200mm tuğla"), tip başına birim ağırlık, disiplin-doğru gruplama. Bugün her duvar tek "Walls" satırına çöküyor | **1 gün** | Tip parametre eşlemesinde birim kontrolü gerekir |
| **3** | **`IfcMaterialLayerSetUsage` → katman listesi** (kalınlık, malzeme, sıra, offset). Bugün yalnızca *ilk katmanın adı* alınıyor (`read-products.ts:183-187,312-331`) | **Asıl para kalemi:** yüz başına sıva/boya/yalıtım m²'si, duvar hacmi yerine | **2-3 gün** | Kernel'de "montaj/katman" kavramı yok; Revit katman adları firma sözlüğü → ad→maliyet kodu haritası gerekir |
| **4** | **Tavan/döşeme kaplama kuralı** — `arch.ceiling` sınıfı var, `measure.ts:137` tavanı zaten ölçüyor, `rules.ts:345`'te kural yok | Asma tavan ve şap/bitiş m²'si | **1-2 gün** | Düşük; kaplamalar basit ekstrüzyon |
| **5** | **`IfcSpace` kalitesi** — tohum (polylabel), kat/tavan yüksekliği, `LongName` (zaten okunuyor) | Odalar miktar kabı olarak kullanılabilir (`BOUNDARY_MEASURES` mevcut, `measure.ts:168`) | **1 gün** | Oda vs duvar-halkası uyumsuzluğu: Revit bitiş yüzüne ölçer, çekirdek yüze çizer → alanlar %2-5 kayar |
| **6** | **Duvar parça birleştirme + L/T birleşimleri** (Pascal'ın `wall-joins.ts` mantığı) | Doğru oda kapanışı, birleşimsiz uzunluklar. Bugün hata birleşim başına ~kalınlık (toplam %2-4) | **3-5 gün** | **Toleranslar ABD konut ölçeğinde**: 1.25 m boşluk ve 0.35 m ayırıcı boşluğu Türk ticari modelde **duvar uydurur**. 0.15-0.3 m'ye çek |
| **7** | **`IfcRelAssociatesClassification` → `classification[]`** (Uniclass/OmniClass/DIN276 metin olarak) | ERP zaten kendi eşlemesini yapıyor; kod listeleri/firma haritası olmadan değeri düşük | **½ gün** okumak | Kod listeleri gerekir |
| **8** | **Giydirme cephe (`IfcPlate`/`IfcMember`) sınıfları** — örnekte 34 ürünün 25'i | Cephe m²'si ve mullion uzunluğu | **1-2 gün** | Ürün sayısı yüksek, birim başına kesinlik düşük |

---

## Pascal'dan alınacak mantık — uyarılarla

| Sezgi | Genelleşir mi |
|-------|---------------|
| Duvar parça birleştirme | **Hayır.** 1.25 m boşluk toleransı konut çerçeveleme toleransı; Türk ticari modelde gerçek boşlukları duvarla kapatır. **0.15-0.3 m'ye çek.** |
| L/T birleşimleri (duvar ucu komşu merkez çizgisine kayar) | Çoğunlukla evet. 0.6 m tavan ve 3 cm gövde payı güvenli, ama yoğun MEP/strüktür modellerde daha çok yanlış uç-yan eşleşmesi üretir |
| Gereksiz kaplama temizliği (≤35 mm duvarlar) | Evet, ama Revit kaplamayı duvar olarak ihraç etmiyorsa gereksiz |
| Çapraz kesişim bölme | Evet |
| `IfcSpace` → oda (polylabel tohumu + duvar halkası benimseme) | Algoritma evet; Revit bitiş yüzü ölçtüğü için alanlar %2-5 kayar → gerçek projeyle doğrula |
| Döşeme üstü = yürüme yüzeyi (2 cm tolerans) | Evet, metrik. **Kernel'de `Slab` için elevation alanı yok** — önce o gerekir |
| `IfcDoor.OperationType` → kapı ailesi | Enum dil-nötr (iyi); **kelime dağarcığı konut** (`garage-rollup`, `french`) → eşleme tablosu gerekir, ama bu **veri**, mantık değil |
| `Pset_DoorCommon.GlazingAreaFraction` → camlama | **Zayıf:** Revit bu özelliği yalnızca aile tanımlıyorsa ihraç eder; Türk kapı ailelerinin çoğu tanımlamaz. **Bonus, asla birincil kaynak değil** |

---

## İlk adım (ve neden o)

**1. madde: boolean-kesilmiş gövdeyi "okunamaz" saymayı bırak.**

Sebep: aşağıdaki hiçbir şey, duvar kaydı ortaya çıkmadıkça işe yaramaz. Sınıflandırma, katmanlar, tipler ve birleşimler — hepsi bugün var olmayan bir duvar kaydına tutunur. Bir dosya çiftinde saatlik iş, ve regresyon testi zaten var: `packages/bim-ifc/__tests__/i9-convert-sample.test.ts`.

**Kabul kriteri:** aynı örnek modelde dönüşen duvar sayısı 2 → 4, kapı dönüşür, `unread` raporda uyarı olarak kalır, testler yeşil.

---

## Entegrasyon dikişleri

İki temiz dikiş, ikisi de mevcut nötr IR'de — **yeni bir IR katmanı gerekmiyor**:

1. **Okuma tarafı:** `read-products.ts:281-305` ürün literaline `layers[]`, `classification[]`, `operationType`, `typeProperties`, `portConnectors` ekle.
2. **Plan tarafı:** `plan.ts:57 planInScope` içinde, `map.choose(product)` (`plan.ts:144`) hemen öncesinde; ve `rules.ts:33-41` `base()` içinde `classification` + gerçek `element_type` damgala.

---

## Ölçüm

- Örnek modelde dönüşen ürün sayısı (bugün 3/34)
- Dönüşen duvar sayısı ve kesilen/kesilmeyen ayrımı
- Metraj satır sayısı ve tip başına gruplama (bugün tek "Walls" satırı)
- Katman varsa yüz başına m² üretimi
- `packages/bim-ifc` testleri yeşil; `import-layers` yeşil (kernel'e i18n/React girmez)
