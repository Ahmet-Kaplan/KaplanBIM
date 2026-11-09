# AI Estimate (fiyat eşleme) ve kalibrasyon kaydı

Bu belge, KaplanBIM inşaat platformu entegrasyonunun **Faz 1 / Görev 1.2**
çıktısıdır: OpenConstructionERP'nin metin/açıklama veya fotoğraftan maliyet
önerisi üreten **AI Estimation** (`ai`) modülünün nasıl açılıp çalıştırıldığını,
eşleşmeyen kalemlerin **asla sessizce düşmeden** nasıl listelendiğini (Review
Focus 3), bu kalemler için manuel rayiç giriş yolunu ve Görev 1.3'teki canlı
kalibrasyon sırasında doldurulacak bir sapma kayıt şablonunu anlatır.

> **Bu ortamda doğrulanmadı.** Bu runbook, bir OpenConstructionERP sunucusu
> fiilen ayağa kaldırılmadan — yalnızca gerçek OpenConstructionERP backend
> kaynak kodundan ve DDC Skills belgelerinden (bkz. § Kaynaklar) derlenerek
> yazıldı. Aşağıdaki API çağrıları bu depoda çalıştırılıp yanıtları
> gözlemlenmemiştir. "Beklenen" satırları, gerçek bir sunucuda bunu
> doğrulayacak kişi için bir kabul kriteri listesidir. § 4'teki kalibrasyon
> tablosu kasıtlı olarak **boştur** — gerçek sayılar Görev 1.3'te, canlı bir
> sunucuya karşı doldurulur.

---

## 0. Terminoloji notu — görev başlığındaki "AI Estimate (fiyat eşleme)" iki ayrı gerçek modüle karşılık gelir

