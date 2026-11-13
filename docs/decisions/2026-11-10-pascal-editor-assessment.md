# Pascal Editor — bizim için faydalı mı?

- **Tarih:** 2026-11-10
- **İncelenen:** https://github.com/pascalorg/editor
- **Bağlam:** KaplanBIM + OpenConstructionERP + DDC-CWICR platformu (tek firma, Revit → IFC → keşif)

## Özet hüküm

**Gerçek ve ciddi bir proje, ama 25 bin yıldızın ima ettiğinden daha az örtüşme var — ve örtüşme beklediğimiz yerde değil.** Hiçbir parçası bütün olarak alınmamalı; üç şey ödünç alınmalı.

Doğrulanan künye: 25.461 yıldız, 3.166 çatal, **MIT**, 2026-10-16 oluşturuldu, 2026-11-11'e kadar aktif.

## Varsayımım yanlıştı

Pascal'ı "mimari/iç mekan, MEP değil" diye tanımlamıştım. **MEP'i var**: `packages/core/src/schema/nodes/` içinde `duct-segment`, `duct-fitting`, `duct-terminal`, `hvac-equipment`, `pipe-segment`, `pipe-fitting`, `pipe-trap`, `liquid-line`, `lineset`, `beam`, `column`, `structural-grid`. Dekoratif de değil — `services/system-graph.ts` port grafiği üzerinde bağlı bileşenler kuruyor (`COINCIDENT_EPS_M = 0.05`), `runLengthM`, `fittingCount`, `connectedToEquipment` raporluyor ("False = bağlantısız alt ağaç: hava hiçbir yere gitmiyor").

**Ama ABD konutu ölçeğinde**: `pipe-segment` yalnızca DWV — çap 1.25–8 inç, `pvc|abs|cast-iron`, eğim yolu IPC'ye göre varsayılmış. `build-up.ts` nominal kereste `2x4`–`2x12` sayıyor. `DECISIONS.md` önceliği "geometri → tesisat/MEP → … → render" olarak sıralıyor: MEP **sırada**, bitmiş değil.

## 1. Alan örtüşmesi

**Gerçek örtüşme:** site/bina/kat, katmanlı duvar montajları ve duvar *tipleri* (`schema/wall-type.ts`), açıklıklar, oda/bölge, döşeme, çatı, işaretli çizelgeler ve tipli satır modeli, PDF paftalar.

**Bizim daha derin olduğumuz yerler:**

| Konu | Pascal | KaplanBIM |
|------|--------|-----------|
| **IFC (mühendislik sözleşmesi)** | Export `ifc-converter/src/export/scene-to-ifc.ts` (1.729 satır) duvar/döşeme/kiriş/mekan yazıyor, **sıfır akış varlığı**: `grep -cE "IFCDUCT\|IFCPIPE\|IFCCABLECARRIER\|IFCFLOW"` = **0** | `packages/bim-ifc/src/mapping.ts:57-61` çalışma alanlarını `IfcDuctSegment`/`IfcPipeSegment`/`IfcCableCarrierSegment` + fitting'lere eşliyor; `import/read-products.ts:200,278` port, `IfcSystem` ve port birleşimlerini geri okuyor |
| **Çok kullanıcılı yazma** | yjs/CRDT yok; Zustand + IndexedDB + Zundo; self-host tek `PASCAL_ADMIN_PASSWORD` | Lease, Postgres commit, niyet çakışması (`services/bim-authority`) |
| **Tipli birimler / formüller** | Çıplak metre + imparatorluk sabitleri | `bim-units` + `bim-formula` |
| Fazlar, partisyonlar, ERP köprüsü | Yok | Var |

**Kritik sonuç:** Pascal'ın MEP'i uygulamadan MEP olarak **çıkamıyor** — IFC'sinde akış varlığı yok.

## 2. Bizde olmayan, onlarda olan

