# Firma QTO kural setleri ve `match-elements` 7 aşamalı eşleme

Bu belge, KaplanBIM inşaat platformu entegrasyonunun **Faz 1 / Görev 1.1**
çıktısıdır: OpenConstructionERP'de disiplin/aile/tip başına firma QTO
("quantity takeoff" — metraj) kural setlerinin nasıl tanımlandığını,
`match-elements` modülünün görünür **yedi aşamalı** eşleme hattının nasıl
çalıştırıldığını ve sonuç eşleme oranının nasıl okunacağını anlatır.

> **Bu ortamda doğrulanmadı.** Bu runbook, bir OpenConstructionERP sunucusu
> fiilen ayağa kaldırılmadan — yalnızca gerçek DDC Skills belgelerinden ve
> OpenConstructionERP'nin **kendi backend kaynak kodundan** (bkz. § Kaynaklar)
> derlenerek yazıldı. Aşağıdaki API çağrıları bu depoda çalıştırılıp
> yanıtları gözlemlenmemiştir. "Beklenen" satırları, gerçek bir sunucuda
> bunu doğrulayacak kişi için bir kabul kriteri listesidir.

---

## 0. Önemli bir dürüstlük notu — görev talimatı ile gerçek depo arasındaki fark

Görev talimatı, DDC Skills deposunun `6_OpenConstructionERP` kategorisinde
"BIM & CAD Takeoff" ve **`match-elements`/`element-match`** adıyla ayrı
skill'ler fetch edilmesini bekliyordu. Depo fiilen tarandığında
(`gh api .../contents/6_OpenConstructionERP`, pinlenen commit aşağıda):

