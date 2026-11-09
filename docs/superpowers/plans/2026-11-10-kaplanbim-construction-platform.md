# KaplanBIM İnşaat Platformu Implementation Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tek inşaat firması için Revit→IFC→otomatik metraj/keşif→BOQ→(sonra) AI asistan→4D/5D akışını çalıştıran, kendi kendine barınan entegre platformu kurmak.

**Architecture:** OpenConstructionERP sistemin kaydı (BOQ, takeoff, AI maliyet, CWICR gömülü); KaplanBIM tarayıcı görüntüleyici + MCP tabanlı AI ajan katmanı; köprü Revit'in yerleşik IFC export'u + ERP FastAPI. DDC Skills ajanın inşaat alanı becerilerini sağlar. Maliyet verisi yalnızca ERP'de yaşar ("modelde para yok").

**Tech Stack:** OpenConstructionERP (Python 3.12+/FastAPI/React 18/PostgreSQL 16/LanceDB-Qdrant) · KaplanBIM (TypeScript monorepo: kernel/editor/viewer/mcp/model server, Node 22.13+) · Docker Compose v2 · DDC Skills (SKILL.md kütüphanesi).

**Spec:** `docs/superpowers/specs/2026-11-10-kaplanbim-construction-platform-design.md`

## Global Constraints

- Revit kalıcı çizim aracıdır; köprü Revit'in yerleşik (ücretsiz) IFC export'udur.
- Tek Linux sunucusu (firma içi veya VPS) + Docker Compose; ekipsiz işletilebilirlik.
- "Modelde para yok": maliyet/fiyat yalnızca OpenConstructionERP'de; KaplanBIM yalnızca miktar.
- KaplanBIM MCP script-first: çekirdek araç paketi ≤10 araç; yeni özellik script API'si olarak eklenir.
- Kullanıcı arayüzü Türkçe.
- Lisans: yalnızca iç kullanım; dışarı dağıtım/satış yok; `cad2data` kapalı kaynak dönüştürücüleri kullanılmaz.
- Sürümler: Node 22.13+, Python 3.12+, PostgreSQL 16+, Docker Compose v2.

## Review Focus

1. **Eksik parametreli Revit modeli** → takeoff boş miktar döner. Beklenen: hangi elemanların/parametrelerin atlandığını gösteren rapor, sessiz boş sonuç değil. → Task 0.4'te doğrulanır.
2. **Yanlış IFC origin/birim** → miktarlar hatalı olur. Beklenen: yüklemede birim/origin kontrolü + uyarı. → Task 0.4'te doğrulanır.
3. **Türkiye Birim Fiyat kalem eksikliği** → eşleşme oranı düşer. Beklenen: eşleşmeyen kalem listesi + manuel rayiç giriş yolu. → Task 1.2'de doğrulanır.
4. **İki kullanıcı aynı modeli düzenler** (KaplanBIM) → çakışma. Beklenen: çakışma kelimelerle reddedilir, son yazan kazanmaz. → Task 2.1'de doğrulanır.
5. **ERP/KaplanBIM kimlik uyumsuzluğu** → erişim reddi. Beklenen: tek oturum (SSO), açık hata mesajı. → Task 2.2'de doğrulanır.

---

## Faz 0 — Temel: ERP kurulumu ve Revit→IFC akışı

> Çıkış: Çalışan OpenConstructionERP, yüklü Türkiye maliyet tabanı, örnek modelden otomatik metraj + BOQ taslağı.

### Task 0.1: Sunucu ve OpenConstructionERP kurulumu

