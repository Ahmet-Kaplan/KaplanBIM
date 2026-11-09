# KaplanBIM İnşaat Platformu — Tasarım Dokümanı

- **Tarih:** 2026-11-10
- **Durum:** Onay bekliyor
- **Kapsam:** Tek inşaat firması için, üç açık kaynak projeyi (KaplanBIM/MutinyBIM, OpenConstructionERP, DDC-CWICR) birleştiren AI destekli inşaat yönetim platformu

---

## 1. Niyet ve Neden

Firma bugün **Revit** ile model üretiyor, **Excel** ile metraj/keşif yapıyor; aradaki her adım manuel. Hedef, Revit'ten maliyete ve sahaya giden manuel köprüyü otomatikleştiren, üstüne AI destekli bir asistan katmanı bindirilmiş tek bir iç sistem kurmak.

Pazar araştırması (kaynaklar `sources/*.json`) bu niyeti doğruluyor:

- İnşaat ERP pazarı 2024–2025'te ~$3.7–4.9 milyar, 2034'e ~$10 milyar, yıllık ~%7.7–10 büyüme. İtici güçler: BIM benimsemesi, entegre proje yönetimi, maliyet kontrolü.
- Kurumların yalnızca **%39'u** metraj+keşif yazılımını entegre kullanıyor (RICS+Glodon 2023). AI benimsemesi sektörde hâlâ düşük (RICS AI in Construction 2025, 2.200+ profesyonel) — yani "AI tabanlı" olmak gerçek bir farklılaştırıcı.
- Kurumsal araçlar (Procore $10–600k/yıl, Autodesk ACC $15–60k/yıl) orta ölçek için pahalı ve karmaşık. Açık kaynak + kendi kendine barındırma bu boşluğu kapatıyor.

Üç proje birbirini şöyle tamamlıyor:

| Proje | Rolü | Lisans |
|-------|------|--------|
| **OpenConstructionERP** | Sistemin kaydı: BOQ, IFC/DWG/PDF metraj, AI maliyet eşleştirme, 4D/5D, ihale, dashboard, 190+ modül | AGPL-3.0 |
| **DDC-CWICR** | Maliyet veritabanı: 55K+ iş kalemi, 27K+ kaynak, **Türkiye "Birim Fiyat" verisi mevcut** (`Europe-Turkey-Birim-Fiyat`), Qdrant semantik arama | CC BY-NC 4.0 + Ticari |
| **KaplanBIM (MutinyBIM)** | Tarayıcı tabanlı BIM görüntüleyici + canlı iş birliği + MCP tabanlı AI ajan katmanı | Apache-2.0 |
| **DDC Skills for AI Agents** | AI ajan beceri kütüphanesi (238 `SKILL.md`): ERP yapılandırma (TR maliyet tabanı yükleme dahil), metraj/keşif, n8n otomasyonları. Çalıştırılan bir servis değil; ajanın okuduğu talimatlar | MIT |

Not: CWICR, OpenConstructionERP'nin içinde zaten gömülü geliyor; ayrıca entegre etmeye gerek yok. DDC Skills de çalıştırılan bir sistem değil; AI ajanın Faz 0/1'de ERP'yi yapılandırırken ve Faz 2'de inşaat alanı görevlerini yaparken okuduğu bir beceri kütüphanesidir (ayrı sunucu/veritabanı yükü yoktur).

---

## 2. Hedefler, Hedef Dışı, Anti-Hedefler

### Hedefler

1. **Otomatik metraj + keşif (Faz 1):** Revit → IFC → otomatik miktar çıkarma → CWICR (Türkiye Birim Fiyat) ile otomatik fiyatlama → onaylanabilir BOQ. Excel'deki manuel metraj/keşif işini bitirmek.
2. **AI asistan/ajan (Faz 2):** Model ve ERP verisi üzerine doğal dille soru ("3. kattaki havalandırma kanalı metrajı ne?", "bu kalem neden bütçeyi aştı?") ve konuşarak rapor/çizim üretme.
3. **4D/5D (Faz 3):** Keşif → iş programı → nakit akışı bağlantısını otomatikleştirip model üzerinde görselleştirmek.
4. Tek bir kimlikle (SSO) çalışan, tek sunucuda barınan, yazılım ekibi gerektirmeyen işletilebilir bir sistem.

### Hedef dışı (non-goals)

