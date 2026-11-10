# KaplanBIM (MutinyBIM) dağıtımı ve IFC içe aktarma durumu

Bu dizin, tek firma kurulumu için KaplanBIM'in (MutinyBIM) Docker Compose
yapılandırmasını içerir. Kök `docker-compose.yml` dosyasının bir uyarlamasıdır;
yeni bir yığın tanımlamaz (bkz. `docker-compose.yml` başlık yorumu).

## Kurulum (yerel doğrulama)

```bash
# repo kökünden
docker compose -f deploy/bim/docker-compose.yml config -q   # sözdizimi
docker compose -f deploy/bim/docker-compose.yml up --build  # gerçek kurulum
```

Açılan servisler (kök dosyayla birebir aynı): `db` (Postgres 17), `signin`
(yerel oturum), `authority-setup` (migration + demo model seed), `authority`
(model server, port 8080) ve `editor` (port 3095). Editör:
<http://localhost:3095/m/demo?view=plan>; ikinci pencere `&name=Avery` ile
birlikte düzenleme yapılır. `name: mutinybim` proje adını zaten sabitler
(`-p mutinybim` geçmek gerekmez).

**Kök dosyadan tek fark:** build context'i ve bind mount yolları, dosya
`deploy/bim/` altında olduğu için repo köküne (`../..`) göre düzeltildi.
Servis adları, env değişkenleri, portlar ve ağ topolojisi değişmedi.

## IFC içe aktarma durumu (spec Açık Kalem 3)

Dürüst durum: **İçe aktarma çekirdekte kısmen var; uçtan uca dönüştürme henüz
üretime hazır değil.**

- **Mevcut olan:** IFC 4.3 **dışa aktarma** (`packages/bim-ifc` — kernel model →
  STEP Part 21) ve **içe aktarma çekirdeği** `importIfc`
  (`packages/bim-ifc/src/import`): bir linked IFC referansının STEP metnini
  okuyup nötr (neutral) ürünlere çevirir ve modelin sınıf kayıt defteri/import
  kurallarıyla neyin dönüşeceğini planlar. Bu, "linked IFC reference"ı çekirdek
  (kernel) düzeyinde okumak/planlamaktır — yalnızca dışa aktarma değildir.
- **Henüz üretime hazır OLMAYAN:** Revit IFC'lerinin hizalanıp yerleştirilerek
  yerel, düzenlenebilir modele dönüştürülmesi (Revit → editable-native
  conversion) ve editörün yükleme (upload) akışı. Bunlar yol haritasındadır
  (hafta 2–5, `ROADMAP.md`: "Linked-reference math — alignment, georeferencing,
  placement ve IFC conversion for linked models, as an open package.").
- **Sonuç:** Plan'daki "IFC içe aktarma yeterliliği" kontrolünün yanıtı
  *"çekirdekte linked-reference içe aktarma var; Revit → düzenlenebilir yerel
  modele dönüştürme ve editör upload akışı yol haritasında"* olarak
  kaydedilir. Editörün canlı IFC içe aktarımı (upload → dönüştürme → düzenleme)
  üretim kullanımına hazır değildir.

**Fallback (miktar yolu):** Revit modelleri için miktar/keşif akışı
Faz 0/1'deki Revit → IFC → OpenConstructionERP takeoff yoludur
(bkz. `deploy/erp/import-check.md`). KaplanBIM'in bu aşamadaki rolü, **yerel
(native) modelleri görüntüleme/düzenleme**dir — Revit IFC'lerini içeri alıp
dönüştürmek değil. Aynı IFC hem ERP'ye (metraj) hem KaplanBIM'e
(görselleştirme) gireceğinde, IFC köprüsü ileride tek doğruluk kaynağı olur;
bugünkü eksik, içe aktarma dönüşümüdür, köprünün kendisi değil.

## Çakışma davranışı (Review Focus 4)

İki kullanıcı aynı alanı düzenlediğinde beklenen davranış motorda zaten
tasarlanmıştır (`docs/ARCHITECTURE.md`):

- Sunucu, istemcinin sonucuna güvenmez; komutu güncel head üzerinde güvenilir
  kodla yeniden çalıştırır.
- **Son yazan kazanmaz:** iki taraf aynı authored alanı farklı ayarlarsa,
  sonra gelen `conflict` koduyla **kelimelerle** reddedilir
  ("rejected" + açıklama mesajı). Türetilmiş değerler yeniden hesaplanır.
- Redler operatör dilindedir (ör. "Leg 3 is 0.51 ft long, but the elbow and
  transition there need 1.27 ft").

Bu davranışın **canlı doğrulaması** (iki sekmede aynı alanı düzenleyip çakışma
reddi almak) çalışan bir yığın gerektirir; bu ortamda imaj indirme/`up`
yapılmadığından burada yalnızca kaynak-kod düzeyinde belgelenmiştir. Sunucuda
kurulumdan sonra iki tarayıcı penceresiyle doğrulanır.

## Sunucuya taşımadan önce

Tüm portlar `127.0.0.1`'e bağlıdır ve yerel sign-in kendisine ulaşabilen
herkese güvenir. Firmaya açmadan önce gerekir:

1. HTTPS ters vekil (ERP tarafındaki Caddy ile aynı desen, bkz.
   `../erp/docker-compose.prod.yml`).
2. Gerçek kimlik/SSO — Task 2.2 kapsamındadır (spec Açık Kalem 5); yerel
   sign-in tek bilgisayar içindir.