- `oce-bim-takeoff/SKILL.md` **vardır** ve "Matching elements to cost
  items" başlıklı kısa bir bölüm içerir (`POST
  /api/v1/costs/suggest-for-element`, "confidence/certainty badges").
- **Literal bir `match-elements` veya `element-match` adlı SKILL.md
  bulunamadı** — `6_OpenConstructionERP/` altındaki 12 skill'in hiçbirinin
  adı bu değil (bkz. dizin listesi: `oce-platform-overview`,
  `oce-load-cost-bases`, `oce-estimate-boq`, `oce-bim-takeoff`,
  `oce-scheduling-4d5d`, `oce-cost-browser`, `oce-mcp-integration`,
  `oce-field-ops`, `oce-tendering`, `oce-validation-engine`,
  `oce-geo-coordination`, `oce-property-dev`).

Bu yüzden bu belgedeki "7 aşama" — bu görevin en somut ve en çok referans
verilen kısmı — **DDC Skills'ten değil**, doğrudan
OpenConstructionERP'nin kendi backend kaynak kodundan, `match_elements`
modülünün `pipeline.py` dosyasından alınmıştır. Bu dosyanın kendi
docstring'i kelimesi kelimesine şunu söylüyor:

> *"this module layers a visible seven-stage state machine on top of that
> flow so the estimator sees, tunes, and re-runs each step"*

ve şemalar dosyasındaki (`schemas.py`) yorum satırı bunu bir kez daha
doğruluyor: *"Visible pipeline (v3034 - 7-stage match wizard)"*. Yani "7
aşama" uydurulmuş bir sayı değil — modülün kendi kod tabanının, kullanıcıya
görünür kıldığı resmî durum makinesinin adı. Aşağıdaki her aşama adı,
açıklaması ve uç nokta, bu kaynak dosyalardan **birebir** alınmıştır,
hiçbiri tahmin edilmemiştir.

---

## Kaynaklar (uydurulmamıştır — doğrudan alınmıştır)

**DDC Skills deposu**,
https://github.com/datadrivenconstruction/DDC_Skills_for_AI_Agents_in_Construction ,
`main` dalı, commit `410ed1e71e4a5c6fd231afd0c8d1e586a9f546e8` (Görev
0.2/0.3/0.4'te de kullanılan aynı commit; 2026-11-10'da `gh api
.../contents/...` ile tekrar çekildi):
- `6_OpenConstructionERP/README.md` — 12 skill'in listesi (§ 0'daki
  "bulunamadı" tespitinin kanıtı).
- `6_OpenConstructionERP/oce-bim-takeoff/SKILL.md` — desteklenen format
  tablosu, takeoff iş akışı, "Matching elements to cost items" bölümü
  (`POST /api/v1/costs/suggest-for-element`).
- `6_OpenConstructionERP/oce-validation-engine/SKILL.md` — kural paketleri
  tablosu (`boq_quality`, DIN 276, NRM, GAEB, MasterFormat/DPGF),
  `OE_DEFAULT_VALIDATION_RULE_SETS`, mutabakat kuralları.
- `6_OpenConstructionERP/oce-estimate-boq/SKILL.md` — kalem anatomisi
  (`components[]`, `classification`), sınıflandırma standardı seçimi.

**OpenConstructionERP deposu**,
https://github.com/datadrivenconstruction/OpenConstructionERP , `main`
dalı, commit `4993a21b19d9f7a308764d02ce84e36c4020d3cd` (Görev
0.2/0.3/0.4'te de kullanılan aynı commit; 2026-11-10'da tekrar çekildi):
- `MODULES.md` — `takeoff`, `dwg_takeoff`, `requirements`, `validation`,
  `match`, `match_elements`, `cost_match`, `bim_requirements`, `eac`
  modül tanımları.
- `docs/user-guide/quantity-takeoff.md` — takeoff iş akışının 5 adımı
  (PDF/DWG/BIM), "quantities are already in the geometry" cümlesi.
- `docs/user-guide/validation.md` — doğrulama hattının çalışma zamanı
  ("import, parse, validate, enrich, store"), trafik-ışığı raporu, ve
  **"Requirements and quality gates"** bölümü — `requirements`
  modülünün gerçek, belgelenmiş tek prosedürü (entity/attribute/constraint
  üçlüleri, dört kalite kapısı).
- `docs/user-guide/estimating-and-boq.md` — kalem anatomisi, montaj
  (assembly) kavramı (Görev 0.3'te de kullanıldı).
- **`backend/app/modules/match_elements/pipeline.py`** — **bu belgenin
  birincil kaynağı**: yedi aşamanın adları, sırası, açıklamaları
  (`STAGE_META`), LLM destekli aşamalar için sistem promptu tohumları
  (`SYSTEM_PROMPT_SEEDS`), format başına varsayılan gruplama anahtarları
  (RVT/IFC/DWG).
- `backend/app/modules/match_elements/router.py` — gerçek REST uç
  noktaları (oturum oluşturma, aşama listeleme/çalıştırma, eşleştirme,
  onaylama, BOQ'a uygulama, analitik).
- `backend/app/modules/match_elements/schemas.py` — `AnalyticsResponse`,
  `GroupSummary`/`GroupDetail`, `StageState`, `TradeBucket`,
  `ConstructionStage`, `GroupStatus`, `SessionCreate` alanları — "disiplin"
  ve "match rate" kavramlarının gerçek veri şekli.
- `backend/app/modules/match_elements/analytics.py` — § 10 üretim
  gözlemlenebilirlik uyarı eşikleri (`MATCH_ALERT_*` ortam değişkenleri).
- `backend/app/modules/match_elements/manifest.py` — modül adı/görünen ad
  (`oe_match_elements` / "CAD-BIM Match → Cost"), bağımlılıkları.
- `backend/app/core/module_loader.py` — modüllerin REST yoluna nasıl
  bağlandığı (`kebab-case`, `/api/v1/{kebab_name}` + eski alt çizgili
  biçimin şema dışı (`include_in_schema=False`) ayna uç noktası) —
  `match-elements` için bunun `/api/v1/match-elements` olduğunun kanıtı.
- `backend/app/core/match_service/config.py` — güven bandı eşik
  varsayılanları (`CONFIDENCE_HIGH_THRESHOLD=0.78`,
  `CONFIDENCE_MEDIUM_THRESHOLD=0.62`, `DEFAULT_AUTO_CONFIRM_THRESHOLD=0.88`).

**Provenans notu.** Yukarıdaki kaynak kodu dosyaları `gh api
repos/datadrivenconstruction/OpenConstructionERP/contents/<path>` ve
`raw.githubusercontent.com/.../4993a21b19d9f7a308764d02ce84e36c4020d3cd/<path>`
üzerinden, pinlenen commit'e sabitlenerek çekilmiştir — `main` dalının
güncel ucu değil. Bu, "7 aşama" gibi somut, isim bazlı iddiaların kodun
kendisinden, bir blog yazısından veya pazarlama metninden değil,
doğrulanabilir bir dosya+satır kaynağından geldiğini garanti eder.

---

## Ön koşullar

- § 3'teki (bkz. `deploy/README.md`) üretim yığını ayakta olmalı; aynı
  `oe`/`oe_api()` yardımcıları kullanılır (`deploy/README.md` § 7.0) —
  burada tekrar tanımlanmaz.
- Bu görev, `deploy/blackbox/README.md`'deki firma BlackBox kataloğunun ve
  `deploy/erp/import-check.md`'deki IFC takeoff'un (BIM modeli yüklenmiş,
  `oe_bim_model.element_count > 0`) zaten tamamlanmış olduğunu varsayar —
  `match-elements` bir BIM/DWG/BOQ/PDF/metin/fotoğraf **kaynağı** üzerinde
  çalışır, kendisi bir kaynak üretmez.
- `MatchReadiness` uç noktası (`GET /api/v1/match-elements/readiness
  ?project_id=<id>`), hiçbir şey yüklemeden önce eşlemenin bu proje için
  çalışıp çalışamayacağını söyler — `can_match: false` ise `blockers`
  listesi engeli adlandırır (ör. arama servisi yok, katalog yok, genel
  demo hesabı). Bu adımı atlamayın; aksi hâlde bir sonraki adımdaki hata
  mesajı daha az açıklayıcı olur.

---

## 1. QTO kural seti nedir ve nerede yaşar (Adım 1)

### 1.1 Üç gerçek modül, görev metninin "takeoff + requirements + validation" üçlüsü

Görev metni "ERP `takeoff` + `requirements` + `validation`" diyor — bu
üçü, `MODULES.md`'de gerçekten ayrı, tanımlı modüllerdir:

| Modül | Modül kodu | MODULES.md tanımı |
|---|---|---|
| **Quantity Takeoff** | `takeoff` | "manual and assisted quantity takeoff from drawings and models" |
| **Requirements & Quality Gates** | `requirements` | "extract, validate and track construction requirements" |
| **Validation Engine** | `validation` | "data-quality validation with configurable rule sets (DIN 276, GAEB, NRM, MasterFormat, BOQ quality)" |

Bunların her biri bir "QTO kural seti"nin **farklı bir yarısını** tutar:

- **`takeoff`** → bir elemanın miktarının **nereden** geldiğini ve **nasıl
  gruplanacağını** belirler (§ 1.2).
- **`requirements`** → bir disiplinin **neyi karşılaması gerektiğini**
  (ör. "her duvar bir yangın sınıfı taşımalı") yapılandırılmış
  gereksinim olarak tanımlar, kalite kapılarından geçirir (§ 1.3).
- **`validation`** → her iki tarafı da (miktar + gereksinim) sayısal
  kurallarla (`qty × unit_price = cost`, sınıflandırma boş olmamalı vb.)
  denetler (§ 1.4).

### 1.2 `takeoff` — disiplin/aile/tip gruplaması buradan gelir

`docs/user-guide/quantity-takeoff.md`'nin tarif ettiği adım 3: *"For a
model, choose how to group the extracted elements, for example by
category, type, level or family, so the numbers land in a structure that
matches your BOQ."* Yani görev metninin "disiplin/aile/tip" dediği şey,
burada **kategori/tip/kat/aile** olarak isimlendirilen gerçek bir
gruplama adımıdır — tek bir sabit alan değil, projenin kendi BOQ
yapısına göre seçilen bir gruplama anahtarı kümesidir.

Bu, `match-elements` modülünde somut bir alana karşılık gelir:
`SessionCreate.group_by: list[str]` (bkz. § 2.2) — ve format başına
**gerçek varsayılanlar** vardır (`pipeline.py`, `group.key_picker`
promptunun gömülü varsayılan listesi):

| Kaynak formatı | Varsayılan gruplama anahtarları |
|---|---|
| RVT (Revit) | `["category", "type_name"]` |
| IFC | `["ifc_class", "predefined_type"]` |
| DWG | `["layer", "block_name"]` |

"Disiplin" ayrıca `match-elements`'in kendi veri modelinde **ayrı bir
alan** olarak da vardır — `TradeBucket` (`schemas.py`):

```
architectural | structural | mep | civil | spatial | subtractive | annotation | other
```

Her eşleme grubuna (`GroupSummary.trade`) bir disiplin etiketi atanır;
bu, Filter aşamasındaki LLM sınıflandırıcısının (§ 2.3) ürettiği bir
çıktıdır — firma bunu elle değiştirmez, ama UI'da disipline göre
filtreleme/renklendirme için kullanır.

### 1.3 `requirements` — disiplin kuralını "gereksinim" olarak yazma

`docs/user-guide/validation.md`'nin "Requirements and quality gates"
bölümü, bu modülün **tek belgelenmiş** prosedürüdür (bire bir alıntı):

> *"the requirements workflow captures project requirements as structured
> entity, attribute and constraint triplets, for example that a wall's
> fire rating must be at least a given class, and runs them through
> sequential quality gates for completeness, consistency, coverage and
> compliance. Each requirement can be traced to the BOQ positions that
> satisfy it."*

Yani bir firma kuralı (örnek: "mimari disiplinde her dış duvar, en az bir
ısı yalıtım katmanı taşımalı") burada **entity** (duvar) + **attribute**
(katman sayısı/türü) + **constraint** (≥1 yalıtım katmanı) üçlüsü olarak
tanımlanır ve dört kapıdan geçer: eksiksizlik, tutarlılık, kapsam,
uyumluluk. Her gereksinim, onu karşılayan BOQ pozisyonlarına **izlenebilir**.

> **Dürüst boşluk.** Bu modül için fetch edilen kaynaklarda somut bir
> API uç noktası veya UI ekran adı **bulunamadı** — yalnızca yukarıdaki
> kavramsal iş akışı belgelenmiş. `deploy/blackbox/README.md`'nin
> `waste_factors`/`norm_expansion` için yaptığı aynı tespit burada da
> geçerli: modül gerçek, prosedür ayrıntısı canlı sistemde keşfedilmeli.

### 1.4 `validation` — disiplin kuralını sayısal olarak denetleme

`oce-validation-engine` SKILL.md'nin kural paketleri tablosu (Görev 0.3'te
`deploy/blackbox/README.md`'de henüz anılmamıştı, burada ilk kez
detaylandırılıyor):

| Paket | Denetlediği |
|---|---|
| `boq_quality` | zorunlu alanlar, birim tutarlılığı, yinelenen kodlar, miktar makuliyeti |
| DIN 276 | maliyet grubu kodları geçerli mi, hiyerarşi tutarlı mı |
| NRM | eleman kodları, ölçüm kuralları |
| GAEB | X83/X84 yapısı, kalem referansları |
| MasterFormat / DPGF | sınıflandırma kodları |

Varsayılan set `OE_DEFAULT_VALIDATION_RULE_SETS` ortam değişkeniyle
yapılandırılır (varsayılan `["boq_quality"]`); elle tetiklemek için
`POST /api/v1/boqs/{id}/validate/`. Firma kendi disiplin kuralını
(§ 1.3'teki gereksinim) bir **özel kural** olarak da yazabilir — bir kural
`koşul + önem derecesi (severity) + mesaj` üçlüsüdür (`oce-validation-engine`
SKILL.md'nin pseudo-kod örneği, bire bir): işçilik payı makuliyeti,
`qty × unit_price = cost` mutabakatı, `Σ bileşenler = toplam kaynak
maliyeti`, her ağaç seviyesinde sınıflandırmanın boş olmaması, belgelenmiş
tenzilat (deduction) satırları dışında negatif miktar olmaması.

**Pratik sonuç — firma QTO kural setini nereye kaydeder:**

1. **Gruplama kuralı** (disiplin/aile/tip) → `match-elements` oturumunun
   `group_by`/`excluded_categories`/`construction_stage` alanlarına (§ 2.2) —
   oturum bazlı, proje bazlı kaydedilir, aynı tarifi tekrar kullanmak için
   `save_to_template_library: true` ile (`ConfirmMatchRequest`, bkz. § 2.3)
   bir şablon olarak saklanır.
2. **Gereksinim kuralı** (disiplin başına zorunlu özellik) → `requirements`
   modülüne entity/attribute/constraint üçlüsü olarak (§ 1.3 — somut
   API'si bu ortamda doğrulanmadı).
3. **Sayısal denetim kuralı** (mutabakat/eşik) → `validation` modülüne bir
   `boq_quality`/DIN 276/özel kural olarak (§ 1.4).

---

## 2. `match-elements` 7 aşamalı eşlemeyi çalıştırma (Adım 2)

### 2.1 API yüzeyi

`match_elements` modülü (`manifest.py`: `oe_match_elements`, görünen ad
"CAD-BIM Match → Cost") `module_loader.py`'nin kebab-case kuralıyla
mount edilir: dizin adı `match_elements` → kebab `match-elements` →

```
/api/v1/match-elements/...
```

(Alt çizgili eski biçim `/api/v1/match_elements/...` de bir ayna uç nokta
olarak çalışır, ama `include_in_schema=False` ile OpenAPI şemasından
gizlidir — yeni entegrasyonlar kebab biçimini kullanmalı.)

### 2.2 Oturum oluşturma

Bir eşleme **oturumu** (`MatchSession`), tek bir kaynak (BIM modeli, DWG,
BOQ satırları, metin, PDF, fotoğraf) üzerinde çalışır:

```bash
oe_api POST /api/v1/match-elements/sessions '{
  "project_id": "<project-uuid>",
  "source": "bim",
  "bim_model_id": "<bim-model-uuid>",
  "name": "Zemin Kat Mimari — KaplanBIM metraj",
  "group_by": ["category", "type_name"],
  "construction_stage": "06_Superstructure",
  "auto_confirm_threshold": 0.88
}'
```

Alan notları (`schemas.SessionCreate`, birebir):
- `source`: `"bim" | "dwg" | "boq" | "text" | "pdf" | "photo" | "image"`.
- `bim_model_id` zorunludur `source="bim"` iken — yoksa 422 döner ("Pick
  the BIM model to match: a session on a model needs bim_model_id.").
- `group_by` boş bırakılırsa Group aşaması (§ 2.3) format varsayınını
  (§ 1.2 tablosu) kullanır.
- `excluded_categories: null` = varsayılan "çıkarımsal" (subtractive) set
  (`IfcOpeningElement` gibi) otomatik hariç tutulur; boş dizi (`[]`)
  verilirse boşluklar/anotasyonlar da listede görünür.
- `construction_stage`: MAPPING_PROCESS.md v3 § 4.2'nin OmniClass hizalı
  12 inşaat aşamasından biri (`02_Demolition` … `13_Sitework`) — isteğe
  bağlı sabit bir filtre.
- `catalogue_id`: `deploy/README.md` § 7'deki `TR_NATIONAL` gibi bir
  CWICR v3 bölge kimliği **veya** eski bir `CostDatabase` UUID'si.

**Beklenen:** `201` ile `SessionRead` döner; `id` alanı sonraki tüm aşama
çağrılarında kullanılır.

### 2.3 Yedi aşama — adlar, sıra, ne yaptıkları

`pipeline.py`'nin `STAGE_NAMES` sabiti ve `STAGE_META` sözlüğünden birebir:

| # | Aşama | Ne yapar | LLM kullanır mı |
|---|---|---|---|
| 1 | **convert** | CAD/BIM/DWG dosyası → kanonik eleman tablosu. Bu dönüşüm zaten takeoff/bim-hub yükleyicisi tarafından yapılmıştır; bu aşama yalnızca kaynak sayılarını kaydeder (doğrulama amaçlı). | Hayır |
| 2 | **load** | Kaynak adaptörü (BIM/DWG/BoQ/metin/görüntü) kanonik satırları `SourceElement[]` olarak okur; `element_count` + örnek kaydeder. | Hayır |
| 3 | **schema** | Her öznitelik sütununu SUM/MEAN/FIRST olarak sınıflandırır (alan/hacim → topla, boyut → ortala, malzeme/aile → ilk değeri etiket olarak tut). Çıktı, Group aşamasının `properties_rollup` politikası olur. | Evet (`schema.header_aggregation`) |
| 4 | **filter** | Çizim yardımcılarını (ızgara, referans düzlemi, açıklık, anotasyon) gruplamadan önce eler. Varsayılan hariç tutulan kategoriler önce (ucuz), sınır durumdaki satırlar LLM sınıflandırıcısına gider. | Evet (`filter.building_classifier`) |
| 5 | **group** | Elemanları yapılandırılmış anahtarlarla gruplar (§ 1.2 format varsayılanları, veya oturumda açıkça ayarlanan `group_by`). | Evet (`group.key_picker`, yalnızca anahtar **önerisi** için — oturumda `group_by` zaten set edilmişse atlanabilir) |
| 6 | **match** | Vektör eşleyici + (opsiyonel) AI maliyet ajanı yeniden sıralama çalıştırır; her yöntemin adaylarını grup başına önbelleğe alır. | Evet (`match.cost_agent`) |
| 7 | **rollup** | Grup miktarlarını toplar + yüksek güvenli seçimleri tek tıkla onay için işaretler; kullanıcı onaylamadan hiçbir şey BOQ'a ulaşmaz. | Hayır |

Her aşamanın kendi "explainer" metni vardır (`STAGE_META[stage]["explainer"]`,
UI'da `StageCard` bileşeninin gösterdiği metin) — örnek, **group**
aşamasının tam metni (birebir alıntı):

> *"Group elements by attribute keys. RVT defaults to category + type_name
> (one row per Revit type), IFC to ifc_class + predefined_type (one row
> per IfcEntity), DWG to layer + block_name. Change the keys to widen or
> narrow the rows."*

**Aşamaları listeleme ve çalıştırma:**

```bash
# Yedi aşamanın hepsini (hiç çalışmamışsa "pending" durumuyla) listele
oe_api GET /api/v1/match-elements/sessions/<session_id>/stages