Görev başlığı tek bir özellik gibi okunuyor, ama OpenConstructionERP'nin
modül kataloğunda (`MODULES.md` → "Estimating and BOQ" ve "Cost and resource
data" bölümleri) bunlar **iki ayrı, gerçek modüldür** — ve bir üçüncü, ilgisiz
modülle karıştırılmaması gerekir:

| Görev başlığının parçası | Gerçek ERP modülü | Modül kodu | MODULES.md tanımı |
|---|---|---|---|
| "metin/açıklama veya fotoğraftan maliyet önerisi" | **AI Estimation** | `ai` | *"cost suggestions from a text description or a photo"* |
| "fiyat eşleme" + "eşleşmeyen kalemler açık listelenir" | **Cost Match** | `cost_match` | *"matches material layers to cost items, exact first then semantic"* |

Backend'deki `cost_match` modülünün kendi `manifest.py` açıklaması bunu
kelimesi kelimesine doğruluyor: *"Match free-text bill-of-quantities lines
against a cost base and review the suggestions: every line lands in one of
four tiers by confidence, and a person confirms, overrides or rejects each
one."* — yani görev metninin Türkçe "fiyat eşleme" ifadesi, platformun kendi
modül adıyla (**Cost Match**) birebir örtüşüyor; bu rastlantı değil.

**Karıştırılmaması gereken üçüncü modül:** `MODULES.md`'de ayrıca **AI
Estimate Builder** (`ai_estimator`) adında bir modül daha vardır —
*"drafts a full priced estimate from your data for a person to confirm."*
Bu, görev kapsamında **değildir**: `ai_estimator` firmanın kendi verisinden
(BlackBox + proje verisi) tam bir fiyatlı tahmin taslağı çıkarır; `ai` ise tek
bir metin açıklaması veya fotoğraftan kalem bazlı öneri üretir. Bu belge
yalnızca `ai` + `cost_match` ikilisini kapsar; `ai_estimator` bu belgenin
kaynaklarında ayrıntılı incelenmemiştir (bkz. § 6 Kapsam dışı).

Ayrıca, `MODULES.md`'nin "Cost and resource data" bölümünde `cost_match`'in
hemen altında **Element Match** (`match`) adlı dördüncü bir modül daha vardır
— *"returns ranked cost-position candidates for a BIM, PDF, DWG or photo
element."* Bu, Görev 1.1'de (`deploy/blackbox/qto-rules.md`) belgelenen
`match_elements` (CAD-BIM Match → Cost) modülünün **tekil eleman** düzeyindeki
kardeşidir — bir BIM/CAD elemanı için aday maliyet kalemi döndürür, `ai`
modülünün metin/foto girdisiyle karıştırılmamalıdır. Bu belge `match`'i
ayrıntılı işlemez (kaynaklarda `ai`/`cost_match` kadar derinlemesine
belgelenmiş bir API yüzeyi bulunamadı — dürüst boşluk, bkz. § 6).

---

## Kaynaklar (uydurulmamıştır — doğrudan alınmıştır)

**OpenConstructionERP deposu**,
https://github.com/datadrivenconstruction/OpenConstructionERP , `main` dalı,
commit `4993a21b19d9f7a308764d02ce84e36c4020d3cd` (Görev 0.2/0.3/0.4/1.1'de de
kullanılan aynı commit; 2026-11-10'da `raw.githubusercontent.com` ve `gh api
.../contents/...` ile tekrar çekildi, `main`'in güncel ucu değil):

- `MODULES.md` → "Estimating and BOQ" bölümü (`ai`, `ai_estimator` satırları)
  ve "Cost and resource data" bölümü (`costs`, `cost_match`, `match`
  satırları) — § 0 tablosundaki tanımların birebir kaynağı.
- **`backend/app/modules/ai/manifest.py`** — modül adı (`oe_ai`, görünen ad
  "AI Estimation"), `InferenceDeclaration`: bu modülün kendisi sağlayıcı
  katmanıdır, ürünle birlikte hiçbir API anahtarı gelmez, bir operatör kendi
  kimlik bilgisini girmeden hiçbir şey çıkarsamaz.
- **`backend/app/modules/ai/router.py`** — **bu belgenin `ai` modülü için
  birincil kaynağı**: gerçek uç noktalar (`/providers`, `/settings/`,
  `/settings/test/`, `/quick-estimate/`, `/photo-estimate/`,
  `/photo-category-suggest/`, `/file-estimate/`, `/estimate/{job_id}/
  create-boq/`, `/estimate/{job_id}/enrich/`, `/estimate/{job_id}`,
  `/estimates/`, `/advisor/chat`), izin adları (`ai.estimate`, `ai.use`,
  `ai.create_boq`, `ai.settings.read`, `ai.settings.update`), yükleme
  limitleri, dosya imza (magic-byte) kontrolleri.
- `backend/app/modules/ai/schemas.py` — `EstimateItem` (confidence alanı
  dahil `description`/`unit`/`quantity`/`unit_rate`/`classification`/
  `category`), `EstimateJobResponse`, `CreateBOQFromEstimateRequest`
  (`apply_enriched`, `region`).
- `backend/app/modules/ai/service.py` — `_coerce_confidence` (model
  güven skorunu `[0,1]`'e indirger, uydurma değer bırakmaz),
  `_match_cost_items` (vektör araması önce, metin anahtar kelime araması
  sonra — `enrich` önizlemesi ile `create_boq_from_estimate`'in tek doğruluk
  kaynağı), `create_boq_from_estimate` (eşleşme uygulanırken
  `CONFIDENCE_MEDIUM_THRESHOLD` eşiği, `cwicr_match.applied` bayrağı).
- `backend/app/modules/ai/permissions.py` — `ai.*` izinlerinin hepsi
  `Role.EDITOR` gerektirir (ayar okuma hariç, o `Role.VIEWER`).
- **`backend/app/modules/cost_match/manifest.py`** — modül adı (`oe_cost_match`,
  görünen ad "Cost Match"), § 0'daki birebir alıntının kaynağı.
- **`backend/app/modules/cost_match/router.py`** — **bu belgenin
  `cost_match` modülü için birincil kaynağı**: gerçek uç noktalar
  (`/runs/`, `/runs/{id}`, `/runs/{id}/results`, `/runs/{id}/review-queue`,
  `/runs/{id}/validate`, `/results/{id}`, `/results/{id}/decision`,
  `/results/{id}/decisions`, `/results/{id}/validate`), izin adları
  (`cost_match.read`, `cost_match.run`, `cost_match.review`), mount
  yolu dosyanın kendi modül docstring'inde birebir yazılı:
  *"Mounted at `/api/v1/cost-match/` by the module loader."*
- `backend/app/modules/cost_match/models.py` — dört aşama (`TIERS`:
  `exact`, `high_confidence`, `needs_review`, `unmatched`) ve üç karar türü
  (`DECISION_KINDS`: `confirmed`, `overridden`, `rejected`) sabitleri,
  her birinin birebir docstring açıklaması.
- `backend/app/modules/cost_match/matcher.py` — güven bandı eşikleri
  (`HIGH_CONFIDENCE = 0.75`, `REVIEW_CONFIDENCE = 0.45`), skor formülü
  (`0.65 * query_coverage + 0.35 * term_overlap`, birim uyuşmazlığında
  `0.55` çarpanı), normalize edilmiş tam dize eşitliğinin `1.0`'a
  kısa devre yapması.
- `backend/app/modules/cost_match/validators.py` — `cost_match` kural
  seti, özellikle **`cost_match.review_queue_cleared`** kuralı (WARNING,
  "Lines still awaiting a person are neither priced nor knowingly
  excluded") — Review Focus 3'ün sayısal denetim karşılığı.
- `backend/app/modules/cost_match/service.py` — `create_run` (bir kataloğa
  karşı toplu skorlama, her satır `pending` döner), `record_decision`
  (onay/geçersiz kılma/red akışı, geçersiz kılma hedefinin aynı kataloğun
  **aktif** bir kalemi olması zorunluluğu — yoksa `LookupError`/404).
- `backend/app/core/module_loader.py` — kebab-case mount kuralı (dizin adı
  `ai` → zaten tirelenecek alt çizgi yok → `/api/v1/ai`; dizin adı
  `cost_match` → `/api/v1/cost-match`), eski alt çizgili ayna uç nokta
  kuralı (Görev 1.1'de de kullanıldı).

**DDC Skills deposu**,
https://github.com/datadrivenconstruction/DDC_Skills_for_AI_Agents_in_Construction ,
`main` dalı, commit `410ed1e71e4a5c6fd231afd0c8d1e586a9f546e8` (önceki
görevlerde de kullanılan aynı commit; 2026-11-10'da tekrar çekildi):

- `6_OpenConstructionERP/README.md` — 12 skill'in listesi ve "The cost data
  behind the platform" bölümü.
- `6_OpenConstructionERP/oce-estimate-boq/SKILL.md` — "Estimation inputs the
  platform supports" tablosu: *"Natural language | `POST
  /api/v1/costs/match` (or AI estimate) | multi-lingual matching"* ve
  *"Photo | AI photo-to-BOQ (GPT-4o + YOLO) | returns scoped BOQ with
  confidence"* — görev metninin "metin/açıklama veya fotoğraftan maliyet
  önerisi" ifadesinin DDC Skills tarafındaki doğrulaması.
- `6_OpenConstructionERP/oce-bim-takeoff/SKILL.md` — "Matching elements to
  cost items" bölümü (`/suggest-for-element`, "confidence/certainty
  badges") — § 0'daki `match` modülüyle ilişkilendirme için referans
  verildi, bu belgenin ana konusu değildir.
- `6_OpenConstructionERP/oce-cost-browser/SKILL.md` — "Certainty & variants"
  bölümü, `certainty` rozetlerinin genel platform kavramı olarak tekrar
  referansı.

> **Dürüst boşluk — DDC Skills'te literal bir "AI estimation" veya
> "cost-matching" adlı SKILL.md yok.** Görev talimatı, DDC Skills
> deposunun `6_OpenConstructionERP` kategorisinde bu isimle bir skill
> fetch edilmesini bekliyordu. Dizin fiilen tarandığında (`gh api
> .../contents/6_OpenConstructionERP`, pinlenen commit yukarıda) 12
> skill'in hiçbirinin adı `oce-ai-estimate`, `oce-cost-match` veya benzeri
> değildir — tam liste: `oce-bim-takeoff`, `oce-cost-browser`,
> `oce-estimate-boq`, `oce-field-ops`, `oce-geo-coordination`,
> `oce-load-cost-bases`, `oce-mcp-integration`, `oce-platform-overview`,
> `oce-property-dev`, `oce-scheduling-4d5d`, `oce-tendering`,
> `oce-validation-engine`. Bu, Görev 1.1'in `qto-rules.md`'sinde
> `match-elements`/`element-match` için yapılan aynı tespitle birebir
> aynı desendir: DDC Skills, `ai`/`cost_match` modüllerini **ayrı bir
> skill olarak değil**, `oce-estimate-boq`'un "Estimation inputs" tablosu
> içinde kısa bir satır olarak anar. Bu yüzden § 1 ve § 2'deki somut
> uç noktalar, bir DDC Skill dosyasından değil, doğrudan
> OpenConstructionERP'nin kendi backend kaynak kodundan alınmıştır.

---

## Ön koşullar

- § 3'teki (bkz. `deploy/README.md`) üretim yığını ayakta olmalı; aynı
  `oe`/`oe_api()` yardımcıları kullanılır (`deploy/README.md` § 7.0) —
  burada tekrar tanımlanmaz. Dosya yükleyen (`photo-estimate`,
  `file-estimate`) çağrılar için `deploy/blackbox/README.md` § 3.2'deki
  `oe_api_file()` yardımcısı ve aynı "`curl` varlığı bu ortamda
  doğrulanmadı" uyarısı geçerlidir.
- Bu görev, Görev 0.2'nin (`TR_NATIONAL` veya eşdeğer bir ulusal taban) ve/
  veya Görev 0.3'ün (firma BlackBox kataloğu, `deploy/blackbox/README.md`)
  zaten yüklenmiş `costs` verisinin var olduğunu varsayar — `ai` ve
  `cost_match` modülleri bir maliyet **tabanı** üzerinde eşleştirme yapar,
  kendileri taban üretmez.
- **İzin modeli** (`ai/permissions.py`, `cost_match/router.py`'deki
  `permission_registry.register_module_permissions` çağrısı): hem `ai.*`
  hem `cost_match.run`/`cost_match.review` izinleri `Role.EDITOR` gerektirir
  (yalnızca ayar/okuma uç noktaları `Role.VIEWER`'a açıktır). Pratik sonuç:
  AI Estimate'i çalıştıracak ve fiyat eşleme kararlarını verecek kullanıcı
  en az **editor** rolünde olmalıdır — bu, Görev 0.3'teki `costs.create`
  izin gereksinimiyle aynı pratik sonuca varır (viewer rolüyle bu uç
  noktalar 403 döner, doğrulanmamış).
- **AI modülü "bring your own key"dir (BYOK).** `ai/manifest.py`'nin
  `InferenceDeclaration.basis` alanı bunu birebir söylüyor: *"no key ships
  with the product, so nothing here infers anything until an operator
  supplies credentials of their own."* Yani § 1'den önce bir sağlayıcı
  (Anthropic/OpenAI/Gemini/kendi barındırılan Ollama veya vLLM) anahtarı
  girilmelidir — aşağıdaki Adım 0.

---

## Adım 0 — AI sağlayıcısını yapılandırma (`ai` modülünü açmadan önce)

```bash
# Desteklenen sağlayıcıları listele (frontend'in de kullandığı dinamik liste)
oe_api GET /api/v1/ai/providers/

# Mevcut ayarları oku (anahtarlar maskelenmiş döner — yalnızca set edilip
# edilmediği görünür)
oe_api GET /api/v1/ai/settings/

# Bir sağlayıcı anahtarı kaydet (örnek: Anthropic Claude)
oe_api PATCH /api/v1/ai/settings/ '{
  "anthropic_api_key": "<firmanin-kendi-API-anahtari>",
  "preferred_model": "claude-sonnet"
}'

# Bağlantıyı doğrula — gerçek bir minimal çağrı yapar, anahtarın geçerli
# olduğunu ve modelin yanıt verdiğini kanıtlar
oe_api POST /api/v1/ai/settings/test/ '{"provider": "anthropic"}'
```

**Beklenen:** `GET /providers/` sağlayıcı listesini döner; `PATCH
/settings/` ile kaydedilen anahtar daha sonraki `GET /settings/`
çağrısında maskeli olarak "set" görünür; `POST /settings/test/` `{"success":
true, "message": "...", "latency_ms": <int>, "model": "<effective-model>"}`
döner — `success: false` ise mesaj hangi adımın (anahtar eksik/geçersiz,
bağlantı başarısız) başarısız olduğunu adlandırır.

> **Not — kendi barındırılan uç nokta (Ollama/vLLM) kullanılıyorsa.**
> `ollama_base_url`/`vllm_base_url` alanları bir SSRF koruma doğrulamasından
> geçer (`_reject_unsafe_base_url`, `backend/app/core/url_safety.py`) —
> link-local veya bulut metadata adresleri reddedilir, loopback/özel ağ
> adresleri (yerelde çalışan bir model için) kabul edilir.

---

## 1. AI Estimate'i aç ve fiyat eşlemeyi çalıştır (Adım 1)

`ai` modülü (`oe_ai`, module_loader'ın kebab-case kuralıyla — dizin adı `ai`
zaten tireli değil — `/api/v1/ai` altında mount edilir) üç paralel girdi
yolu sunar; hepsi aynı `EstimateJobResponse` şeklini döner.

### 1.1 Metin/açıklamadan maliyet önerisi

```bash
oe_api POST /api/v1/ai/quick-estimate/ '{
  "description": "Zemin kat betonarme duvar imalatı, 120 m2, Istanbul",
  "building_type": "residential",
  "area_m2": 120,
  "location": "Istanbul",
  "currency": "TRY",
  "classification_standard": "din276"
}'
```

`router.py`'nin docstring'i yanıtın içeriğini birebir tanımlar: üretilen BOQ
kalemleri (`ordinal`, `description`, `unit`, `quantity`, `unit_rate`,
`total`), sınıflandırma kodları (DIN 276 / NRM / MasterFormat), token
kullanımı ve işlem süresi.

### 1.2 Fotoğraftan maliyet önerisi

```bash
# oe_api_file() için bkz. deploy/blackbox/README.md § 3.2
oe cp ./saha-fotograf.jpg backend:/tmp/saha-fotograf.jpg
oe_api_file POST /api/v1/ai/photo-estimate/ /tmp/saha-fotograf.jpg \
  -F location="Istanbul" -F currency="TRY"