- **WebGPU + SSGI + TRAA** post-process (`viewer/.../post-processing.tsx`)
- **Walkthrough HUD** ve **WebXR** (`viewer/src/xr/presentation-context.tsx`) — bizim `bim-viewer-3d`'de crop-box/kat düzlemleri var, yürüyüş yok, XR yok, AO yok
- **Tarama referans çalışma zamanı**: `core/capture` (nokta bulutu yükleri, ARKit yörüngeleri) + `viewer/capture` katmanları
- **Gömülebilir bileşen seti** — `@pascal-app/viewer` düz Vite'ta çalışıyor
- **Ajan-bilgi dağıtımı**: skills.sh'te `skills/pascal-3d`, Claude/Cursor/Codex eklentileri, MCP Registry manifesti (`server.json`)

## 3. Mimari uyum

`@pascal-app/core` **tipli bir sahne grafiği**, mühendislik modeli değil: `{ nodes, rootNodeIds }` + materyaller + koleksiyonlar Zustand'da, tür başına zod, parent/child `hosts`, ve bağlantı **uzamsal olarak türetiliyor** (5 cm içinde çakışan portlar) — açık çift yönlü bağ yok, revizyon yok, commit yok.

**Viewer çekirdekten ayrılamaz**: `packages/viewer/src`'de `@pascal-app/core`'a **225 import** (101.716 satır), `core` peer dependency, README `useScene.getState().setScene(...)` şartı koyuyor. Yığın uyuşmazlığı: R3F 9.8.2 + three 0.187 + WebGPU, bizim `@thatopen/fragments` + three 0.185.1'e karşı; Radix/Tailwind UI, `bim-ui` CSS değişkenlerine karşı.

**Yani `<Viewer>`'ı kullanmak = onların sahne store'unu benimsemek ve bizimkini yeniden yazmak.**

## 4. Lisans ve yönetişim

Paket başına **MIT** ("Copyright (c) 2026 Pascal Group Inc."). CLA/DCO yok. Telemetri bulunamadı (posthog/gtag/sentry/segment grep'i temiz). Yerel MCP hesap istemiyor.

**Üç dikkat noktası:**
1. Hosted `editor.pascal.app` **ayrı şartlara** tabi; Architect çalışmaları "Pascal kredisi" tüketiyor (`cli/src/architect.ts:469`)
2. `DECISIONS.md` **özel bir depoyu** (`pascalorg/private-editor`) anıyor — hosted yetenekler OSS ağacının dışında
3. MIT ticari marka hakkı vermiyor

Tek firma, kendi barındırma için **yeterince temiz**.

## 5. Hüküm — ne alınmalı

| Parça | Karar | Gerekçe |
|-------|-------|---------|
| **Viewer** | **Teknik ödünç al, kod alma** | Walkthrough, X-ray/kesit görünüm ve AO'yu `bim-viewer-3d`'ye kendi three.js pass'lerimiz olarak taşı: **1–2 hafta**, 100 bin satırlık R3F yeniden yazımına karşı |
| **Model şeması** | **Görmezden gel** | Bizimki sayıldığı yerde daha derin. **Tek istisna:** IFC *import* sezgileri |
| **Scan-to-BIM** | **Deseni ödünç al, yapımı ertele** | Dürüst ve küçük: oturum konumlandırıcısı tutan bir `scan` düğümü + nokta bulutu katmanı; otomatik hiçbir şey çıkarılmıyor. Firma taraması varsa **~1 hafta** ve bizi Revit'in gidemediği yere koyar — ama "tarama → otomatik BIM" değil |
| **MCP / ajan becerileri** | **Seçerek ödünç al** | `wiki/architecture/agent-surfaces.md` zaten inandığımızı savunuyor: sözleşme/operasyon/yürütücü katmanları, "retler cevaptır" sabit kodlarla, sohbet+MCP+CLI için tek gerçekleme. `docs/SCRIPTING.md`'ye düzyazı olarak alınmalı. **Ama ajan araçları bizden ağır** (~25 araç, tek atımlık üreticiler dahil, artı `retired-tools.ts` geri çekme shim'i) ve **script'lere geri dönüyorlar** (`packages/geometry-script`, `add_object`) — bu bizim ≤10 araç kuralımızı **doğruluyor**. **Dağıtımı** kopyala (skills.sh, eklenti marketleri, `server.json`); ucuz |
| **CLI / self-hosting** | **Görmezden gel** | Onların konteyneri tek SQLite dosyası + tek parola; bizimki Postgres'li `docker compose up` |