# Tek bir aşamayı çalıştır — boş gövde, depolanmış girdilerle yeniden çalışır
oe_api POST /api/v1/match-elements/sessions/<session_id>/stages/convert/run '{}'
oe_api POST /api/v1/match-elements/sessions/<session_id>/stages/load/run '{}'
oe_api POST /api/v1/match-elements/sessions/<session_id>/stages/schema/run '{}'
oe_api POST /api/v1/match-elements/sessions/<session_id>/stages/filter/run '{}'
oe_api POST /api/v1/match-elements/sessions/<session_id>/stages/group/run '{}'
oe_api POST /api/v1/match-elements/sessions/<session_id>/stages/match/run '{}'
oe_api POST /api/v1/match-elements/sessions/<session_id>/stages/rollup/run '{}'
```

**Önemli davranış — idempotentlik ve "stale" işaretleme**
(`pipeline.run_stage`'in docstring'i, birebir): bir aşamayı yeniden
çalıştırmak, o aşamanın satırını sıfırlayıp yeniden çalıştırır; **bitmiş
durumdaki (`done`) sonraki aşamalar `stale` olarak işaretlenir** — yani
Filter aşamasını değiştirip yeniden çalıştırırsanız, UI "Group/Match/Rollup
yeniden çalıştırılmalı" uyarısı gösterir. Firma kendi gruplama/filtre
tercihini ayarlarken bu sırayı atlamamalı: bir üst aşamayı değiştirip
alttaki aşamaları yeniden çalıştırmadan BOQ'a uygulamak, eski (geçersiz)
sonuçları taşır.

**LLM destekli aşamaların promptları** (`schema`, `filter`, `group`,
`match`) firma tarafından düzenlenebilir — `prompt_template_id` ile
belirli bir şablonu seçebilir ya da sistem varsayılanını kullanabilirsiniz
(`GET /api/v1/match-elements/prompt-templates`, `POST
.../prompt-templates` ile kendi şablonunuzu oluşturabilirsiniz). Bu, § 1'in
"firma kuralı" kavramının LLM tarafındaki karşılığıdır — ör. `match.cost_agent`
promptunu "firmanın standartlarına göre seçimi yönlendirecek" şekilde
düzenleyebilirsiniz (`oe_match_elements` modülünün açıklamasındaki
"maps model and drawing elements to cost positions" ifadesinin arkasındaki
mekanizma budur).

### 2.4 Toplu eşleştirme, onay ve BOQ'a uygulama

Aşama bazlı yürütmenin yanında, mevcut `MatchService` akışını doğrudan
çağıran kısayol uç noktaları da vardır:

```bash
# Belirli yöntemle (vector/lexical/resources/llm) en büyük N grubu eşle
oe_api POST /api/v1/match-elements/sessions/<session_id>/match '{
  "method": "vector", "max_groups": 10, "top_k": 10
}'

