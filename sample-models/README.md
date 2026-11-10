# Örnek IFC bina modeli — kalibrasyon girdisi

Bu dizin, KaplanBIM entegrasyonunun **Faz 0/1** akışındaki (Revit → IFC →
OpenConstructionERP takeoff → BOQ/tahmin) "örnek model" adımı için indirilen,
**gerçek ve serbestçe yeniden dağıtılabilir** bir örnek IFC bina modelini
barındırır. Bu ortamda Revit kurulumu ve tescilli `cad2data` dönüştürücüsü
yoktur (bkz. `deploy/erp/import-check.md` § 0), bu yüzden örnek model **doğrudan
IFC** olarak — ERP'nin zaten tükettiği, firmanın Revit'inin de üreteceği açık
formatla — indirilmiştir.

## Ne var içeride

İki dosya var; ikisi de aynı ev modelinin (IfcOpenHouse) iki IFC şema
sürümündeki ihracıdır:

| Dosya | IFC şeması | Boyut (bayt) | SHA-256 |
|---|---|---|---|
| `IfcOpenHouse_IFC4.ifc` | `IFC4` | 113 264 | `71c9466bf02306be58d45b77d738541a0e7410767960b5eed1cf85737dfa34c9` |
| `IfcOpenHouse_IFC2x3.ifc` | `IFC2X3` | 112 756 | `b2161637998528eb6ae07169ca0d384dc7c521bff1e22c35aedcb019c5a1d489` |

> **Birincil model `IfcOpenHouse_IFC4.ifc`'dir** — `deploy/erp/import-check.md`
> § 1.2, metraj (takeoff) için IFC4 ihracını önerir. `IFC2x3` dosyası, sahada
> hâlâ yaygın olan eski şema ihraçlarıyla (eski Revit sürümleri) karşılaştırma
> yapabilmek için yanında tutulur.

## Model nedir

**IfcOpenHouse**, Thomas Krijnen (`aothms`) tarafından, IfcOpenShell kitaplığı
kullanılarak **tamamen kodla üretilmiş** tek katlı küçük bir ev modelidir
(2012'de `blog.ifcopenshell.org`'da tanıtılmıştır). Gerçek bir projeden alınma
değildir; IFC dosyalarını test etmek için özel olarak üretilmiş, küçük ama
yapısal olarak eksiksiz bir örnektir.

İçerik (iki dosyada da aynıdır, `grep` ile doğrulanmıştır):

- 2885 IFC varlık satırı; mekânsal hiyerarşi eksiksiz:
  `IFCPROJECT → IFCSITE → IFCBUILDING → IFCBUILDINGSTOREY` (her biri 1 adet).
- 4 duvar (`IFCWALLSTANDARDCASE`), 2 döşeme (`IFCSLAB`), 1 kapı (`IFCDOOR`),
  5 pencere (`IFCWINDOW`), 1 çatı (`IFCROOF`), 20 taşıyıcı çubuk/eleman
  (`IFCMEMBER`).
- 39 ürün şekil tanımı (`IFCPRODUCTDEFINITIONSHAPE`), 47 şekil temsili
  (`IFCSHAPEREPRESENTATION`), 512 kartezyen nokta (`IFCCARTESIANPOINT`),
  1 malzeme ilişkilendirmesi, 13 mekâna yerleştirme
  (`IFCRELCONTAINEDINSPATIALSTRUCTURE`), 4 boşluk (`IFCRELVOIDSELEMENT`) ve
  1 boşluk doldurma (`IFCRELFILLSELEMENT`).
- Uzunluk birimi `IFCSIUNIT(.LENGTHUNIT., .MILLI., .METRE.)` — yani milimetre.

## Kaynak ve lisans (provenans)

- **Kaynak URL:** https://github.com/aothms/IfcOpenHouse (`master` dalı)
  — dosyalar `raw.githubusercontent.com/aothms/IfcOpenHouse/master/` adresinden
  indirildi.
