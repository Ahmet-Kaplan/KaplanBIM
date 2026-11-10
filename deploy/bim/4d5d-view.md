# KaplanBIM üzerinde model tabanlı 4D/5D görselleştirme

Bu belge **Görev 3.2**'nin çıktısıdır: Faz 3'ün "keşif → iş programı → nakit
akışı otomatik" hedefinin KaplanBIM (MutinyBIM) tarafını belgeler. **4D**
(program → faz → renk) KaplanBIM'in kendi faz/kuruluş kavramlarıyla görünür;
**5D** (maliyet/nakit akışı) ise modele **asla** fiyat yazılmadan, görüntülenme
anında OpenConstructionERP'den okunur.

> **Bu ortamda doğrulanmadı.** Bu geliştirme ortamında ayağa kaldırılmış ne
> bir KaplanBIM model sunucusu (`deploy/bim/README.md`: imaj indirme/`up`
> yapılmadı) ne de bir OpenConstructionERP sunucusu (`deploy/README.md`
> başındaki aynı not) vardır. Aşağıdaki "adım"ların **hiçbiri** canlı
> çalıştırılıp ekranda renkli fazlar ya da TL tutarlı bir nakit akışı olarak
> gözlemlenmemiştir. KaplanBIM tarafında yazılan her şey gerçek kaynak
> dosyalardan/kavramlardan **birebir** alıntılanır (uydurma API yoktur); ERP
> uç noktaları ise Görev 3.1'in `deploy/erp/4d5d-setup.md` belgesine bağlanır.
> "Beklenen:" satırları canlı kurulumda gözlenmesi gereken sonuçtur.

---

## 0. Kaynaklar ve isim düzeltmeleri

### 0.1 Bu belgede alıntılanan gerçek KaplanBIM kavramları

| Kavram | Dosya | Ne söylüyor (özet, birebir) |
|---|---|---|
| Grup + faz + faz filtresi | `packages/bim-kernel/src/organization/model.ts` | "A group is a named bucket every model element belongs to … A phase is a step in time … every element is created in one phase and may be demolished in a later one. A view shows the model as of its phase through a phase filter." |
| Elemanın grup/faz aidiyeti | aynı dosya | Her eleman `groupId` ve `phaseCreated` taşır; grupsuz → "General", fazsız → "New construction". |
| Grup rengi | aynı dosya (`GroupEntry`) | `readonly color: string;` — "#rrggbb, for swatches in lists and the status bar." |
| Faz listesi | aynı dosya (`PhaseEntry`, `PhaseFilterEntry`) | Faz: `{ type: "phase", name, order }`; faz filtresi: `statuses` ile `new/existing/demolished/temporary` → `show/halftone/dashed/hide`. Varsayılan fazlar: "Existing", "New construction". |
| Modelde para yok (kernel) | `packages/bim-kernel/src/cost/sources.ts`, `cost/price.ts` | `price.ts`: "nothing is written to the model, a changeset or the model server, and no model command accepts money." `sources.ts`: "Nothing here writes to a model." |
| Maliyet yuvaları "reserved" | `packages/bim-kernel/src/qto/types.ts` (§ "Cost slots (reserved; no prices are built in round 7)") | KaplanBIM'in kendi fiyatlandırma katmanı **henüz tam bağlı değil** (round 7'de rezerve). |
| Görünümde faz/grup gösterimi | `packages/bim-viewer-3d/src/live-display.ts`, `viewer.ts` | Açık görünümün faz, faz filtresi ve grup ayarlarına göre elemanlar çizilir/gizlenir (`displayResolver`). |
| Görüntüleme stili (renk) rezerve | `packages/bim-viewer-3d/src/render-style-point.ts` | "Render styles (reserved …). The shape is settled … nothing reads the point yet." |

### 0.2 Brief'teki modül adları → gerçek adlar

Görev 3.1'de zaten düzeltildi (`deploy/erp/4d5d-setup.md` § 0.2); burada
tekrarlanır:

| Brief'te | Gerçek modül | Önek |
|---|---|---|
| `scheduling` | `schedule` (4D) | `/api/v1/schedule` |
| `5d_planner` | **yok** → `costmodel` (5D) | `/api/v1/costmodel` |
| — | `full_evm` (tahmin/uyarı) | `/api/v1/full-evm` |

---

## 1. KaplanBIM'de zaten var olan şey (uydurmadan)

4D/5D görselleştirme sıfırdan bir API icat etmez; KaplanBIM'in **mevcut**
kuruluş (`organization`) ve maliyet (`cost`) kavramlarını kullanır:

