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