```

`router.py`'nin docstring'i akışı üç adıma ayırır: (1) bina tipi, boyutlar ve
malzemeler tanımlanır, (2) görünür elemanlardan miktar tahmini yapılır,
(3) gerçekçi birim fiyatlarla bir BOQ üretilir. Kabul edilen biçimler JPEG/
PNG/WebP/GIF'tir; yükleme boyutu sınırlanmamıştır (ürün kararı, kendi riskini
taşır) ama ilk birkaç bayt bir **magic-byte** kontrolünden geçer — `Content-
Type` başlığı `image/png` dese bile içerik gerçekten bir resim değilse 415
ile reddedilir.

### 1.3 Herhangi bir dosyadan (PDF/Excel/CAD/görüntü) maliyet önerisi

```bash
oe_api_file POST /api/v1/ai/file-estimate/ /tmp/firma-kesif.pdf \
  -F location="Istanbul" -F currency="TRY"
```

Kabul edilen uzantılar (`router.py`, `_EXT_CATEGORY`): `.pdf`, `.xlsx`,
`.xls`, `.csv`, `.rvt`, `.rfa`, `.ifc`, `.dwg`, `.jpg`/`.jpeg`, `.png`,
`.webp`, `.gif`, `.tiff`, `.bmp`. Her kategori kendi magic-byte izin
listesine karşı doğrulanır (CSV/metin hariç — güvenilir bir imzası yoktur).

### 1.4 Güven skoru (confidence) — gerçek alan, ama her modelde yok

`EstimateItem.confidence` (`schemas.py`) `float | None` — **modelin kendisi
bir güven skoru üretirse** `[0, 1]` aralığına indirgenip (`_coerce_confidence`,
0–100 arası bir yüzde olarak gelirse de normalize edilir) taşınır; model
hiç güven skoru üretmezse alan **boş kalır, uydurma bir değer yazılmaz**
(`service.py` yorumu, birebir: *"Carry a real per-item confidence only when
the model supplied one"*). Pratik sonuç: iki farklı `quick-estimate` çağrısı
— biri Claude, biri yerel bir Ollama modeliyle — birinde `confidence: 0.82`
dönerken diğerinde `confidence: null` dönebilir; bu bir hata değil, modelin
kendi çıktısının farkıdır.

**Beklenen:** her üç uç nokta da bir `EstimateJobResponse` döner (`id`,
`status`, `items[]`, `currency`, `grand_total`); `items[]` içindeki her
kalemin `description`/`unit`/`quantity`/`unit_rate` alanları doludur,
`confidence` modele göre dolu veya `null` olabilir.

---

## 2. Eşleşmeyen kalemleri listele (Review Focus 3)

Görev metninin "eşleşme raporu" dediği şey, kaynaklarda **iki gerçek
katmana** karşılık gelir — biri `ai` modülünün kendi önizlemesi (hafif,
tek seferlik), biri `cost_match` modülünün tam inceleme kuyruğu (kalıcı,
denetlenebilir). İkisi de "hiçbir kalem sessizce düşmez" ilkesini farklı
güçte uygular; firma için önerilen akış, önce birinciyle hızlı bir önizleme,
sonra ikinciyle kalıcı bir karar kaydı almaktır.

### 2.1 Hafif katman — `ai` modülünün `enrich` önizlemesi

```bash
oe_api POST /api/v1/ai/estimate/<job_id>/enrich/ '{
  "region": "TR_NATIONAL", "currency": "TRY"
}'
```

`router.py`'nin docstring'i: *"For each item in a completed AI estimate,
performs vector similarity search (with text search fallback) against the
cost database. Returns matched cost items ranked by relevance score,
preferring items with matching units."* Asıl eşleştirici (`service.py`,
`_match_cost_items`) önce vektör araması, bulamazsa metin anahtar kelime
araması dener — bu, `cost_match`'in "exact first then semantic" sırasının
tersidir (burada "semantic first, keyword fallback"), **iki modülün ayrı
eşleştirme motorları** olduğunun kanıtıdır, aynı algoritma değildir.

**Yanıt şekli** (`enrich_estimate`, birebir):

```json
{
  "items": [
    {
      "index": 0,
      "description": "Zemin kat betonarme duvar imalatı",
      "unit": "m2",
      "ai_rate": 1850.0,
      "matches": [{"code": "...", "description": "...", "unit": "m2", "rate": 1790.5, "currency": "TRY", "region": "TR_NATIONAL", "score": 0.81}],
      "best_match": {"code": "...", "score": 0.81, "...": "..."}
    },
    {
      "index": 1,
      "description": "Özel firma detayı: entegre zemin ısıtmalı şap",
      "unit": "m2",
      "ai_rate": 420.0,
      "matches": [],
      "best_match": null
    }
  ],
  "region": "TR_NATIONAL",
  "total_matched": 1,
  "total_items": 2
}
```

**Burası Review Focus 3'ün çekirdeği:** `best_match: null` olan bir kalem,
listeden **çıkarılmaz** — `items[]` dizisinde kalır, yalnızca `matches: []`
ve `best_match: null` taşır. Firma, `total_matched` / `total_items`
farkından kaç kalemin eşleşmediğini doğrudan görür; hiçbir kalem API
yanıtından sessizce silinmez. (200 kalemi aşan uçtaki kalemler de aynı
kurala tabidir — `MAX_ENRICH_ITEMS` sınırının üzerindekiler `matches: []`,
`best_match: null` ile döner, **atlanmaz**, yalnızca o kalemler için arama
çalıştırılmaz; bu da yanıtta açıkça görünür, gizlenmez.)

**BOQ'a kaydederken de aynı ilke geçerlidir** — `create_boq_from_estimate`
(`service.py`) `apply_enriched: true` ile çağrıldığında, bir kalemin eşleşme
skoru `CONFIDENCE_MEDIUM_THRESHOLD` (0.62, Görev 1.1'de de anılan
`backend/app/core/match_service/config.py` sabiti) eşiğinin altındaysa veya
hiç eşleşme yoksa, pozisyon **AI'nin kendi tahmini oranıyla** oluşturulur
(silinmez, sıfırlanmaz) ve `position_metadata.cwicr_match.applied = false`
olarak işaretlenir — bu bayrak, "bir eşleşme bulundu ama güven eşiğini
geçmediği için kullanılmadı" ile "hiç eşleşme yoktu" arasındaki farkı
sonradan denetlenebilir kılar. Pozisyonun `validation_status` alanı her
zaman `"pending"` başlar — yani eşleşmeyen/zayıf eşleşen bir kalem de dahil
her pozisyon, ERP'nin genel doğrulama akışından (Görev 1.1 § 1.4) geçmeden
"onaylanmış" sayılmaz.

### 2.2 Tam inceleme kuyruğu — `cost_match` modülü (asıl "fiyat eşleme")

`cost_match` (`oe_cost_match`, `/api/v1/cost-match/` altında mount edilir)
görev başlığının "fiyat eşleme" ifadesiyle birebir örtüşen modüldür —
`manifest.py`'nin açıklaması: her satır dört güven katmanından (tier)
birine düşer, bir kişi her birini **onaylar, geçersiz kılar veya reddeder**.

**Adım 1 — bir toplu eşleme çalıştırması (run) oluştur:**

```bash
oe_api POST /api/v1/cost-match/runs/ '{
  "project_id": "<project-uuid>",
  "name": "Zemin kat keşif — Kasım 2026",
  "source_label": "Taşeron teklifi (PDF)",
  "cost_source": "cwicr",
  "region": "TR_NATIONAL",
  "candidate_limit": 40,
  "lines": [
    {"description": "Betonarme perde duvar C30/37", "unit": "m3", "quantity": 42.5, "source_ref": "P-014"},
    {"description": "Entegre zemin ısıtmalı şap (firma özel detayı)", "unit": "m2", "quantity": 120}
  ]
}'
```

`service.py`'nin `create_run` docstring'i: çağrı **eşzamanlı** skorlanır —
"birkaç yüz satır sınırlı bir aday havuzuna karşı bir istek, bir iş değildir"
— ve **hiçbir şey uygulanmaz**: her satır, hangi katmana düşerse düşsün
`pending` (beklemede) döner.

**Adım 2 — dört güven katmanı** (`models.py`, `matcher.py`'den birebir):

| Katman (`tier`) | Eşik | Anlamı |
|---|---|---|
| `exact` | normalize edilmiş dize tam eşit → skor `1.0` | kaynak satırın açıklaması, maliyet kaleminin açıklamasıyla (aksan/boşluk farkları giderilerek) birebir aynı |
| `high_confidence` | skor ≥ **0,75** (`HIGH_CONFIDENCE`) | güvenilir sayılır (yeşil) |
| `needs_review` | **0,45** ≤ skor < 0,75 (`REVIEW_CONFIDENCE`) | makul ama bir kişi karar vermeli |
| `unmatched` | skor < 0,45 | tabanda hiçbir şey sunmaya değer skor almadı |

Skor formülü (`matcher.py`, birebir): `0.65 * query_coverage + 0.35 *
term_overlap`, birim boyutu uyuşmazsa (ör. alan vs hacim) `0,55` çarpanıyla
cezalandırılır — bu üç faktör de yanıtın `factors` alanında şeffaf olarak
döner, yani bir skorun neden o olduğu denetlenebilir.

**Adım 3 — eşleşmeyen/incelenmesi gereken kalemleri listele:**

```bash
oe_api GET "/api/v1/cost-match/runs/<run_id>/review-queue?limit=100"
```

`router.py`'nin docstring'i, Review Focus 3'ün tam karşılığıdır: *"The
queue is the `needs_review` and `unmatched` tiers that nobody has ruled on
yet — the two where the machine is explicitly not claiming an answer."*
Yanıt (`MatchResultPage`) `total`/`items[]` taşır; her `MatchResultResponse`
satırının `tier`, `confidence`, `suggested_cost_item_id` (yoksa `null`),
`alternatives[]` (runner-up adaylar) ve `decision_state` (`pending` /
`confirmed` / `overridden` / `rejected`) alanları vardır. `unmatched`
katmanındaki bir satırın `suggested_cost_item_id`'si `null`dur — ama satırın
**kendisi** kuyrukta durur, API'den kaybolmaz.

**Adım 4 — her satır için karar ver (confirm / override / reject):**

```bash
# Öneriyi olduğu gibi kabul et (yalnızca bir öneri varsa çalışır)
oe_api POST /api/v1/cost-match/results/<result_id>/decision '{"decision": "confirmed"}'