1. **Fazlar gerçek.** `organization` modelindeki `PhaseEntry` listesi
   (`{ type: "phase", name, order }`) modelin kendisinde, `organization`
   türünde birer model elemanı olarak yaşar — yani senkronize olur, çakışır,
   geri alınır. Her eleman `phaseCreated` ile bir fazda "inşa edilir",
   gerekirse sonraki fazda `demolished` işaretlenir.
2. **Gruplar gerçek ve renk taşır.** `GroupEntry.color` (#rrggbb) zaten var;
   listelerde ve durum çubuğunda renk örneği (swatch) olarak kullanılır.
   Varsayılan gruplar: General `#64748b`, Existing to remain `#a16207`,
   New work `#2563eb`, Demolition `#dc2626`, Coordination `#7c3aed`.
3. **Faz filtresi gerçek.** `PhaseFilterEntry.statuses`, `new/existing/
   demolished/temporary` durumlarını `show/halftone/dashed/hide` ile çizer.
   "Görünüm, modeli kendi fazı itibarıyla gösterir" ifadesinin somutlaştığı
   yer burasıdır. 3D görüntüleyici bunu zaten uygular (`live-display.ts`).
4. **Modelde para yok, gerçekten yok.** `ARCHITECTURE.md` birebir:
   *"No money in the model. Models hold quantities. Prices come from the
   reader's own cost source at read time."* Kernel'de `cost/price.ts` bunu
   kodla sabitler: fiyatlama yalnızca okuyanın sürecinde yapılır, modele,
   changeset'e veya model sunucusuna **hiçbir şey yazılmaz**, hiçbir model
   komutu para kabul etmez.

> Dürüst sınır: KaplanBIM'in **kendi** fiyatlandırma katmanı round 7'de
> "reserved" durumda (`qto/types.ts`). Yani bugün fiyatı modelden çekebilecek
> bir `price` motoru henüz tam bağlı değil — bu, 5D için bir eksik değil,
> tam da ilkenin kendisi: fiyat zaten modele girmeyecek; ERP'den okunacak.

---

## 2. 4D — Program verisini modele bağla (faz renkleri)

4D'nin KaplanBIM tarafı tek cümleyle: **ERP'deki program görevlerini
KaplanBIM fazlarına eşle; görünümü faz filtresiyle zamanda gezdir.** Renk,
gruplarda zaten var olan `color` kavramının fazlara taşınmış hâlidir.

### Adım 1 — ERP tarafı hazır olsun (Görev 3.1'in çıktısı)

Program, ERP `schedule` modülünde keşiften üretilmiş olmalı
(`deploy/erp/4d5d-setup.md` § Adım 1):

```bash
# schedule: BOQ'dan faaliyet üret → Gantt → kritik yol
oe_api POST /api/v1/schedule/schedules/<schedule_id>/generate-from-boq/
oe_api POST /api/v1/schedule/schedules/<schedule_id>/calculate-cpm/
oe_api GET  /api/v1/schedule/schedules/<schedule_id>/gantt/
oe_api GET  /api/v1/schedule/critical-path/
```

**Beklenen:** her faaliyet bir BOQ bölümü/pozisyonuna bağlıdır; Gantt, kritik
yol ve erken/geç tarihler döner.

### Adım 2 — Program görevlerini KaplanBIM fazlarına eşle

KaplanBIM'de faz listesi genişletilebilir (`organization` modeli). 4D için:

- Her **program görevi** (ya da kullanıcının seçtiği daha kaba **zaman
  penceresi**) bir `PhaseEntry`'ye karşılık gelir (`{ type: "phase", name,
  order }`). `order`, fazların zaman sırasıdır; programın erken/geç tarihleri
  sırayı belirler.
- Bir eleman, yapıldığı göreve karşılık gelen fazda `phaseCreated` ile
  işaretlenir; yıkım işleri sonraki fazda yıkılır (`demolished`).
- Görev → faz eşlemesi, Task 3.1 § 1.4'teki BIM bağıyla aynı doğruluk
  kaynağını kullanır: ERP tarafında `PATCH /api/v1/schedule/activities/
  <activity_id>/bim-links/` bir faaliyeti BIM elemanlarına bağlar; KaplanBIM
  tarafında aynı elemanlar karşılık gelen faza konur.

**Beklenen:** model elemanları, hangi görevde yapılacaksa o faza aittir.

### Adım 3 — Zamana göre görünüm (faz filtresi)

KaplanBIM'in mevcut faz filtresi (`PhaseFilterEntry.statuses`) "modeli X
tarihi itibarıyla göster" işini zaten yapar. Bir **zaman penceresi** seçmek,
bir faz filtresi seçmek demektir:

- Pencereden önce tamamlanan fazlar → `existing` (halftone/dashed),
- pencerede yapılanlar → `new` (show),
- henüz başlamamışlar → `temporary`/`hide`.

Görüntüleyici bu kararı zaten `displayResolver` ile uygular
(`bim-viewer-3d/src/live-display.ts`). Bir kaydırıcı (zaman çizelgesi) yalnızca
"hangi faz filtresinin aktif olduğunu" değiştirir; çizim motoruna yeni bir şey
gerekmez.

### Adım 4 — Renk

Dürüst ayrım:

- **Grupların rengi gerçek** (`GroupEntry.color`) ve zaten durum çubuğunda/
  listelerde görünür.
- **Faza ait renk doğrudan kernel'de yoktur.** `PhaseEntry`'de `color` alanı
  **yoktur** — yalnızca `name` ve `order` vardır. Görüntüleme stili
  (`render-style-point.ts`) ise "reserved, nothing reads the point yet"
  durumundadır.

Yani 4D "faz renkleri" bir **görüntüleyici katmanı eşlemesidir**: faz başına
bir renk atanır ve 3D/plan görünümü elemanı fazına göre boyar. Bu eşleme,
grup renkleri gibi görüntüleyicinin zaten sahip olduğu renk mekanizmasını
(`bim-viewer-3d/src/viewer-colors.ts`, kategori renkleri) fazlara uygulamaktan
ibarettir; kernel'e yeni bir komut eklemez.

**Beklenen:** zaman çizelgesi ilerletildikçe elemanlar fazlarına göre
renklenir, pencereden önce yıkılanlar dashed/yerine göre gizlenir.

---

## 3. 5D — Maliyet/nakit akışını ERP'den okuma anında göster

### 3.1 İlke: modelde para yok

Spec § 3 Kısıt #4 birebir: *"Modeller yalnızca miktar tutar; fiyatlar okuma
anında maliyet kaynağından (ERP/CWICR) gelir."* KaplanBIM tarafında bunun
karşılığı iki yerde sabittir:

- `docs/ARCHITECTURE.md` → "No money in the model."
- `packages/bim-kernel/src/cost/price.ts` → "no model command accepts money."

Bu yüzden 5D görünümünde **modele TL tutarı, birim fiyat ya da nakit akışı
yazılmaz.** Model yalnızca miktarları (takeoff/QTO) taşır; maliyet, görünüm
çizildiği anda ERP'den istenir.

### 3.2 Görüntüleme akışı

KaplanBIM tarafında 5D panosu, modeldeki miktarları **okur**, maliyeti ise
ERP'den **okuma anında** çeker:

```text
KaplanBIM görünümü (miktar)          OpenConstructionERP (fiyat)
  ───────────────────────            ────────────────────────────────
  model elemanı → faz/grup            costmodel: S-eğrisi, nakit akışı, EVM
  takeoff/QTO miktarları              full_evm: tahmin (EAC/TCPI), uyarılar
        │                                      │
        └─────────────► okuma anında ◄──────────┘
                    TL tutarları yalnızca
                    görüntülemede (overlay/panel)
