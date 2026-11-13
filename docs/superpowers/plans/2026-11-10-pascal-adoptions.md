# Pascal'dan Alınacaklar — Implementation Planı

- **Tarih:** 2026-11-10
- **Dayanak:** `docs/decisions/2026-11-10-pascal-editor-assessment.md` (Ek 1 + Ek 2)
- **Amaç:** Karşılaştırmalı incelemede tespit edilen, Pascal Editor'ün bizden ileride olduğu **dört** alanı planlı biçimde kapatmak. Şema, UI kit, CLI ve hosted üretken ajan **alınmıyor** (farklı ürün tezi).

---

## Neden bu dört alan, ve neden bu sırayla

| Alan | Onların durumu | Bizim durumumuz | Neden bu sırada |
|------|----------------|-----------------|-----------------|
| **Render kalitesi** | SSGI + TRAA + gün ışığı atmosferi + oda başına gün ışığı, WebGPU | `WebGLRenderer` + ACES tone mapping; **post-processing yok, AO yok, temporal AA yok** (`viewer.ts:372-376`) | **Müşteri sunumuna dokunuyor.** En yüksek getiri/efor oranı: teknik, kod değil |
| **Walkthrough kalanı** | Çarpışma + kapı mekanizmaları + merdivenler + arazi + XR | İlk dilim var: yürü, duvardan geçme, duvar boyunca kay (`walkthrough.ts`, `collider-world.ts`) | Kapı ve merdiven olmadan yürüyüş **eksik** hissettiriyor; XR ayrı bir vaat |
| **Dağıtım** | 11 npm paketi, `npx @pascal-app/cli editor` | Monorepo + `docker compose`; paketleme ROADMAP'te "Then" | Firmanın BT'si için `npx` docker'dan çok daha kolay — **benimsemeyi belirliyor** |
| **Tarama referansı** | `core/capture`: nokta bulutu + ARKit yörüngeleri | Yok | En düşük öncelik: firma taraması **varsa** değerli, yoksa değil |

---

## Global kısıtlar (her göreve uygulanır)

1. **Görüntüleyici editör-agnostiktir** — `docs/architecture/viewers.md`. Editör importu yok, host varsayımı yok.
2. **Katman kuralı.** `import-layers.test.ts` yeşil kalır. Saf geometri `bim-geometry`'ye (katman 1), render `bim-viewer-3d`'ye (katman 5).
3. **Tema kuralı mutlak.** Her renk/font/yarıçap `--mutiny-*`; hex yok, inline renk yok; `theme-token-compliance.test.ts` yeşil.
4. **i18n.** Her görünür metin `t('<key>', '<English>')` + Türkçesi `packages/bim-editor/locales/tr/editor.json`. `i18n-negative-space.test.ts` bunu zorlar; `{{n}}` (tek süslü parantez değil).
5. **Performans bütçesi.** `docs/PERFORMANCE.md`'deki 250.000 eleman bütçesi bozulmaz. Her render eklemesi **ölçülür**, "güzel görünüyor" yetmez.
6. **Kernel dokunulmaz** bu planın hiçbir adımında (i18n/React/trade kelimesi girmez).
7. `bim-ifc/**` ve `bim-kernel/src/import/**` **dokunulmaz** — IFC işi oturdu.

## Review Focus (spec'in sessiz kaldığı, ama bir kullanıcının beklenti duyacağı yerler)

1. **AO/gölge açık sahnede de doğru mu** — kapalı mekanda güzel görünen AO, dış cephede leke yapmamalı.
2. **Temporal AA hareket hâlinde bulanıklaştırmıyor mu** — kamera dönerken kenarlar titrememeli ama iz de bırakmamalı.
3. **Yürürken kapıya çarpmak** — kapalı kapı geçilmez, açık kapı geçilir; "kapı var ama içinden geçiliyor" en kötü sonuç.
4. **Merdiven** — yürüyen merdiveni çıkabilmeli; merdiven bir duvar gibi davranırsa walkthrough işe yaramaz.
5. **`npx` ile kurulum** — paket yayınlandığında `npx ... editor` gerçekten çalışmalı; yarım paketlenmiş bir CLI, hiç olmamasından kötü.

---

## Aşama W1 — Render kalitesi (1-2 hafta)

> Çıkış: model hem içeriden hem dışarıdan "pahalı" görünüyor; ölçülen kare süresi bütçede.

### Task W1.1: Post-processing hattı + AO

**Files:**
- Modify: `packages/bim-viewer-3d/src/viewer.ts` (render döngüsü)
- Create: `packages/bim-viewer-3d/src/post/render-pipeline.ts`
- Create: `packages/bim-viewer-3d/src/post/ao.ts`
- Test: `packages/bim-viewer-3d/__tests__/post-pipeline.test.ts`