# Başka bir kalemi seç (geçersiz kılma — unmatched bir satır için TEK yol budur,
# ama seçilen cost_item_id aynı kataloğun AKTİF bir kalemi olmalı, bkz. § 3)
oe_api POST /api/v1/cost-match/results/<result_id>/decision '{
  "decision": "overridden", "cost_item_id": "<yeni-rayic-item-id>"
}'

# Bu tabanda hiçbir şey uymuyor — bu da kaydedilen, sessiz olmayan bir karardır
oe_api POST /api/v1/cost-match/results/<result_id>/decision '{"decision": "rejected"}'
```

`service.py`'nin `record_decision` docstring'i üç kuralı birebir koyar:
- `confirmed` — satırın **zaten bir önerisi olmalı** (`suggested_cost_item_id`
  dolu); `unmatched` bir satırda öneri olmadığından `confirmed` denemesi
  `NoSuggestionToConfirmError` (422) ile reddedilir — yani eşleşmeyen bir
  kalem "öylece onaylanamaz", bu kasıtlı bir engeldir.
- `overridden` — bir `cost_item_id` **zorunludur**; hedef kalem, bu
  çalıştırmanın bağlı olduğu kataloğun (`cost_source`/`region`/
  `catalog_id`) **aktif** bir üyesi olmalıdır, yoksa `LookupError` → 404
  döner. Bu, `unmatched` bir satırı gerçekten fiyatlandırmanın tek yoludur
  — ve doğrudan § 3'teki manuel rayiç girişine bağlanır.
- `rejected` — hiçbir item id gerekmez; "bu tabanda hiçbir şey uymuyor"
  kararını kaydeder, satırı **icabına bakılmış** (ama fiyatsız) olarak
  işaretler; görülmemiş bir kalem gibi davranmaz.

Her karar, satırın geçmişine **eklenir** (`MatchDecisionResponse`'un
`decided_by`/`created_at`/`tier_at_decision` alanları) — bir önceki kararın
üzerine yazılmaz, fikir değişikliği de görünür kalır.

**Adım 5 — hiçbir şeyin beklemede kalmadığını kanıtla:**

```bash
oe_api POST /api/v1/cost-match/runs/<run_id>/validate
```

`validators.py`'deki **`cost_match.review_queue_cleared`** kuralı (WARNING,
tamlık kategorisi) tam olarak bu soruyu sorar: *"Lines still awaiting a
person are neither priced nor knowingly excluded."* Kural, her satırın
`decision_state`'ini tarar; en az bir `pending` satır varsa **başarısız**
döner ve kaç satırın hâlâ beklemede, kaçının zaten `rejected` olduğunu
raporlar. Bu, Review Focus 3'ün "hiçbir kalem sessizce atlanmadı" iddiasının
**sayısal kanıtıdır** — bir firma, bir çalıştırmayı "bitti" diyebilmek için
bu kuralın `OK` döndüğünü görmelidir.

**Beklenen:** (adım 1) `201` ile her satır `pending` olarak `MatchRunResponse`
içinde döner; (adım 3) `review-queue` yalnızca `needs_review`+`unmatched`
tierlerini döner; (adım 4) her üç karar türü de ilgili `MatchResultResponse.
decision_state`'i günceller; (adım 5) tüm satırlar karara bağlandığında
`cost_match.review_queue_cleared` `OK` (passed=true) döner.

---

## 3. Eşleşmeyen kalemler için manuel rayiç giriş yolu

Görev metninin "manuel rayiç giriş yolu" dediği şey, bu belgenin kaynaklarında
**ayrı bir uç nokta değildir** — Görev 0.3'te (`deploy/blackbox/README.md`
§ 3.1) zaten belgelenen `costs` modülünün tekil kalem ekleme yoluyla aynı
mekanizmadır; `cost_match`/`ai` modülleri bu kalemi **üretmez**, yalnızca
onu bulamadıklarını dürüstçe raporlar.

**İş akışı (uçtan uca):**

1. `ai`'nin `enrich` önizlemesinde (§ 2.1) `best_match: null` olan **veya**
   `cost_match`'in `review-queue`'sunda (§ 2.2) `unmatched` tierinde kalan
   bir kalem tespit edilir.
2. Bu kalem firmanın kataloğunda gerçekten yoksa, `deploy/blackbox/
   README.md` § 3.1 tablosundaki **"Tek bir kalem ekleme/düzeltme"** satırını
   kullanın — `costs.create` izni gerektirir:

   ```bash
   oe_api POST /api/v1/costs/ '{
     "code": "KAPLAN-SAP-ISI-01",
     "description": "Entegre zemin ısıtmalı şap (firma özel detayı)",
     "unit": "m2",
     "rate": "420.00",
     "currency": "TRY",
     "region": "KaplanBIM Firma Rayiçleri 2026",
     "classification": {"kaplanbim": "KAPLAN-SAP-ISI-01"}
   }'
   ```

   (Çok sayıda eşleşmeyen kalem birikmişse, bunun yerine
   `deploy/blackbox/README.md` § 3.2–3.3'teki Excel içe aktarma yolu —
   `POST /api/v1/costs/import/file/` — toplu olarak kullanılabilir;
   mekanizma aynıdır, yalnızca ölçek farklıdır.)
3. **`ai` tarafı için:** yeni kalem kataloğa girdikten sonra, aynı
   `enrich` çağrısını (§ 2.1) **yeniden çalıştırın** — `_match_cost_items`
   her çağrıda canlı veritabanına karşı arama yaptığından (önbelleğe
   alınmış bir "hiç eşleşme yok" durumu yoktur), yeni eklenen kalem artık
   bir aday olarak görünebilir.
4. **`cost_match` tarafı için:** yeni kalemin `item_id`'siyle, aynı
   `unmatched` sonucu üzerinde `overridden` kararı verin (§ 2.2 Adım 4) —
   `record_decision`'ın aktiflik kontrolü artık geçer, çünkü kalem gerçekten
   o kataloğun bir üyesidir.
5. Her iki yolda da **asla** şu yapılmaz: eşleşmeyen bir kalemi listeden
   silmek veya rastgele bir eşleşmeyi "yeterince yakın" diye zorla kabul
   etmek. Kalem ya gerçek bir rayiçle eşleşir (yeni eklenerek veya var
   olan bir kalem seçilerek), ya da `rejected` kararıyla "bu tabanda
   karşılığı yok" olarak açıkça işaretlenir — ikisi de denetlenebilir bir
   iz bırakır, sessiz bir boşluk bırakmaz.

> **Dürüst boşluk — rayiçin kaynağı bu belgede tanımlanmamıştır.** "Manuel
> rayiç" girerken kullanılacak fiyatın nereden geleceği (firmanın kendi
> piyasa araştırması, bir önceki ihale, resmi bir TR_NATIONAL kalemi
> referans alınarak türetilmiş bir oran) bu görevin kaynaklarında
> **belirtilmemiştir** — bu, firmanın kendi maliyet mühendisliği sürecinin
> konusudur, ERP yalnızca o sayının nereye yazılacağını (§ yukarıdaki
> `POST /api/v1/costs/`) tanımlar.

---

## 4. Kalibrasyon iş akışı — Görev 1.3'te doldurulacak sapma kaydı

Bu bölüm, görevin kendi tanımındaki "sapma ölçümü kaydı" çıktısıdır. Aşağıdaki
tablo **kasıtlı olarak boştur** — Görev 1.3'te, canlı bir OpenConstructionERP
sunucusuna karşı gerçek bir `quick-estimate`/`photo-estimate` çağrısı ve
gerçek bir `cost_match` çalıştırması yapıldıktan sonra, her satır için
otomatik öneri ile insan kararının **ne kadar ayrıştığı** buraya kaydedilir.

### 4.1 Kayıt şablonu

| Tarih | Kaynak (`ai` job id / `cost_match` run id) | Kalem açıklaması | Otomatik öneri (rate + kaynak: AI tahmini / CWICR eşleşme kodu) | Otomatik güven (confidence / tier) | İnsan kararı (confirmed / overridden / rejected / manuel rayiç) | Nihai rate | Sapma (%) | Sapmanın olası nedeni |
|---|---|---|---|---|---|---|---|---|
| _(doldurulacak)_ | | | | | | | | |

**Sütun notları:**
- **Sapma (%)** = `(nihai rate - otomatik öneri rate) / otomatik öneri rate × 100`;
  otomatik öneri yoksa (`best_match: null` / `unmatched`, rejected/manuel
  rayiç) bu sütuna sayı yerine `"eşleşme yoktu"` yazılır — sıfır olarak
  **sayılmaz**, sıfır sapma ile "eşleşme yoktu" durumu istatistiksel olarak
  farklı şeylerdir.
- **Otomatik güven** sütununa `cost_match` satırları için `tier` (ör.
  `needs_review`, skor `0.58`) yazılır; `ai` modülü satırları için
  `EstimateItem.confidence` (model sağladıysa) **veya** `enrich`'in
  `best_match.score`'u yazılır — ikisi karıştırılmamalı, hangi alandan
  geldiği not edilmelidir.
- **Sapmanın olası nedeni** için önerilen kısa kategoriler: "bölgesel
  fiyat farkı", "firma özel detayı (kataloğa yeni eklendi)", "birim
  uyuşmazlığı (`unit_factor` cezası)", "model halüsinasyonu (AI rate
  gerçekçi değil)", "taban eski/güncel değil".

### 4.2 Toplu okuma — kalibrasyon özetini çekme

Kalibrasyon oturumunun sonunda, tek tek satırları elle toplamak yerine:

```bash
# Bir cost_match run'ının toplu sayaçları (counts), SQL'den canlı hesaplanır —
# "3 beklemede" diyen ama kuyruğu boş bir ekran güven kaybettirir, bu yüzden
# stored bir sayaç değil, her çağrıda yeniden toplanan bir sorgu sonucudur
# (service.py, MatchRunCounts docstring'i).
oe_api GET /api/v1/cost-match/runs/<run_id>