## 6. İlk yapılacak: IFC import sınıflandırma katmanı

**Para yolundaki tek kalem bu** (Revit → IFC → keşif). Saf mantık, React/DOM yok, MIT, ve en zayıf halkamıza saldırıyor: **hiçbir keşfin fiyatlayamadığı `imported-mesh` çorbası.**

Pascal'ın `packages/ifc-converter/README.md`'deki sezgileri:
- duvar parçalarını merkez çizgisine birleştirme (L/T birleşimleri)
- `IfcSpace` → oda-bölge benimseme ("pole of inaccessibility" ile tohumlanmış)
- döşeme üstünü yürüme yüzeyi olarak alma
- `IfcDoor.OperationType`'tan kapı ailesi
- `Pset_DoorCommon.GlazingAreaFraction`'tan camlama

Bizim `import/read-products.ts` ürünleri/portları/sistemleri okuyor ama **bu tür sınıflandırmayı yapmıyor**. Mantığı taşı, paketi taşıma (çıktısı onların şemasına göre şekillenmiş).

**Dürüst maliyet: 3–5 mühendis-haftası**, gerçek Revit export'larıyla doğrulanmak üzere. Parametrik kapsam bizim eksiğimiz değil; **sınıflandırma eksiğimiz**.

---

## Ek — ilk incelemeden sonra bulunanlar

İlk tur "ilk yapılacak"a odaklanmıştı. Derinleştirince **iki şey beklediğimden büyük**, biri de beklemediğim yerde çıktı.

### 1. Walkthrough motoru bir HUD değil, tam bir yürüyüş motoru

İlk hükümde "walkthrough HUD'ını taşı" demiştim. `packages/viewer/src/components/viewer/` altına bakınca bunun bir motor olduğu görülüyor:

| Dosya | Ne yapıyor |
|-------|-----------|
| `first-person/build-collider-world.ts` | Modelden çarpışma dünyası kuruyor |
| `first-person/ground-holes.ts` | Zemin boşlukları (merdiven boşluğu, açıklıklar) |
| `first-person/terrain-collider.ts` | Arazi çarpışması |
| `first-person/mechanism-targets.ts` | **Açılabilir mekanizmalar** (kapılar) — hedef tespiti |
| `bvh-ecctrl.tsx` | BVH hızlandırmalı karakter denetleyicisi |
| `frame-limiter.tsx` | Kare bütçesi sınırlayıcı |
| `daylight-atmosphere.tsx` | Gün ışığı atmosferi |
| `drone-controller.tsx` | Drone/kuş bakışı denetleyici |
| `batched-mesh-spike.tsx` | Batch'leme performans denemesi |

**Bizim için değeri:** sahibi/müşteri için **bina içinde yürüyüş**, şantiye personeli için **oryantasyon**, ve çarpışma dünyası yeniden kullanılabilir ("buradan geçilebilir mi?" kontrolü). Bu, "1-2 haftalık görselleştirme süsü" değil — **4-6 haftalık gerçek bir modül**. Ticari bir BIM'de Revit bunu vermiyor; fark yaratan bir özellik.

**Önce yapılacak:** `build-collider-world` + `ground-holes` + `frame-limiter` (en küçük anlamlı dilim: modelde yürüyebilmek). `mechanism-targets` (kapı açma) ikinci dilim.

### 2. Performans teknikleri — 250 bin eleman bütçemize doğrudan dokunuyor