**Interfaces:**
- Produces: `createRenderPipeline(renderer, scene, camera, options): RenderPipeline`; `RenderPipeline.render(): void`, `.resize(w, h)`, `.dispose()`, `.stats(): { frameMs, passes }`
- Produces: `aoPass(camera, options): Pass` and the named constants `AO_INTENSITY`, `AO_RADIUS_M`, `AO_SAMPLES`

- [ ] **Başarısız test:** `createRenderPipeline` yok
- [ ] **Uygula:** `EffectComposer` + AO geçişi. **Sıra önemli**: AO → tone mapping → çıktı; ters sırada AO yanlış görünür. Bu sırayı yorumda yaz.
- [ ] **Test:** hat kurulur, `render()` bir kare üretir, `resize` geçişleri yeniden boyutlar, `dispose` kaynakları bırakır
- [ ] **Ölç:** `tools/perf` ile önce/sonra kare süresi; **bütçe içinde** olduğunu sayıyla göster
- [ ] **Commit:** `feat(viewer): a render pipeline with ambient occlusion`

### Task W1.2: Temporal AA

**Files:**
- Create: `packages/bim-viewer-3d/src/post/taa.ts`
- Test: `packages/bim-viewer-3d/__tests__/post-taa.test.ts`

- [ ] Sabitler: `TAA_JITTER_SAMPLES`, `TAA_BLEND`
- [ ] Hareket hâlinde **bulanıklık** önlemi: kamera hareket ederken blend düşer. Eşiği sabit ve gerekçeli yaz.
- [ ] **Review Focus 2'yi test et:** hareketli karede blend düşüyor mu (sayısal), duran karede tam blend mi
- [ ] **Commit:** `feat(viewer): temporal anti-aliasing that steps aside while the camera moves`

### Task W1.3: Gün ışığı atmosferi + oda başına gün ışığı

**Files:**
- Create: `packages/bim-viewer-3d/src/atmosphere/daylight.ts`
- Create: `packages/bim-viewer-3d/src/atmosphere/room-daylight.ts`
- Modify: `packages/bim-viewer-3d/src/light.ts`
- Test: `packages/bim-viewer-3d/__tests__/daylight.test.ts`

- [ ] Güneş konumu/yoğunluğu mevcut `light.ts` ile çakışmasın — **tek kaynak** olsun
- [ ] Oda gün ışığı: `docs/architecture/spaces.md`'deki mekan kayıtlarını kullan; oda başına aydınlık düzeyi türet
- [ ] **Review Focus 1'i test et:** dış cephede AO/gölge lekesi yok (sentetik bir sahne, dış yüzeyin ortalama parlaklığı iç yüzeyden yüksek)
- [ ] **Commit:** `feat(viewer): daylight, and how much of it reaches each room`

### Task W1.4: Render kalitesi inceleme paketi

**Files:** Create: `docs/render-quality.md` (ne açık, hangi sabit ne için, nasıl ölçülür)

- [ ] Işık/karanlık temada **gözle** kontrol et (AGENTS.md kural 3). Tarayıcı gerektiği için raporda "görmedim" diye **dürüstçe** yaz.
- [ ] **Commit:** `docs: what the render pipeline does and how to measure it`

---

## Aşama W2 — Walkthrough kalanı (2-4 hafta)

> Çıkış: bir kapıyı açıp geçebiliyorsun, merdiveni çıkabiliyorsun. XR ayrı bir aşama.

### Task W2.1: Kapı mekanizmaları (Review Focus 3)

**Files:**
- Modify: `packages/bim-viewer-3d/src/walkthrough-collider.ts`
- Create: `packages/bim-viewer-3d/src/walkthrough-mechanisms.ts`
- Modify: `packages/bim-kernel/src/import/**` — **hayır**: kapı zaten `opening` kuralıyla import ediliyor; mekanizma **görüntüleyicide** modellenir
- Test: `packages/bim-viewer-3d/__tests__/walkthrough-doors.test.ts`

**Interfaces:**
- Produces: `doorStateAt(elementId): 'closed' | 'open' | 'ajar'`; `toggleDoor(elementId): void`
- Produces: kapı gövdesi çarpışma dünyasından **çıkarılır** açıkken

- [ ] **Review Focus 3'ü test et:** kapalı kapıdan geçilemez, açık kapıdan geçilir. Bu iki test bu görevin varlık sebebi.
- [ ] Bir kapının açık/kapalı hâli **modelde** değil, oturumda tutulur (modeli kirletme). Kararını gerekçelendir.
- [ ] **Commit:** `feat(viewer): a closed door stops you, an open one does not`

### Task W2.2: Merdivenler ve kat geçişi (Review Focus 4)

**Files:**
- Modify: `packages/bim-viewer-3d/src/walkthrough.ts` (zemin bulucu)
- Create: `packages/bim-viewer-3d/src/walkthrough-stairs.ts`
- Test: `packages/bim-viewer-3d/__tests__/walkthrough-stairs.test.ts`