# Katman/karar kırılımına göre filtrelenmiş sonuç sayfaları
oe_api GET "/api/v1/cost-match/runs/<run_id>/results?tier=unmatched&decision_state=overridden"
```

`MatchRunCounts` alanları (`schemas.py`): `total`, `exact`,
`high_confidence`, `needs_review`, `unmatched`, `pending`, `confirmed`,
`overridden`, `rejected`, `queue_length`. Bu sayılar § 4.1 tablosunun satır
sayısıyla (o run'a ait satırlar için) birebir eşleşmelidir — eşleşmiyorsa
tablo eksik doldurulmuştur, API'nin sayımı değil.

---

## 5. Sorun giderme ve dürüst boşluklar

- **`quick-estimate`/`photo-estimate` 400 veya 401 ile başarısız oluyor.**
  § Adım 0'daki `POST /settings/test/` ile anahtarın geçerli olduğunu
  doğrulayın — `ai` modülü BYOK'tur, üründe gömülü bir anahtar yoktur.
- **İki farklı model çağrısı farklı `confidence` davranışı gösteriyor.**
  Beklenen — § 1.4'teki not: `confidence` yalnızca modelin kendisi
  ürettiğinde taşınır, aksi hâlde `null` kalır, uydurulmaz.
- **`enrich` çağrısı her zaman `best_match: null` dönüyor.** Önce vektör
  arama altyapısının (embedder/vektör DB) kurulu olup olmadığını kontrol
  edin — `_match_cost_items` bunu sessizce metin aramaya düşürür
  (`service.py` yorumu: *"Degrades gracefully"*), ama metin araması da boş
  dönüyorsa muhtemelen ilgili `region`'da hiç `costs` kalemi yoktur
  (Görev 0.2/0.3'ü kontrol edin).
- **`confirmed` denemesi 422 ile reddediliyor.** `unmatched` bir satırda
  öneri yoktur — bkz. § 2.2 Adım 4, `NoSuggestionToConfirmError`; bu satır
  için tek yol `overridden` (önce § 3'teki manuel rayiç) veya `rejected`'dır.
- **`overridden` denemesi 404 ile reddediliyor.** Seçilen `cost_item_id`,
  bu çalıştırmanın bağlı olduğu `cost_source`/`region`/`catalog_id`
  üçlüsünün **aktif** bir üyesi değildir — ya yanlış kataloğa bakıyorsunuz
  ya da § 3'teki manuel rayiç girişi henüz tamamlanmamış.
- **Dürüst boşluk — `match` (Element Match) ve `ai_estimator` (AI Estimate
  Builder) modüllerinin API yüzeyi bu belgede ayrıntılı işlenmedi** (§ 0) —
  bu görevin odağı `ai` + `cost_match` ikilisidir; bu iki modül canlı
  sistemde ayrıca keşfedilmelidir.
- **Dürüst boşluk — `advisor_chat` (`/ai/advisor/chat`) bu belgede
  anılmadı.** `router.py`'de gerçek bir uç nokta olarak vardır ("AI Cost
  Advisor chat") ama görev kapsamının (fiyat önerisi + eşleşmeyen kalem
  listesi) dışındadır.
- **Bu belgedeki hiçbir API çağrısı** gerçek bir OpenConstructionERP
  sunucusuna karşı çalıştırılmadı (bkz. belge başındaki not) — "Beklenen"
  satırları kabul kriteridir, gözlenmiş sonuç değildir. § 4'teki tablo da
  aynı nedenle bilerek boş bırakılmıştır.

---

## 6. Kapsam dışı bırakılanlar

- **AI Estimate Builder** (`ai_estimator`) — firmanın tüm verisinden tam
  fiyatlı bir tahmin taslağı çıkaran ayrı modül (§ 0); bu görevin
  kaynaklarında ayrıntılı incelenmedi.
- **Element Match** (`match`) — tekil bir BIM/PDF/DWG/foto elemanı için
  sıralı maliyet kalemi adayı döndüren modül (§ 0); Görev 1.1'in
  `match_elements` (toplu, yedi aşamalı) modülünün tekil kardeşi, bu
  belgede ayrıntılı işlenmedi.
- **`photo-category-suggest`** (`ai/router.py`) — bir fotoğrafı kategoriye
  (ör. "defect") ayıran, asla otomatik uygulanmayan ayrı bir öneri uç
  noktası; bu görevin "maliyet önerisi" odağının dışında.
- **`advisor_chat`** (`/ai/advisor/chat`) — serbest biçimli bir maliyet
  danışmanı sohbet arayüzü; bu görevin kapsamı değil.
- **Kalibrasyonun kendisi** (§ 4.1 tablosunun gerçek verilerle doldurulması)
  — Görev 1.3'ün kapsamı, burada yalnızca şablonu tanımlanmıştır.

---

## 7. Commit

```bash
git add deploy/blackbox/calibration.md
git commit -m "docs: AI estimate calibration record"
```