`batched-mesh-spike.tsx` ve `frame-limiter.tsx` bir tesadüf değil: büyük modellerde kare bütçesini korumak için yazılmış. Bizim `docs/PERFORMANCE.md`'de ölçülen 250.000 eleman bütçemiz var; onların batch'leme stratejisi ve kare sınırlayıcısı **doğrudan karşılaştırma malzemesi**. Kod alınmasa bile yaklaşım okunmalı.

### 3. Yerleşimi bizde olmayan iki saf algoritma

- **`core/src/lib/polygon-label.ts`** — polylabel: bir poligonun sınırına **en uzak iç nokta** (öncelik kuyruğu + dal-sınır). Oda adı, etiket, ölçü yazısı yerleştirmesi için tam aradığımız şey; bizim etiketlerimiz bugün çakışma çözümü yapmıyor. **Saf geometri, MIT, React yok** — doğrudan taşınabilir.
- **`core/src/utils/room-zone-migration.ts` + `lib/room-zone-adoption.ts`** — bir poligonu, `share` ve `cover` skorlamasıyla en iyi kapsayan yüze atama. Genel bir "poligonu en iyi kaba yerleştir" algoritması; oda/bölge/mekan işimizde işe yarar.

### 4. i18n'de bizden ileri oldukları üç küçük karar

Onlar kendi i18n'lerini **şu anda** yazıyor (`@experimental Unreleased API`, **Lingui** üzerine). Kütüphane değiştirmeyiz — i18next göçünü yeni bitirdik — ama üç tasarım kararı okunmaya değer:

- **Kapsamlı (scoped) i18n:** global tek örnek yerine **istek/görev yerel kapsam** (`PascalI18nProvider` bir scope bağlıyor). Bizim host-sahipli tek örnek yaklaşımımız tek firmada yeter; çok kiracılığa çıkarsak bu desen gerekir.
- **`assertSafeMessageKey`:** anahtarlarda `__proto__` reddi (prototype pollution). Bizim anahtarlar geliştirici yazımı olduğu için risk düşük — **ama firma tarafından düzenlenen bir sözlük/çeviri dosyası** bu kapıyı açabilir. Ucuz bir koruma, `i18n-parity` guard'ına bir satır.
- **`warnedMissingKeys`:** eksik anahtar uyarısını tekilleştirme. Bizde `missingKeyHandler` inert (R5) ve guard parity testine dayanıyor; onlarınki çalışma-anı tamamlayıcısı. İkisi birlikte doğru olurdu.

### 5. `DECISIONS.md` bir pratik olarak

Onların sadakat sıralaması ("geometri → tesisat/MEP → … → render") bir **öncelik sözleşmesi** olarak yazılmış. Bizim `AGENTS.md` + `ROADMAP.md` var ama "neye önce sadık kalınır" tek satırda yazılı değil. Küçük, ucuz, faydalı bir alışkanlık.

### 6. `retired-tools.ts` — bir uyarı

Geri çekmek istedikleri araç adlarına cevap vermek için bir shim tutuyorlar. **159 araç dersimizin** aynısını yaşıyorlar ve **script'lere geri dönüyorlar** (`packages/geometry-script`, `add_object`). Bizim ≤10 araç kuralımızın en iyi dış kanıtı bu.

---

## Güncellenmiş hüküm — ne alınmalı