- Revit'i çizim aracı olarak değiştirmek. Revit kalıcıdır; IFC köprüdür.
- ERP modüllerini sıfırdan yazmak (OpenConstructionERP'nin 190+ modülü yeniden kullanılır).
- Çok kiracılı (multi-tenant) ticari SaaS. Tek firma, iç kullanım.
- KaplanBIM'in hosted-app özellikleri (çok kuruluşlu hesap, kota, public npm) başlangıçta gerekmez.

### Anti-hedefler (teknik olarak çalışsa bile başarısızlık sayılır)

- Firma metraj/keşfi hâlâ Excel'de yapıyorsa (manuel köprü kalırsa) proje başarısızdır.
- Çıkan miktarlar güvenilmezse (doğrulanamayan metraj) sistem kullanılmaz.
- AI asistan günlük işte kullanılmayan bir oyuncak olursa.
- Sistem, yazılım ekibi olmayan bir firmanın işletemeyeceği kadar karmaşık olursa.

---

## 3. Kısıtlar

1. **Lisans:** İç kullanım tek firma → AGPL (OpenConstructionERP) kaynak açma zorunluluğu tetiklenmez; CWICR verisi yeniden satılmadan iç kullanımda sorun değil. **Kısıt:** yazılım/veri dışarıya dağıtılmaz, satılmaz; bu değişirse lisans yeniden değerlendirilir.
2. **Yazılım ekibi yok:** Dağıtım Docker Compose ile, tercihen yapılandırma > kod. Özel kod minimumda tutulur.
3. **Revit kalıcı:** Geometri kaynağı Revit; değişim formatı IFC 4.3.
4. **KaplanBIM "modelde para yok" ilkesi:** Modeller yalnızca miktar tutar; fiyatlar okuma anında maliyet kaynağından (ERP/CWICR) gelir. Bu ilkeyi bozmayız — maliyet verisi yalnızca OpenConstructionERP'de yaşar.
5. **KaplanBIM MCP "script-first" ilkesi:** Çekirdek araç paketi ≤10 araç; AI ajana yeni özellik MCP aracı olarak değil, script API'si olarak eklenir (`docs/SCRIPTING-COVERAGE.md`, `AGENTS.md`).
6. **Türkiye mevzuatı/verisi:** Birim fiyat kaynağı T.C. ÇŞB "Birim Fiyat" (CWICR'de mevcut); gerekirse firma BlackBox'ı ile yerel rayiçlerle güncellenir.
7. **Dağıtım:** Tek Linux sunucusu (firma içi veya bulut VPS), Docker Compose ile. Kurulum/yedekleme tek kişinin yapabileceği basitlikte. (Builder kararı; her iki seçenek de çalışır.)
8. **Dil:** Kullanıcı arayüzü Türkçe. OpenConstructionERP 44 dili destekler; KaplanBIM tarafında eksik Türkçe dizgiler Faz 2'de tamamlanır.
9. **CAD dönüştürücü lisansı:** `cad2data` (DDC Converters) ikili dönüştürücüleri kapalı kaynaktır ve yalnızca ticari olmayan kullanım içindir; bir inşaat firmasının kendi projelerinde kullanımı EULA'ya göre "ticari kullanım" sayılır ve ücretli lisans gerektirir. Çekirdek akışta kullanılmaz; bunun yerine Revit'in yerleşik (ücretsiz) IFC export'u kullanılır.

---

## 4. Yaklaşımlar (değerlendirilen ve seçilen)

### A — "ERP omurga + BIM/AI katman" (SEÇİLDİ)
OpenConstructionERP'yi sistemin kaydı olarak kur; KaplanBIM'i tarayıcı görüntüleyici + AI ajan katmanı olarak ekle; köprü IFC + API.
- **Artı:** 190+ ERP modülü hazır; en küçük inşa işi; Revit'i bırakmıyor; "modelde para yok" ilkesiyle kavramsal olarak tam uyumlu (KaplanBIM miktar tutar, ERP fiyat verir).
- **Eksi:** İki kod tabanı işletilir; IFC/API köprüsü özel kod gerektirir.

### B — "KaplanBIM çekirdek"
Her şeyi KaplanBIM motoru üstüne sıfırdan yaz.
- **Artı:** tek kod tabanı, Apache-2.0, tam kontrol.
- **Eksi:** BOQ/keşif/planlama/satın alma sıfırdan = yıllar. Tek firma için reddedildi.

### C — "Gevşek federasyon"
Her araç ayrı, merkezi veri hub + event bus.
- **Artı:** esneklik. **Eksi:** en çok entegrasyon kodu, ekipsiz firma için kırılgan. Reddedildi.

**Karar:** A. Kullanıcı tarafından seçildi (2026-11-10).

---

## 5. Mimari ve Entegrasyon Noktaları

```text
Revit (çizim kaynağı)
   │  IFC 4.3 / RVT / DWG export
   ▼
OpenConstructionERP (sistemin kaydı — Postgres 16 + FastAPI + React)
   • CAD/BIM girişi: Revit'in yerleşik IFC export'u (ücretsiz) → takeoff; kapalı kaynak RVT dönüştürücü (cad2data) OPSİYONEL — ticari kullanım ücretli lisans gerektirir, çekirdekte kullanılmaz
   • 7 pipeline: Mining → QTO kuralları → BlackBox → proje modelleme → eşleme → 4D/5D/6D → ML
   • BOQ, AI maliyet eşleştirme (CWICR gömülü), iş programı, ihale, dashboard
   │
   │  IFC (aynı dosya)                    │  REST/API (BOQ, maliyet, miktar sorguları)
   ▼                                      ▼
KaplanBIM (görüntüleyici + AI ajan katmanı)
   • bim-editor: plan/3D/sheet görüntüleme, saha çalışanı için tarayıcı erişimi
   • bim-mcp: AI ajan script yazar, çalıştırır, uygular (≤10 çekirdek araç)
   • DDC Skills: ajanın inşaat alanı becerileri (ERP yapılandırma, metraj, n8n) — KaplanBIM MCP ile birlikte okunur
   • model server: Postgres + WebSocket canlı iş birliği
   • "modelde para yok": miktar modelden, fiyat ERP'den okuma anında
```

### Entegrasyon noktaları (yazılacak "tutkal")

1. **IFC köprüsü:** Revit'ten ihraç edilen aynı IFC hem OpenConstructionERP'ye (metraj) hem KaplanBIM'e (görselleştirme/AI) girer. Geometri için tek doğruluk kaynağı.
2. **API köprüsü:** KaplanBIM'deki AI ajan, OpenConstructionERP'nin FastAPI'sini sorgular (BOQ, kalemler, maliyet, miktarlar) — böylece asistan "modeldeki miktar" ile "BOQ'daki miktar"ı karşılaştırıp yanıtlar.
3. **SSO:** Tek kimlik. Her iki sistem aynı kimlik sağlayıcısını doğrular (başlangıçta basit bir iç OIDC/idP veya firma hesap sistemi).
4. **Maliyet okuma-anında:** KaplanBIM şedül/görünümleri miktar gösterir; fiyat, görüntülenme anında ERP/CWICR'den çekilir. Maliyet verisi asla iki yerde tutulmaz.

### Teknik yığın

| Katman | Teknoloji |
|--------|-----------|
| ERP backend | Python 3.12+ / FastAPI / Pydantic v2 |
| ERP frontend | React 18 / TypeScript / Vite / Tailwind / AG Grid |
| ERP DB | PostgreSQL 16 (OLTP + JSON) |
| AI/vektör | LanceDB (gömülü) / Qdrant; herhangi bir LLM (REST) |
| CAD/BIM dönüşüm | DDC Converters 2.0 (RVT, IFC, DWG) |
| BIM katmanı | KaplanBIM: TypeScript monorepo (kernel, editor, viewer, MCP, model server) |
| BIM DB | Postgres (model server) + WebSocket sync |

---

## 6. Fazlar

> Her faz tek başına değer üretir ve bağımsız doğrulanır. Faz sırası kullanıcının seçtiği önceliğe (1→2→3) uyar; Faz 0 kurulum temelidir.

### Faz 0 — Temel: ERP kurulumu ve IFC akışı (değer: "Revit → yapılandırılmış veri")
- OpenConstructionERP'yi Docker Compose ile kur (Postgres + uygulama).
- CWICR verisinin yüklü ve **Türkiye Birim Fiyat** bölgesinin aktif olduğunu doğrula.
- DDC Skills `6_OpenConstructionERP` becerileriyle Türkiye maliyet tabanını yükle ("Load Cost Bases — TR") ve ERP kurulumunu hızlandır.
- Firma BlackBox'ı: sınıflandırmalar, birim faktörleri, montaj tarifleri (COBie/CFIHOS veya firma standardı).
- Revit'ten örnek bir modeli IFC olarak ihraç et (Revit'in yerleşik, ücretsiz IFC export'u) ve OpenConstructionERP'de yapılandırılmış miktara çevir.
- Firmanın mevcut Excel keşif/rayiç şablonlarını içe aktarma yolunu hazırla (mevcut verinin sisteme taşınması).
- **Çıkış:** örnek projede otomatik metraj + BOQ taslağı.

### Faz 1 — Otomatik metraj + keşif (değer: "Excel'den çıkış")
- QTO kural setleri (disiplin/aile/tip başına), doğrulama, `match-elements` (7 aşamalı eşleme) + AI Estimate ile otomatik fiyat eşleme.
- Firmaya özel BlackBox doğrulaması; keşif sapmasını manuel keşifle karşılaştırıp kalibre et.
- **Çıkış:** Revit modelinden onaylanabilir, güvenilir keşif; manuel metraj devre dışı.

### Faz 2 — BIM görüntüleyici + AI asistan (değer: "Revit'i olmayan herkes modele erişir, herkes sorar")
- KaplanBIM'i kur; aynı IFC'yi yükle; tarayıcıda plan/3D görüntüleme + canlı iş birliği.
- AI ajanı (MCP) hem KaplanBIM modeline hem ERP verisine bağla; script-first araçlarla sorgu + düzenleme.
- Sohbet katmanı: doğal dille model/BOQ/maliyet sorgulama ve rapor üretme.
- **Çıkış:** saha/teknik ofis Revit'siz modele erişir; asistan günlük soruları yanıtlar.

### Faz 3 — 4D/5D (değer: "keşif → program → nakit akışı otomatik")
- OpenConstructionERP `scheduling` / `5d_planner` ile program + maliyet modeli.
- KaplanBIM'de model üzerinde program/nakit akışı görselleştirme (renkli fazlar, kazanılmış değer).
- **Çıkış:** model üzerinde canlı 4D/5D görünümü.

---

## 7. Başarı Ölçütleri

- **Faz 1:** Örnek projede otomatik keşif ile manuel keşif arası sapma kabul edilebilir aralıkta (hedef: toplam maliyette <%3, kalem bazında doğrulanabilir) ve firma keşfi artık Excel'de elle yapmıyor.
- **Faz 2:** Saha/teknik ofis personeli modele Revit olmadan erişiyor; asistan haftalık gerçek soruların çoğunu yanıtlıyor.
- **Faz 3:** Keşif değişince program ve nakit akışı otomatik güncelleniyor ve model üzerinde görünüyor.
- **İşletilebilirlik:** Sistemi yazılım ekibi olmadan tek kişi kurup yedekleyebiliyor (Docker Compose + dokümante prosedürler).

---

## 8. Açık Kalemler ve Riskler (doğrulanacak / karar verilecek)

1. **Türkiye Birim Fiyat verisinin tazeliği/kapsamı:** CWICR `Europe-Turkey-Birim-Fiyat` mevcut ama güncelliği ve firmanın iş yaptığı kalem kapsamı Faz 0'da doğrulanmalı; eksikse firma BlackBox'ı ile güncel ÇŞB rayiçleri yüklenir.
2. **Revit → IFC kalitesi:** Firmanın Revit modelindeki sınıflandırma/parametre disiplini, otomatik metraj kalitesini belirler. Faz 0'da örnek modelle ölçülür; gerekirse Revit şablonu/parametre standardı hazırlanır.
3. **KaplanBIM IFC içe aktarımı:** KaplanBIM'in IFC 4.3 dışa aktarımı var; içe aktarma/linked-reference özelliği yol haritasında (hafta 2–5). Faz 2 öncesi içe aktarma yeterliliği doğrulanır; yetersizse dışa aktarım→dönüştürme köprüsü kullanılır.
4. **LLM seçimi ve veri gizliliği:** Firma verisi üçüncü taraf LLM'e gider mi, yoksa yerel/self-hosted LLM mi? Bu firmanın gizlilik tercihiyle belirlenir (Faz 2 kararı).
5. **Kimlik (SSO) çözümü:** Başlangıçta hangi idP kullanılacağı (basit iç OIDC mi, mevcut firma hesabı mı) Faz 2 öncesi netleşir.
6. **Bakım/upstream senkronu:** Her iki upstream proje aktif; fork/versiyon sabitleme stratejisi (upstream'i takip mi, sabit sürüm mü) karar verilmeli.
7. **RVT'yi Revit olmadan işleme:** Arşiv/taşeron RVT dosyalarını Revit olmadan işlemek gerekirse, Revit'li personel IFC export eder ya da DDC'den ticari dönüştürücü lisansı alınır (ertelenmiş karar).

---

## 9. Builder'a Bırakılanlar

- Fazların her biri için somut görev kırılımı, kabul kriterleri ve tahmin (implementation planı ayrıca yazılır).
- Entegrasyon köprülerinin (IFC pipeline, API adapter, SSO) gerçekleme detayları.
- Yerel ÇŞB rayiç güncelleme prosedürü ve BlackBox içeriği.
- Yedekleme, yükseltme ve felaket kurtarma runbook'ları.
- Faz 2'de LLM/gizlilik kararına göre ajan davranış spesifikasyonu.