**Files:**
- Create: `deploy/erp/.env` (POSTGRES_PASSWORD, JWT_SECRET — şifre üreteciyle)
- Create: `deploy/erp/docker-compose.prod.yml` (upstream `docker-compose.prod.yml` + HTTPS reverse proxy)
- Create: `deploy/README.md` (kurulum/yedekleme runbook'u)

**Interfaces:**
- Produces: `https://<sunucu>` üzerinde çalışan ERP; `POSTGRES_PASSWORD`, `JWT_SECRET` değerleri sonraki görevlere girdi.

- [ ] **Step 1: Sunucu ön koşullarını doğrula**

Run: `docker compose version && git --version && make --version`
Expected: Compose v2, Git, make sürümleri basılır.

- [ ] **Step 2: OpenConstructionERP'yi klonla ve kur**

Run: `git clone --depth 1 https://github.com/datadrivenconstruction/OpenConstructionERP.git /opt/openconstructionerp`
Run: `/opt/openconstructionerp` içinde `make quickstart`
Expected: `<http://localhost:8080>` açılır; sign-in ekranında demo hesaplar görünür.

- [ ] **Step 3: Üretim yapılandırmasına geç**

Run: `SEED_DEMO=false` ile `docker-compose.prod.yml`; 8080 önüne HTTPS reverse proxy (Caddy/Nginx).
Expected: `https://<sunucu>` yalnızca HTTPS ile açılır; demo hesabı yok.

- [ ] **Step 4: Yedekleme runbook'unu yaz ve ilk yedeği doğrula**

Run: `deploy/README.md` içinde `pg_dump` tabanlı yedek + geri yükleme komutları.
Expected: Yedek alınır ve temiz bir Postgres'e geri yüklenip uygulama açılır.

- [ ] **Step 5: Commit**

```bash
git add deploy/
git commit -m "feat: OpenConstructionERP production deploy + backup runbook"
```

### Task 0.2: Türkiye Birim Fiyat maliyet tabanını yükle

**Files:**
- Modify: `deploy/README.md` (maliyet tabanı yükleme prosedürü eklenir)

**Interfaces:**
- Consumes: Task 0.1'deki çalışan ERP + `POSTGRES_PASSWORD`.
- Produces: ERP `costs` modülünde aktif `Europe-Turkey-Birim-Fiyat` bölgesi; `GET /api/v1/costs/regions` içinde `TR` girişi.

- [ ] **Step 1: DDC Skills `6_OpenConstructionERP` "Load Cost Bases — TR" skill'ini oku**

Run: `read` ile `6_OpenConstructionERP/` içindeki ilgili `SKILL.md`.
Expected: Yükleme komutları ve doğrulama adımları not edilir.

- [ ] **Step 2: Türkiye maliyet tabanını yükle**

Run: skill'deki prosedür (ERP arayüzü veya API ile CWICR TR bölgesi içe aktarımı).
Expected: `GET /api/v1/costs/regions` → `TR` bölgesi ve beklenen kalem sayısı döner.

- [ ] **Step 3: Örnek bir kalemde birim fiyatı doğrula**

Run: `GET /api/v1/costs/items?region=TR&query=<bilinen bir kalem>` (ör. beton C25/30).
Expected: Kalem döner ve birim fiyat TL cinsinden görünür.

- [ ] **Step 4: Commit**

```bash
git add deploy/README.md
git commit -m "docs: Turkey cost base load procedure"
```

### Task 0.3: Firma BlackBox başlangıcı ve Excel içe aktarım yolu

**Files:**
- Create: `deploy/blackbox/README.md` (BlackBox içerik + yapılandırma talimatı)

**Interfaces:**
- Consumes: Task 0.2'deki TR maliyet tabanı.
- Produces: ERP `costs`/`assemblies`/`catalog` içinde firma sınıflandırması ve içe aktarılmış rayiçler.

- [ ] **Step 1: Firma sınıflandırma/birim faktörlerini ERP BlackBox'a tanımla**

Run: ERP `costs` + `assemblies` arayüzleri (DDC Skills "BOQ & Estimating" rehberliğinde).
Expected: Firma kalem listesi ERP'de düzenlenebilir durumda.

- [ ] **Step 2: Mevcut Excel rayiç/keşif şablonlarını içe aktar**

Run: ERP içe aktarma sihirbazı (CSV/XLSX) ile örnek bir firma keşfi.
Expected: Kuru çalışma (dry run) + geri alma çalışır; kalemler `costs` içinde görünür.

- [ ] **Step 3: Commit**

```bash
git add deploy/blackbox/
git commit -m "docs: firm BlackBox setup + Excel import path"
```

### Task 0.4: Örnek Revit modelinden otomatik metraj + BOQ taslağı

**Files:**
- Create: `deploy/erp/import-check.md` (IFC yükleme kontrol listesi)

**Interfaces:**
- Consumes: Task 0.3'teki BlackBox; Revit'ten ihraç edilmiş örnek `.ifc`.
- Produces: ERP `boq` içinde örnek projenin BOQ taslağı; atlanan-eleman raporu.

- [ ] **Step 1: Revit'ten örnek modeli IFC olarak ihraç et (yerleşik export)**

Run: Revit → File → Export → IFC (IFC4, doğru origin/birim).
Expected: `.ifc` dosyası üretilir.

- [ ] **Step 2: IFC'yi ERP'ye yükle ve takeoff çalıştır**

Run: ERP `bim_hub`/`takeoff` arayüzü ile `.ifc` yükle + takeoff.
Expected: Eleman tablosu + miktarlar üretilir.

- [ ] **Step 3: Boş/atlanan eleman raporunu doğrula (Review Focus 1)**

Run: `report.json`/`summary.json` çıktısını incele.
Expected: Atlanan eleman/parametre listesi açıkça görünür; boşsa sessizce boş miktar dönmez.

- [ ] **Step 4: Birim/origin kontrolü (Review Focus 2)**

Run: `import-check.md` listesiyle birim (mm/m) ve origin (survey/internal) tutarlılığını doğrula.
Expected: Yanlış birim/origin tespit edilirse uyarı verilir; düzeltilir.

- [ ] **Step 5: BOQ taslağını üret ve doğrula**

Run: ERP `boq` ile miktarları BlackBox kalemlerine eşle.
Expected: Örnek projede BOQ taslağı açılır; kalemler TR rayiçle fiyatlanabilir durumda.

- [ ] **Step 6: Commit**

```bash
git add deploy/erp/import-check.md
git commit -m "docs: IFC import checklist for takeoff"
```

---

## Faz 1 — Otomatik metraj + keşif

> Çıkış: Revit modelinden onaylanabilir, güvenilir keşif; manuel Excel metrajı devre dışı.

### Task 1.1: QTO kural setleri ve eşleme konfigürasyonu

**Files:**
- Create: `deploy/blackbox/qto-rules.md` (disiplin/aile/tip kural listesi)

**Interfaces:**
- Consumes: Task 0.4'teki çalışan takeoff.
- Produces: ERP `takeoff`/`validation` içinde firma QTO kuralları; `match-elements` eşlemesi.

- [ ] **Step 1: Disiplin/aile/tip başına QTO kural setlerini tanımla**

Run: ERP `takeoff` + `requirements` + `validation` (DDC Skills "BIM & CAD Takeoff" rehberliğinde).
Expected: Her disiplin için kural seti kaydedilir.

- [ ] **Step 2: `match-elements` 7 aşamalı eşlemeyi çalıştır ve sonucu incele**

Run: ERP `match-elements` ile örnek model eşlemesi.
Expected: Model elemanları → maliyet kalemleri eşleme oranı raporlanır.

- [ ] **Step 3: Commit**

```bash
git add deploy/blackbox/qto-rules.md
git commit -m "docs: firm QTO rule sets"
```

### Task 1.2: AI Estimate (fiyat eşleme) ve kalibrasyon

**Files:**
- Create: `deploy/blackbox/calibration.md` (sapma ölçümü kaydı)

**Interfaces:**
- Consumes: Task 1.1 eşlemesi; Task 0.2 TR maliyet tabanı.
- Produces: ERP `ai` (AI Estimate) aktif; eşleşmeyen kalem listesi + manuel rayiç giriş yolu.

- [ ] **Step 1: AI Estimate'i aç ve fiyat eşlemeyi çalıştır**

Run: ERP `ai` modülü ile metin/açıklama veya fotoğraftan maliyet önerisi.
Expected: Önerilen maliyet kalemleri + güven skoru görünür.

- [ ] **Step 2: Eşleşmeyen kalemleri listele (Review Focus 3)**

Run: eşleşme raporunu incele.
Expected: Eşleşmeyen kalemler açık listelenir; her biri için manuel rayiç giriş yolu çalışır.

- [ ] **Step 3: Commit**

```bash
git add deploy/blackbox/calibration.md
git commit -m "docs: AI estimate calibration record"
```

### Task 1.3: Keşif kalibrasyonu ve kabul

**Files:**
- Modify: `deploy/blackbox/calibration.md`

**Interfaces:**
- Consumes: Task 1.2 sonuçları; firmanın manuel keşfi (referans).
- Produces: Kabul edilen sapma raporu; firma onayı.

- [ ] **Step 1: Otomatik keşfi manuel keşifle karşılaştır**

Run: Aynı örnek model için otomatik keşif vs firmanın manuel Excel keşfi.
Expected: Kalem bazında sapma tablosu; toplam maliyet sapması hesaplanır.

- [ ] **Step 2: Hedef sapmayı doğrula (toplam <%3, kalem bazında doğrulanabilir)**

Run: sapma tablosunu spec başarı ölçütüyle karşılaştır.
Expected: Hedef dışı kalemler için BlackBox düzeltmesi yapılır ve tekrar ölçülür.

- [ ] **Step 3: Firma onayını al (manuel metraj devre dışı)**

Run: Kalibrasyon raporunu firmaya sun.
Expected: Firma, keşfi artık Excel'de elle yapmayacağını teyit eder.

- [ ] **Step 4: Commit**

```bash
git add deploy/blackbox/calibration.md
git commit -m "docs: estimate calibration acceptance"
```

---

## Faz 2 — BIM görüntüleyici + AI asistan

> Çıkış: Revit'siz tarayıcı erişimi + model/ERP verisi üzerine doğal dille sorgu.

### Task 2.0: Karar kapısı — LLM/gizlilik ve SSO

**Files:**
- Create: `docs/decisions/2026-11-10-llm-and-sso.md`

**Interfaces:**
- Produces: LLM seçimi (üçüncü taraf API vs self-hosted) ve idP seçimi; Task 2.2/2.4'ün girdisi.

- [ ] **Step 1: LLM/veri gizliliği kararını firmayla netleştir**

Run: Firma verisinin üçüncü taraf LLM'e gidip gidemeyeceğini teyit et.
Expected: Karar yazılır (API sağlayıcı adı ya da self-hosted model).

- [ ] **Step 2: SSO idP'sini seç**

Run: Basit iç OIDC mi, mevcut firma hesabı mı — seç ve gerekçeyi yaz.
Expected: idP kararı ve bağlantı bilgisi kaydedilir.

- [ ] **Step 3: Commit**

```bash
git add docs/decisions/2026-11-10-llm-and-sso.md
git commit -m "docs: LLM privacy and SSO decisions"
```

### Task 2.1: KaplanBIM kurulumu ve IFC içe aktarma doğrulaması

**Files:**
- Create: `deploy/bim/docker-compose.yml` (Postgres + model server + editor)

**Interfaces:**
- Consumes: Task 0.1 sunucu; Revit'ten ihraç edilmiş `.ifc`.
- Produces: Çalışan KaplanBIM editor/model server; IFC içe aktarma yeterlilik raporu.

- [ ] **Step 1: KaplanBIM'i Docker Compose ile kur**

Run: `docker compose up --build` (KaplanBIM `docker-compose.yml`).
Expected: `<http://localhost:3095/m/demo?view=plan>` editörü açılır; model server Postgres'e bağlanır.

- [ ] **Step 2: IFC içe aktarma yeterliliğini doğrula**

Run: Örnek `.ifc`'yi KaplanBIM'e yükle (linked-reference/IFC conversion yolu).
Expected: Model tarayıcıda görünür ya da eksiklik somut olarak raporlanır (spec açık kalem 3).

- [ ] **Step 3: Çakışma davranışını doğrula (Review Focus 4)**

Run: İki sekmede aynı modelde aynı alanı düzenle.
Expected: İkinci düzenleyici çakışma reddi alır, kelimelerle açıklanır; son yazan kazanmaz.

- [ ] **Step 4: Commit**

```bash
git add deploy/bim/
git commit -m "feat: KaplanBIM stack + IFC import verification"
```

### Task 2.2: SSO (tek kimlik) kurulumu

**Files:**
- Create: `deploy/sso/README.md`

**Interfaces:**
- Consumes: Task 2.0 idP kararı; Task 0.1 ERP; Task 2.1 KaplanBIM.
- Produces: ERP ve KaplanBIM aynı kimliği doğrular; tek oturum.

- [ ] **Step 1: idP'yi iki sisteme bağla**

Run: ERP sign-in + KaplanBIM model server sign-in'ini aynı idP'ye yönlendir.
Expected: İki sistemde aynı hesapla giriş yapılır.

- [ ] **Step 2: Kimlik uyumsuzluğu davranışını doğrula (Review Focus 5)**

Run: Geçersiz/süresi dolmuş token ile API çağrısı.
Expected: Net hata mesajı (401) döner, sessiz kabul yok.

- [ ] **Step 3: Commit**

```bash
git add deploy/sso/
git commit -m "feat: single sign-on for ERP + BIM"
```

### Task 2.3: API köprüsü (KaplanBIM ajanı → ERP)

**Files:**
- Create: `integrations/erp-bridge/src/client.ts` (ERP FastAPI istemcisi)
- Create: `integrations/erp-bridge/src/queries.ts` (BOQ/maliyet/miktar sorguları)
- Test: `integrations/erp-bridge/test/client.test.ts`

**Interfaces:**
- Consumes: ERP `GET /api/v1/...` (boq, costs, items) uçları; Task 2.2 SSO token'ı.
- Produces: `queryBoq(projectId: string): Promise<Boq>` ve `queryCostItem(region: string, query: string): Promise<CostItem[]>` — Task 2.4 bunları kullanır.

- [ ] **Step 1: Başarısız testi yaz**

```ts
test("queryBoq returns positions for a project", async () => {
  const boq = await queryBoq("demo-project");
  expect(boq.positions.length).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run: `npx vitest run test/client.test.ts`
Expected: FAIL (fonksiyon tanımsız).

- [ ] **Step 3: `queryBoq`/`queryCostItem` imzalarını uygula**

`client.ts` içinde ERP base URL + auth; `queries.ts` içinde tip güvenli sorgular.

- [ ] **Step 4: Testin geçtiğini doğrula**

Run: `npx vitest run test/client.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add integrations/erp-bridge/
git commit -m "feat: ERP API bridge client"
```

### Task 2.4: AI asistan sohbet katmanı

**Files:**
- Create: `integrations/assistant/src/chat.ts` (KaplanBIM MCP + DDC Skills + ERP bridge yönlendirme)
- Create: `integrations/assistant/README.md`

**Interfaces:**
- Consumes: KaplanBIM MCP (script-first, ≤10 çekirdek araç), Task 2.3 `queryBoq`/`queryCostItem`, DDC Skills.
- Produces: Doğal dilde soruları yanıtlayan asistan ("3. kattaki kanal metrajı ne?", "bu kalem neden bütçeyi aştı?").

- [ ] **Step 1: Asistanı KaplanBIM MCP + ERP bridge'e bağla**

Run: MCP sunucusunu (stdio/HTTP) yapılandır; ajan script yazar → kontrol → uygular.
Expected: Ajan modele script ile okuma yapabilir; ERP verisini sorgulayabilir.

- [ ] **Step 2: Örnek soruları doğrula**

Run: "3. kattaki havalandırma kanalı metrajı ne?" ve "bu kalem neden bütçeyi aştı?" sorularını yönelt.
Expected: Model miktarı + ERP maliyeti birleştiren doğru yanıt döner.

- [ ] **Step 3: Saha erişimini doğrula**

Run: Revit kurulu olmayan bir kullanıcıyla tarayıcıdan modele eriş.
Expected: Plan/3D görüntüleme çalışır.

- [ ] **Step 4: Commit**

```bash
git add integrations/assistant/
git commit -m "feat: AI assistant over BIM + ERP"
```

---

## Faz 3 — 4D/5D

> Çıkış: Keşif → iş programı → nakit akışı otomatik bağlantısı ve model üzerinde görselleştirme.

### Task 3.1: ERP scheduling + 5D maliyet modeli

**Files:**
- Create: `deploy/erp/4d5d-setup.md`

**Interfaces:**
- Consumes: Task 1.3'te kabul edilen keşif.
- Produces: ERP `scheduling`/`5d_planner` içinde program + nakit akışı modeli.

- [ ] **Step 1: İş programını keşfe bağla**

Run: ERP `scheduling`/`advanced_schedule` ile BOQ kalemlerinden program türet.
Expected: Program, keşif kalemlerinden üretilir.

- [ ] **Step 2: 5D nakit akışını kur**

Run: ERP `5d_planner`/`costmodel` ile S-eğrisi + nakit akışı projeksiyonu.
Expected: Nakit akışı ve kazanılmış değer görünür.

- [ ] **Step 3: Commit**

```bash
git add deploy/erp/4d5d-setup.md
git commit -m "docs: 4D/5D setup"
```

### Task 3.2: Model üzerinde 4D/5D görselleştirme

**Files:**
- Create: `deploy/bim/4d5d-view.md`

**Interfaces:**
- Consumes: Task 3.1 program/nakit akışı; Task 2.1 KaplanBIM modeli.
- Produces: KaplanBIM'de faz renkleri + kazanılmış değer görünümü (maliyet ERP'den okuma anında).

- [ ] **Step 1: Program verisini modele bağla (faz renkleri)**

Run: KaplanBIM modeline program fazlarını eşle; görünümde renklendir.
Expected: Model üzerinde zamana göre faz renkleri görünür.

- [ ] **Step 2: Keşif değişince otomatik güncellemeyi doğrula**

Run: ERP'de bir keşif kalemini değiştir.
Expected: Program/nakit akışı ve model görünümü otomatik güncellenir.

- [ ] **Step 3: Commit**

```bash
git add deploy/bim/4d5d-view.md
git commit -m "docs: model-based 4D/5D view"
```

---

## Self-Review Notları

- **Spec kapsamı:** Faz 0–3 tüm spec hedeflerine karşılık geliyor (otomatik metraj, AI asistan, 4D/5D, SSO, Türkçe arayüz). Açık kalemler (Türkiye veri tazeliği → 0.2, IFC içe aktarma → 2.1, LLM gizliliği → 2.0, RVT-Revitsiz → ertelenmiş) ilgili görevlerde doğrulanıyor.
- **Karar kapıları:** Task 2.0 (LLM/SSO) spec'in "Faz 2'de netleşir" dediği tek kararı, kodlamadan önce zorunlu adım yapar.
- **Review Focus:** 5 girdi sınıfının her biri sahibi göreve bağlandı (0.4, 0.4, 1.2, 2.1, 2.2).
