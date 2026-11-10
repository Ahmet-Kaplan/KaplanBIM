# erp-bridge — KaplanBIM ajanı → OpenConstructionERP

Bu paket, KaplanBIM AI ajanının OpenConstructionERP'ye (FastAPI) tip güvenli
sorgular atmasını sağlar. Task 2.3'ün çıktısı, Task 2.4'ün girdisidir.

## Arayüz

```ts
queryBoq(projectId: string): Promise<Boq>
queryCostItem(region: string, query: string): Promise<CostItem[]>
```

- `queryBoq` → `GET /api/v1/boqs/{id}` (BOQ pozisyonları).
- `queryCostItem` → `GET /api/v1/costs/?region={region}&q={query}` (sondaki `/`
  zorunludur; ERP `redirect_slashes=False` ile çalışır).

## Ortam değişkenleri

| Değişken | Açıklama |
| --- | --- |
| `ERP_BASE_URL` | ERP temel URL'i (varsayılan `http://localhost:8000`). |
| `ERP_ACCESS_TOKEN` | ERP `/auth/login`'den alınan SSO bearer token'ı (Task 2.2). |

## Testler

```bash
npx vitest run          # hermetic birim testleri (mock'lanmış HTTP taşıma)
npx tsc --noEmit        # tip kontrolü
```

Birim testler (`test/client.test.ts`) canlı ERP'ye ihtiyaç duymaz: HTTP
taşıma katmanı (`FetchLike`) istemci yapıcısına enjekte edilir. Canlı
entegrasyon testi `test/live-erp.integration.test.ts` varsayılan olarak
**atlanır**; çalıştırma talimatı dosyanın başındadır.

## Doğrulanmamış eşleme

- `queryBoq` parametresi brief'te `projectId` adını taşır; ERP tarafında bu
  değer `/api/v1/boqs/{id}` yolundaki BOQ kimliğine karşılık gelir. Canlı
  ERP'de bu eşleme ve `GET /api/v1/costs/` arama yanıtının zarf şekli
  (dizi mi, `{items: []}` mi) doğrulanmalıdır.
