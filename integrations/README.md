# integrations/ — KaplanBIM monorepo'su dışında tutulan köprü paketleri

Bu dizin, KaplanBIM monorepo'sunun `packages/*` çalışma alanı (workspace)
**dışında** tutulan iki ayrık paket içerir. İkisi de bu repo'nun Apache-2.0
monorepo yapısına dahil değildir ve kasıtlı olarak öyle kalır:

- `erp-bridge` — KaplanBIM AI ajanı → OpenConstructionERP API köprüsü
  (BOQ + maliyet sorguları).
- `assistant` — KaplanBIM AI asistanı yönlendirme katmanı: doğal dil
  sorusunu KaplanBIM MCP'ye veya ERP köprüsüne yönlendirir.

## Neden ayrık tutuluyorlar (lisans sınırı)

Bu iki paket **OpenConstructionERP'nin HTTP API'sini** çağırır.
OpenConstructionERP **AGPL** lisanslıdır; KaplanBIM monorepo'su ise
**Apache-2.0** lisanslıdır ve lisans kapısını (`npm run licenses`) çalıştırır.
Bu köprüleri monorepo'nun workspace/CI/lisans kapısına dahil etmemek, iki kod
tabanı arasındaki **lisans sınırını açık tutar**: köprü paketleri yalnızca
ERP'nin API'sini kullanır; ERP kodunu içermez, kopyalamaz veya linklemez.

Bu nedenle bu paketler bilinçli olarak:

- Kök `package.json`'ın `workspaces` listesine (`packages/*`) **dahil edilmemiştir**.
- Kök CI / `eslint` / `tsc -p packages/tsconfig.bim.json` / `jest` kapsamına **girmez**.
- Kök `npm run licenses` kapısından **geçirilmez**.

Bu bir eksik değil, bilinçli bir sınırdır.

## Ayrık toolchain

İki paket de monorepo'nun ana toolchain'inden farklı sürümler kullanır:
monorepo TypeScript 5.9.3 / Jest / `@types/node` 22 kullanırken, bu paketler
TypeScript ^7, Vitest ^5, `@types/node` ^26 kullanır. Her paket kendi
`package-lock.json`'ına ve `tsconfig.json`'ına sahiptir; bağımlılıkları
ayrıca kurulur ve monorepo'nun bağımlılık kurulumuna karışmaz.

**Node gereksinimi:** her iki paket de repo ile aynı **Node >=22.13**
gereksinimini taşır.

## Kurulum ve test

```bash
cd integrations/erp-bridge && npm install && npm test
cd integrations/assistant && npm install && npm test
```

`npm test` her iki pakette de `vitest run` çalıştırır. Tip kontrolü için
`npx tsc --noEmit`.

## Testlerin yalıtıklığı (hermetic)

- Birim testler **canlı ERP/MCP olmadan** çalışır: HTTP taşıma katmanı
  (`FetchLike`) ve arka uçlar (ERP köprüsü, MCP) enjekte edilir; ağ çağrısı
  yapılmaz.
- `erp-bridge` içindeki canlı entegrasyon testi
  (`test/live-erp.integration.test.ts`) **varsayılan olarak atlanır**;
  çalıştırma talimatı dosyanın başındadır.