# Tek bir grubu onayla (candidate_id = seçilen maliyet kalemi)
oe_api POST /api/v1/match-elements/sessions/<session_id>/confirm '{
  "group_key": "category:Wall|type_name:Tuğla Duvar 20cm",
  "candidate_id": "<cost-item-uuid>",
  "method": "vector"
}'

# Eşiğin üzerindeki tüm "suggested" grupları toplu onayla
oe_api POST /api/v1/match-elements/sessions/<session_id>/bulk-confirm '{
  "threshold": 0.88
}'

# Onaylanmış grupları BOQ'a uygula (önce dry_run ile önizleyin)
oe_api POST /api/v1/match-elements/sessions/<session_id>/apply '{
  "dry_run": true, "organize_by_classification": true
}'
```

`ApplyToBoqRequest.dry_run: true`, bu görevin aradığı "önce önizle, sonra
uygula" güvencesinin gerçek karşılığıdır — Görev 0.3'teki (BlackBox)
`/import/preview/` ile aynı kavram, farklı modülde aynı disiplin.

---

## 3. Match rate (eşleme oranı) raporunu okuma (Adım 2 — "beklenen")

İki ayrı, gerçek rapor katmanı vardır — biri **tek oturum** için, biri
**zaman içinde toplam** için.

### 3.1 Oturum bazlı — grup listesi özeti

```bash
oe_api GET "/api/v1/match-elements/sessions/<session_id>/groups?limit=200"
```

Yanıt (`GroupListResponse`) bir `summary: dict[str, int]` taşır — ör.
`{"unmatched": 47, "suggested": 12, "confirmed": 138, "applied": 0}`
(durum değerleri `GroupStatus`: `unmatched | suggested | confirmed |
overridden | skipped | tbd | applied`). Aynı yanıt, UI'nin kullandığı
güven bandı eşiklerini de taşır: `confidence_high_threshold` (varsayılan
**0.78**) ve `confidence_medium_threshold` (varsayılan **0.62**) —
(`backend/app/core/match_service/config.py`:
`CONFIDENCE_HIGH_THRESHOLD`/`CONFIDENCE_MEDIUM_THRESHOLD`). Toplu onay
varsayılan eşiği ise **0.88**'dir (`DEFAULT_AUTO_CONFIRM_THRESHOLD`).

Her satırın (`GroupSummary`) kendi `confidence_band: "high"|"medium"|
"low"|"none"` alanı vardır — yani "match rate" burada tek bir yüzde değil,
oturumdaki grupların durum + güven bandı dağılımıdır. **Sağlıklı bir
oturum** demek `unmatched` sayısının düşük, `confidence_band="high"`
payının yüksek olduğu bir dağılımdır — sıfır `unmatched` şartı değil,
çünkü bazı gruplar meşru şekilde "no-match" (firmanın kataloğunda
karşılığı olmayan özel bir iş kalemi) olabilir (`POST
/api/v1/match-elements/sessions/<id>/no-match`).

### 3.2 Zaman bazlı — analitik (üretim gözlemlenebilirliği)

```bash
oe_api GET "/api/v1/match-elements/analytics?days=7&project_id=<project-uuid>"
```

`AnalyticsResponse` alanları (`schemas.py`, birebir — yüzdeler 0.0–1.0
aralığında, UI 100 ile çarpar):

| Alan | Anlamı |
|---|---|
| `total_searches` / `total_with_pick` / `pick_rate` | toplam arama, seçim yapılan arama, seçim oranı |
| `mean_top_score` / `p95_top_score` | en iyi adayın ortalama/95. yüzdelik güven skoru |
| `low_score_pct` | en iyi skoru 0.3'ün altında olan aramaların payı |
| `zero_hit_pct` | hiç aday dönmeyen aramaların payı |
| `confidence_band_distribution` | `{"high": N, "medium": N, "low": N, "none": N}` |
| `mean_picked_rank` / `p95_picked_rank` / `high_picked_rank_pct` | seçilen adayın sıralamadaki yeri (4'ten büyükse "kötü" sayılır) |
| `by_country` / `by_source_type` / `by_ifc_class` | arama hacmine göre en çok görülen N kırılım |
| `alerts` | eşik aşan metrikler listesi |

**Uyarı eşikleri** (`analytics.py`, § 10 — ortam değişkeniyle
geçersiz kılınabilir, varsayılanlar):

| Uyarı | Eşik | Varsayılan |
|---|---|---|
| Düşük skor | aramaların %20'sinden fazlasında en iyi skor < 0.3 | katalog boşluğu — firmanın ilgili disiplin için kataloğu eksik/zayıf olabilir |
| Yüksek sıra | seçimlerin %20'sinden fazlası 4. sıradan sonra | yeniden-eğitim gerekebilir |
| Sıfır isabet | sert filtreli aramaların %10'undan fazlası 0 aday döner | filtreler fazla kısıtlayıcı olabilir |

Bu üç uyarı, pencerede en az **20** satır olmadan tetiklenmez (`_MIN_SAMPLE`)
— yani iki test sorgusuyla yeni bir deploy'da yanlış alarm çıkmaz.
**Firma için pratik okuma:** `low_score_pct` belirli bir `by_ifc_class`
veya `by_country` kırılımında yüksekse, bu o disiplin/bölge için firma
BlackBox kataloğunun (`deploy/blackbox/README.md`) eksik olduğunun
işaretidir — eşleme motorunun değil, kaynak verinin sorunu.

---

## 4. Doğru miktar üretildiğini doğrulama — Görev 0.4'e bağlama

Bu görev, `deploy/erp/import-check.md`'nin Review Focus 1/2'sini
(element_count, validation raporu, birim/origin tutarlılığı) **tekrar
üretmez** — sadece `match-elements` çıktısının o sayısal çapraz kontrole
nasıl bağlandığını gösterir:

1. **Eleman sayısı tutarlılığı** — `load` aşamasının çıktısındaki
   `element_count`, § 2.2'de bağlanan BIM modelinin
   `oe_bim_model.element_count`'una (Görev 0.4 § 2.2) eşit olmalı. Load
   aşaması kendi başına yeni bir dönüştürme yapmaz, zaten var olan
   kanonik tabloyu okur — sayı farklıysa oturumun `excluded_categories`
   veya kaynak bağlama ayarı yanlıştır, dönüştürücü değil.
2. **Grup toplamı = kaynak toplamı** — `rollup` aşamasının grup bazlı
   toplam miktarı (ör. toplam m² duvar), Revit/IFC'nin kendi şemasındaki
   (Görev 0.4 § 1.5, Schedule/Quantities) bağımsız referans sayımla
   karşılaştırılmalı. Sapma varsa, önce § 1.2'deki gruplama anahtarının
   iki farklı ürünü tek grupta topladığından (yanlış `group_by`) şüphelenin.
3. **Fiyatlı mutabakat** — `apply` ile BOQ'a uygulanan miktarlar,
   `oce-validation-engine`'in mutabakat kurallarından (§ 1.4) geçmeli:
   `qty × unit_price = cost` ve `Σ bileşenler = toplam kaynak maliyeti`.
   Bunu `POST /api/v1/boqs/{id}/validate/` ile BOQ üzerinde çalıştırın —
   bu, Görev 0.4 § 5 madde 3'teki "fiyatlı haliyle doğrulamayı tekrar
   çalıştırın" adımının ta kendisidir, burada tekrar edilmez.
4. **Disiplin kapsamı** — `requirements` modülünün "coverage" kapısı
   (§ 1.3), her disiplinin BOQ'da temsil edildiğini doğrular; bu adımın
   somut API'si bu ortamda doğrulanmadı, ama `validation.md`'nin
   "completeness checks that ask whether every trade is covered" cümlesi
   bu kapının var olduğunu teyit ediyor.

**Beklenen (canlı ortamda):** (1) iki sayı birebir eşit; (2) sapma yalnızca
yuvarlama mertebesinde; (3) `validate/` çağrısı hatasız (`error`-severity
sıfır) döner; (4) her disiplin için en az bir BOQ pozisyonu vardır.

---

## 5. Sorun giderme ve dürüst boşluklar

- **Bir aşamayı çalıştırdım ama sonraki aşama hâlâ eski veriyi gösteriyor.**
  § 2.3'teki "stale" davranışını kontrol edin — alt aşamaları da yeniden
  çalıştırmanız gerekir, üst aşama onları otomatik yeniden çalıştırmaz,
  yalnızca `stale` olarak işaretler.
- **`group` aşaması beklenenden çok daha az/çok grup üretti.** `group_by`
  anahtarlarınızı gözden geçirin (§ 1.2 tablosu) — iki farklı ürün aynı
  anahtarla eşleşiyorsa (ör. yalnızca `category`, `type_name` olmadan)
  gruplar birleşir ve miktar yanlış toplanır.
- **`match` aşaması çok sayıda `NO_MATCH` döndürüyor.** § 3.2'deki
  `low_score_pct`/`zero_hit_pct` uyarılarını kontrol edin — bu genellikle
  firma BlackBox kataloğunun o disiplin için eksik olduğunun işaretidir,
  eşleyicinin değil.
- **`requirements` modülünün API/UI adımları** (§ 1.3) ve **`match`
  aşamasının `group_by` boş bırakıldığında LLM önerisinin tam davranışı**
  (§ 2.3, aşama 5) bu ortamda doğrulanmadı — yalnızca modül/aşama
  tanımları gerçek, adım adım prosedür canlı sistemde keşfedilmeli.
- **Bu belgedeki hiçbir API çağrısı** gerçek bir OpenConstructionERP
  sunucusuna karşı çalıştırılmadı (bkz. belge başındaki not) — "Beklenen"
  satırları kabul kriteridir, gözlenmiş sonuç değildir.

---

## 6. Kapsam dışı bırakılanlar

- `requirements` modülünün somut API uç noktaları/UI ekranları (§ 1.3,
  § 5) — canlı sistemde keşfedilmeli.
- `match-elements`'in metin/fotoğraf/PDF kaynak adaptörleri
  (`TextAdapter`, `ImageAdapter`, `PdfAdapter`) — bu görev yalnızca BIM
  kaynağına odaklanır; diğer kaynaklar aynı yedi aşamayı paylaşır ama
  kendi `SessionCreate.text_inputs`/`image`/`pdf_rows` alanlarını kullanır.
- Prompt şablonu düzenleme ekranının UI adımları (`PromptEditor.tsx`) —
  yalnızca API yüzeyi (§ 2.3) belgelendi.
- `eac` (EAC v2 Engine — "a single-kernel rules engine for takeoff,
  validation and clash outputs") modülü, `MODULES.md`'de anılır ama bu
  görevin kaynaklarında ayrıntılı prosedürü bulunamadı.

---

## 7. Commit

```bash
git add deploy/blackbox/qto-rules.md
git commit -m "docs: firm QTO rule sets"
```