- **Lisans:** **CC0-1.0** (Creative Commons "Public Domain Dedication" 1.0
  Universal). Deponun kendi `LICENSE` dosyası CC0-1.0 tam metnidir — yani model
  kamu malı ilan edilmiştir; ticari kullanım, değiştirme ve yeniden dağıtım
  dahil her türlü kullanım serbesttir ve atıf dahi zorunlu değildir (atıf yine
  de iyi pratik olarak yukarıda verilmiştir).
  > Not: Görev talimatında IfcOpenHouse için "CC BY 4.0" deniyordu; deponun
  > **gerçek** lisans dosyası kontrol edildiğinde CC0-1.0 olduğu görüldü —
  > bu, CC BY'den daha permissive bir lisanstır. Burada gerçek lisans
  > kaydedilmiştir, uydurulmuş değildir.
- **İndirme tarihi:** 2026-11-10.
- **Doğrulama:** Dosyaların gerçekten IFC olduğu STEP başlığından
  (`ISO-10303-21; HEADER; FILE_SCHEMA(('IFC4'))` / `('IFC2X3')`) ve yukarıdaki
  varlık sayımlarından teyit edildi. İndirilen boyut, GitHub'daki kayıtlı boyut
  ile birebir aynıdır (112 756 / 113 264 bayt).

## Nasıl kullanılır — Görev 1.3 kalibrasyonuna girdi olarak

Bu model, `deploy/blackbox/calibration.md` § 4'teki (Görev 1.3'te
doldurulacak) sapma kaydının **somut, gerçek bir IFC girdisini** sağlar:

1. **İçe aktarma adımları:** `deploy/erp/import-check.md` § 2'deki akışı
   izleyin — modeli ERP'ye `POST /api/v1/bim_hub/upload-cad/` ile yükleyin,
   `bim_hub`/`takeoff` modüllerinde metraj çıkarın, elemanları BOQ kalemlerine
   bağlayın. Adım adım prosedür ve beklenen sonuçlar o belgededir; burada
   tekrarlanmaz.
2. **Kalibrasyon kaydı:** Metrajdan çıkan kalemler için
   `deploy/blackbox/calibration.md` § 4.1'deki tabloyu doldurun — otomatik
   öneri (`ai` / `cost_match`) ile insan kararı arasındaki sapmayı her kalem
   için kaydedin.
3. **İki şema sürümüyle çapraz kontrol:** `IFC4` (birincil) ve `IFC2X3`
   dosyalarını ayrı ayrı yükleyip aynı kalibrasyon tablosunda iki satır bloğu
   tutarak, ERP'nin iç dönüştürücüsünün şema sürümüne göre davranış farkını
   da gözlemleyebilirsiniz.

## Dürüst sınırlamalar

- **Bu ortamda ERP'ye içe aktarılıp doğrulanmadı.** Bu geliştirme ortamında
  ayağa kaldırılmış bir OpenConstructionERP sunucusu yoktur; yukarıdaki
  kullanım adımları, `deploy/erp/import-check.md` ve
  `deploy/blackbox/calibration.md`'deki belgelenmiş akışa bağlanır, canlı
  olarak çalıştırılıp sonucu gözlemlenmiş **değildir**. "İçe aktarıldı,
  şu kadar eleman çıktı" gibi bir iddia bu belgede yoktur.
- **Temel miktarlar (base quantities) yok.** Bu modelde
  `IFCELEMENTQUANTITY` / `IFCQUANTITYLENGTH` / `IFCQUANTITYAREA` /
  `IFCQUANTITYVOLUME` ve özellik seti (`IFCPROPERTYSET`) **bulunmaz** —
  yalnızca geometri taşır. `deploy/erp/import-check.md` § 1.2'de vurgulanan
  "Export base quantities kapalıysa elemanlar alan/hacim boş gelir" riskini
  (Review Focus 1, "sessiz boşluk") tam da bu örnekle test edebilirsiniz:
  firmanın gerçek Revit ihracı bu kutucuk işaretli olmalıdır, örnek model
  bilerek işaretsizdir.
- **Firma akışında bu modelin yeri:** Gerçek iş akışında bu örnek, firmanın
  kendi Revit'inden ihraç ettiği IFC ile **değiştirilir** — IfcOpenHouse
  yalnızca kalibrasyon prosedürünü uçtan uca yürütebilmek için bir vekildir,
  firma verisi değildir.