| Parça | Karar | Efor |
|-------|-------|------|
| **IFC import sınıflandırma** | **ALINDI** (adım 1-3 bitti: veto, `element_type`, katmanlar→yüz m²) | ✅ |
| **Walkthrough motoru** | **Al** — en küçük dilim: çarpışma dünyası + zemin boşlukları + kare sınırlayıcı | **4-6 hafta** (ilk dilim ~2) |
| **`polygon-label` (polylabel)** | **ALINDI** — `bim-geometry/src/polygon-label.ts` (`polygonLabel`), test edilmiş (commit `60a12bf`); **henüz dışarıdan çağıran yok**, kernel `placement/label-seed.ts:16-21` kendi küçük kopyasını tutuyor | bağlamak ~1 gün |
| **`room-zone-adoption` skorlaması** | **ALINDI** — `bim-geometry/src/polygon-containment.ts` (`enclosingFits`, `bestEnclosingFace`), test edilmiş; **henüz çağıran yok** | bağlamak 2-3 gün |
| **Performans (batch + frame limiter)** | **Oku, ödünç al** — 250k eleman bütçemizle karşılaştır | **1-2 gün** |
| **i18n'den 3 küçük karar** | **Al** — `assertSafeMessageKey` guard'a, `warnedMissingKeys`, scoped deseni not et | **~1 gün** |
| **`DECISIONS.md` pratiği** | **Al** — sadakat sıralaması | saatler |
| Giydirme cephe (`IfcPlate`/`IfcMember`) | **Al** — kendi boşluk listemizden; örnekte 34 ürünün 25'i | 1-2 gün |
| Scan-to-BIM | Deseni al, yapımı ertele | ~1 hafta |
| Şema, UI kit, CLI, hosted krediler | **Alma** | — |

**Sıralama:** IFC adım 4-5 (kaplamalar, `IfcSpace` kalitesi) → polylabel + room-zone (ucuz, hemen görünür) → walkthrough ilk dilimi → performans okuması.

---

## Ek 2 — mimari wiki'de bizim çözemediğimiz iki problem

Pascal'ın kodundan çok **`wiki/architecture/` altındaki 30 belge** değerli çıktı. İkisi bizdeki gerçek bir eksiği adresliyor.

### 1. `wall-frame.md` — duvar referans çizgisi (bizim IFC planımızı düzeltiyor)

**Bizim bugünkü hatamız:** duvarın başlangıç/bitişini **gövde ayak izi dikdörtgeninin** uzun ekseninden türetiyoruz (`packages/bim-kernel/src/import/shape.ts:87-96`, `rectangleAxis`; çağıran `rules.ts:80`), çünkü import'ta IFC'nin **Axis** temsilini bilerek atıyoruz (`packages/bim-ifc/src/import/geometry.ts:154-160`, `bodyFirst`, yalnızca Body okunuyor). Yani gerçek referans çizgisini atıp, sonra onu gövdeden yeniden uyduruyoruz. Katmanlı duvarda bu, katman offset'lerini de kaybediyor (adım 3'te `OffsetFromReferenceLine` artık okunuyor, ama referans çizgisinin kendisi yok).

**Onların modeli:** saklanan `start → end` **referans çizgisidir**; gövde ondan yanal olarak `justification` ile kayar (**Inside/Center/Outside** ya da **A/Center/B**). Kalınlık düzenlemesi referansı **sabit tutar**. Birleşimlerde komşuların uçları kendi çizgileri boyunca yeni kesişime kaydırılır (`planWallMoveJunctions`), T-gövdeler ev sahibinin yakın yüzünde durur, çok kollu yelpazeler referans tepe noktasını korur.

**Neden önemli:** "duvarı kalınlaştır" bugün bizde referansı kaydırıyor, yani bitişik duvarlar kopuyor; onlarda referans sabit kaldığı için yüzler korunuyor. Odalar gövde merkez çizgilerini izler, dolayısıyla referansı yeniden tanımlamak odaları bozmuyor.

**Yapılacak:** IFC import'ta **Axis temsilini oku** ve referans çizgisini + `OffsetFromReferenceLine`'ı sakla; `shape.ts`'nin gövde-dikdörtgeni türetmesini yedek yol yap. **Bu, IFC planımızdaki adım 6'nın (duvar birleştirme + L/T) önkoşulu** — yanlış referans çizgisiyle birleşim yapmak, yanlış birleşim yapmaktır.

### 2. `space-detection.md` — odaları duvarlardan türetmek, ve **kimliği korumak**

Revizyon karşılaştırması yapan bir firma için asıl problem şu: **duvar değişince odanın miktarı ne olur?** Onların cevabı, bizde olmayan bir tasarım:

- Odalar **türetilmiş durumdur** ve duvar düzenlemesinin *parçası* olarak yeniden hesaplanır — sonradan bir arka plan işi değil. Yani tutarlılık inşa gereği.
- **Plaka (döşeme) eşleştirme önce ortak `zoneIds`'e, sonra poligon örtüşmesine bakar**, ve aynı kotta bölme düzenlemeleri boyunca **kimliği korur**. Emekliye ayrılan plaka sahipleri aynı yama kümesinde yeniden eşlenir.
- **Duvar silme:** paylaşılmayan bir oda sınırı, aynı referans çizgisi aralığında bir **ayırıcıya** dönüşür — oda kimliği, bitişleri, plakası ve tavanı korunur. Paylaşılan aralıklar ayırıcı almaz, komşu odalar birleşir.
- **Silme koruması**, saklanan oda poligonunun güncel bir yüzle **IoU ≥ 0.9** eşleşmesini şart koşar.
- İnsanın verdiği ad asla sessizce değişmez (`room_named_by_person` reddi).

**Bizim için değeri:** IFC'den oda alamasak bile (Revit odası olmayan modeller yaygın), duvar halkalarından oda türetmek ve **revizyonlar arasında oda kimliğini korumak** doğrudan metraj karşılaştırması demek. Duvarlarımız zaten `IfcRelConnectsPathElements` ile bağlanmıyor (araştırma: 0 isabet) — bu tasarım o boşluğun da cevabı.

### 3. Okuma listesi — geri kalanı

Aynı wiki'de bizde karşılığı olmayan başlıklar: `vertical-model.md` (dikey bağlantı, istiflenmiş asma kat odaları), `systems.md`, `layers.md`, `materials-and-themes.md`, `spatial-queries.md`, `selection-groups.md`/`selection-managers.md`, `renderers.md`, `viewer-isolation.md`, `construction-animation.md` (**inşaat sırası animasyonu** — Faz 3'ün 4D'sine görsel bir alternatif), `authored-objects.md`, `item-authoring.md`, `node-schemas.md`, `plugin-authoring.md`, `point-and-ask.md` (ajan UX deseni), `inspector-field-limits.md`.

Ayrıca **`contracts/cut-intent.ts`** — kesme/boşluk (void) niyetinin açık bir sözleşme olması. Biz `IfcRelVoidsElement`'i okuyoruz ama "kesme niyeti"ni ayrı bir kavram olarak tutmuyoruz.

### 4. Pratik olarak: bir mimari wiki tutmak

Onların 30 belgesi, kodla birlikte yaşayan ve **"neden böyle"** sorusunu cevaplayan bir kütüphane. Bizde `docs/ARCHITECTURE.md` tek belge. Bu oturumda tam da bu eksikliği yaşadık: her ajan aynı soruları yeniden keşfetti. **Mimari wiki'si en az kod kadar alınmaya değer.**

---

## Ek 2 hükmü

| Parça | Karar | Neden |
|-------|-------|-------|
| `wall-frame.md` modeli | **AL — IFC adım 6'nın önkoşulu** | Referans çizgisi + justification; gövde-dikdörtgeni türetmemiz kırılgan ve birleşimleri bozuyor |
| `space-detection.md` tasarımı | **AL (tasarım), kademeli uygula** | Oda türetme + **revizyonlar arası kimlik koruma** = metraj karşılaştırması |
| `vertical-model.md` | **Oku** | Dikey bağlantı; Faz 3'ün 4D'sinde işe yarar |
| `construction-animation.md` | **Oku** | 4D'ye görsel alternatif |
| `contracts/cut-intent.ts` | **Oku** | Kesme niyeti ayrı kavram |
| Mimari wiki pratiği | **AL** | Bu oturumun en pahalı dersi: bilgi kodda yaşıyor ama *neden*i yaşamıyor |
| Geri kalan wiki | Okuma listesi | — |