- [ ] Zemin bulucu artık **eğimli** yüzeyleri de kabul eder (merdiven rampası), ama düşey yüzeyi kabul etmez
- [ ] Kat değişince çarpışma dünyası **o kata** kurulur (zaten böyle — `collider-world.ts`'nin ızgara gerekçesi)
- [ ] **Review Focus 4'ü test et:** merdiveni çıkmak yükseklik kazandırır; duvar yükseklik kazandırmaz
- [ ] **Commit:** `feat(viewer): you can take the stairs`

### Task W2.3: XR sunumu

**Files:**
- Create: `packages/bim-viewer-3d/src/xr/presentation.ts`
- Test: yok — tarayıcı/cihaz gerekir. Raporda **"test edilemedi"** yaz, uydurma.

- [ ] `navigator.xr` yoksa **hiç görünme** (tema kapısı gibi: sunulmayan bir düğme, kırık bir düğmeden iyidir)
- [ ] `i18n`: düğme metni `t()` ile
- [ ] **Commit:** `feat(viewer): presentation in a headset, where the browser offers one`

---

## Aşama D — Dağıtım (1 hafta)

### Task D1: `npx` ile çalışan editör

**Files:**
- Create: `packages/bim-cli/package.json`, `packages/bim-cli/src/index.ts`
- Modify: `docs/QUICKSTART.md` (yoksa oluştur)
- Test: `packages/bim-cli/__tests__/cli.test.ts`

**Interfaces:** `mutinybim editor [--port] [--data-dir]` — yerel model sunucusu + editör, tek komut.

- [ ] **İlk adım: ölç.** Bugün `npm run demo` ne kadar sürüyor, kaç MB indiriyor? Hedefi sayıyla koy.
- [ ] CLI **paketlenebilir** mi: `packages/bim-editor` build çıktısı üretiyor mu, yoksa kaynaktan mı çalışıyor? Bunu tespit et ve raporla — bu, işin gerçek büyüklüğünü belirler.
- [ ] Review Focus 5: `npm pack` + temiz bir dizinde `npx` ile **gerçekten** çalıştır. "Yarım paket CLI" yasak.
- [ ] **Commit:** `feat(cli): one command to a running editor`

### Task D2: Paket sınırları

**Files:** Modify: her paketin `package.json` (`exports`, `files`, `main`/`types`)

- [ ] Hangi paket yayınlanabilir, hangisi iç? Karar ver ve yaz. Pascal 11 paket yayınlıyor; bizim her paketimiz yayınlanabilir olmak zorunda değil.
- [ ] `@thatopen/fragments` gibi ağır bağımlılıkların **peer** olarak mı, dependency olarak mı gittiğini doğrula
- [ ] **Commit:** `chore: which packages publish, and what each one carries`

---

## Aşama S — Tarama referansı (1 hafta, en düşük öncelik)

### Task S1: Nokta bulutu referans katmanı

**Files:** Create: `packages/bim-viewer-3d/src/capture/point-cloud.ts`, `packages/bim-kernel/src/import/scan.ts`

- [ ] Bir `scan` kaydı (oturum konumlandırıcısı) + nokta bulutu katmanı — Pascal'ın deseni bu kadar; **otomatik çıkarım yok**, olduğunu iddia etme
- [ ] Önce sor: **firmanın taraması var mı?** Yoksa bu görev yapılmaz. Raporda bunu sor ve **cevabı olmadan başlama**.
- [ ] **Commit:** `feat(viewer): a point cloud as reference, when a scan exists`

---

## Yapılmayacaklar (ve neden)

| Pascal'da var | Neden almıyoruz |
|---|---|
| Sahne store'u / R3F şeması | Viewer çekirdekten ayrılamıyor (225 import, 101k satır). Bizim kayıt+sync çekirdeğimiz daha derin |
| UI kit (Radix/Tailwind) | `bim-ui` + `--mutiny-*` sözleşmemiz var; ikinci bir tema dili zarar |
| CLI'nin kendi runtime indirmesi | Bizimki Docker + Postgres; onlarınki tek SQLite dosyası |
| Hosted üretken ajan ("Architect") | Farklı ürün tezi (kredi tüketen hosted servis) |
| Construction reveal / otomatik çerçeveleme | Bizim 4D'miz ERP'de (`5d_planner`); model üzerinde animasyon başka bir iş |
| Otomatik oda-türetimi (tam hâli) | Oda **kimliği** kısmını aldık (`room-identity`); duvarlardan tam oda türetme, gerçek Revit modelleriyle doğrulanmadan riskli |

---

## Ölçüm

- **Render:** kare süresi (öncesi/sonrası), `tools/perf` bütçesi içinde
- **Walkthrough:** kapalı kapı geçilmez / açık kapı geçilir / merdiven yükseklik kazandırır — üç test
- **Dağıtım:** temiz dizinde `npx` ile çalışan editör, ölçülen indirme boyutu ve açılış süresi
- **Her aşama sonunda:** `npx jest` tam yeşil (bilinen `integrations/*` hariç), `tsc` temiz, guard'lar yeşil