```

Somut uç noktalar (Görev 3.1 § Adım 2'den birebir; burada tekrar üretilmez,
yalnızca bağlanır):

```bash
oe_api GET /api/v1/costmodel/projects/<project_id>/5d/s-curve/      # S-eğrisi
oe_api GET /api/v1/costmodel/projects/<project_id>/5d/cash-flow/    # nakit akışı
oe_api GET /api/v1/costmodel/projects/<project_id>/5d/evm/          # kazanılmış değer
oe_api GET /api/v1/costmodel/projects/<project_id>/5d/dashboard/    # 5D panosu
oe_api GET /api/v1/full-evm/forecasts/alerts/                       # sapma uyarıları
```

**Beklenen:** S-eğrisi (PV), kazanılmış değer (EV) ve fiili maliyet (AC) aynı
zaman ekseninde; SPI/CPI indeksleri `evm`/`dashboard` yanıtlarında. Bu
değerler KaplanBIM'de modelin **yanında** bir panel/overlay olarak görünür —
modelin içine değil.

### 3.3 Kazanılmış değer görünümü ile faz renklerinin bağı

"Model üzerinde kazanılmış değer görünümü" (brief Step 2'nin "kazanılmış
değer görünümü" ifadesi) şöyle kurulur: EVM, **faz/görev başına** ERP'den
okunur ve aynı görev→faz eşlemesiyle (Bölüm 2, Adım 2) faz renklerinin yanına
yerleştirilir. Rengin kendisi maliyeti **göstermez** — renk program/faz
durumunu gösterir; TL tutarı ayrı bir etikettir. Bu ayrım, "renk = faz
durumu, sayı = ERP'den fiyat" kuralını korur ve ilkeyi bozmaz.

---

## 4. Doğrulama — keşif kalemi değişince ne güncellenir

Bu, spec Başarı Ölçütü Faz 3'ün ("Keşif değişince program ve nakit akışı
otomatik güncelleniyor ve model üzerinde görünüyor") KaplanBIM tarafıdır.
Zincir, Görev 3.1 § Adım 4'ten birebir: **keşif miktarı değişir → BOQ tutarı
değişir → faaliyet süresi/maliyeti değişir → S-eğrisi/nakit akışı değişir.**
Buna 4D halkası eklenir: görev süresi değişirse faz sırası/pencere değişir →
faz renkleri kayar.

### 4.1 ERP tarafı (canlı, bu ortamda doğrulanmadı)

```bash
# 1. BOQ pozisyon miktarını değiştir (keşif değişikliği)
# 2. Program etkisi
oe_api POST /api/v1/schedule/schedules/<schedule_id>/diff
# 3. Miktar sapması
oe_api GET /api/v1/progress/quantity-variance/
# 4. 5D kayması (§ 3.2'deki s-curve / cash-flow / evm yeniden çekilir)
# 5. BOQ yeniden doğrula
oe_api POST /api/v1/boqs/{id}/validate/
```

**Beklenen:** etkilenen faaliyetler listelenir; S-eğrisi/nakit akışı değişen
pozisyonun tutarına göre kayar.

### 4.2 KaplanBIM tarafı (canlı, bu ortamda doğrulanmadı)

1. ERP'deki değişiklik bir **görev süresini/tarihini** değiştirdiyse, görev→faz
   eşlemesi yenilenir: faz `order`/pencere kayar.
2. KaplanBIM görünümü aynı zaman penceresinde yeniden çizilir; `phaseCreated`/
   `demolished` aidiyetleri değişen elemanlar yeni faz rengine geçer.
3. 5D paneli, § 3.2'deki uç noktaları **yeniden okur** — modelde tutulan hiçbir
   fiyat güncellenmez, çünkü modelde fiyat yoktur; yalnızca görüntü tazelenir.

**Beklenen:** program/nakit akışı ve modelin faz renkleri, keşif değişikliğini
takiben güncellenir.

> **Dürüst sınır (Görev 3.1'den tekrar):** Bu zincirin uçtan uca **otomatik**
> mi yoksa insan tetiklemeli mi çalıştığı (`generate-from-boq`,
> `generate-cash-flow` yeniden çağrısı gerekir mi) bu ortamda ayrıştırılamadı.
> `costmodel/events.py` gibi dosyalar olay-güdümlü bir yolun muhtemel olduğuna
> işaret eder ama doğrulanmamıştır. KaplanBIM tarafında da "ERP değişince
> model kendiliğinden yenilenir" diye bir mekanizma **yoktur** — model
> sunucusu yalnızca model değişikliklerini yayar; ERP'deki değişikliği
> KaplanBIM'e taşıyan köprü (API adapter) Task 3.2'nin ötesinde, Faz 3
> entegrasyonunun kendisidir. "Otomatik güncelleme" bugün **belgelenmiş bir
> beklentidir, kodlanmış bir davranış değildir.**

---

## 5. Kapsam dışı / açık sorular

1. **Faza renk alanı yok.** Kernel'de `PhaseEntry`'de renk yoktur; faz rengi
   bir görüntüleyici eşlemesidir. Kalıcı çözüm ya görüntüleyici katmanında
   (bu belgede önerilen) ya da `render-style-point` dolu hale geldiğinde
   render stili olarak kurulur — ikisi de kod gerektirir, bu belge yalnızca
   nereye gideceğini işaretler.
2. **KaplanBIM'in kendi fiyat katmanı "reserved".** `cost` yuvaları round 7'de
   rezerve; bugün fiyatı modelden çekebilecek motor tam bağlı değil. 5D, bu
   yüzden tamamen ERP'den okunur (ilkeye uygun).
3. **Otomatik vs insan tetiklemeli güncelleme** ayrıştırılamadı (§ 4.2'deki
   dürüst sınır). Faz 3'ün kabul kriteri, canlı sunucuda bunun saptanmasıdır.
4. **IFC içe aktarma.** Revit IFC'lerinin KaplanBIM'e içe alınıp yerel modele
   dönüştürülmesi hazır değil (`deploy/bim/README.md` § "IFC içe aktarma
   durumu"). 4D faz renkleri bugün yalnızca **yerel (native) KaplanBIM
   modelleri** üzerinde anlamlıdır; Revit kaynaklı geometrinin fazlara
   bağlanması IFC köprüsünün ilerlemesine bağlıdır.
5. **Görev→faz eşlemesinin çift yönlü tutulması.** Hem ERP `bim-links` hem
   KaplanBIM `phaseCreated` aynı elemanı işaret eder; iki listenin tek
   doğruluk kaynağı (hangisi ana) Faz 3 entegrasyonunda netleşir.
