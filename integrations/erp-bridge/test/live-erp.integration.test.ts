/**
 * Canlı ERP entegrasyon testi — VARSAYILAN OLARAK ATLANIR (describe.skip).
 *
 * Bu test, yalnızca dağıtılmış (deployed) bir OpenConstructionERP'ye karşı
 * çalıştırılabilir. Bu geliştirme ortamında canlı bir ERP yoktur; bu yüzden
 * birim testler (`client.test.ts`) mock'lanmış bir HTTP taşıma katmanıyla
 * hermetic çalışır (bkz. R1 kararı).
 *
 * Çalıştırmak için:
 *   1. `describe.skip` ifadesini `describe` yapın.
 *   2. Ortam değişkenlerini ayarlayın:
 *        ERP_BASE_URL=https://erp.ornekfirma.com
 *        ERP_ACCESS_TOKEN=<ERP /auth/login access_token>
 *   3. Çalıştırın:
 *        npx vitest run test/live-erp.integration.test.ts
 *
 * Not: `queryBoq` bir BOQ kimliği bekler; ERP'nin BOQ id'sinin brief'teki
 * `projectId` parametresine eşlenmesi canlı ERP'de doğrulanmalıdır.
 */
import { describe, expect, it } from "vitest";
import { createErpClientFromEnv } from "../src/client.js";
import { queryBoq, queryCostItem, setErpClient } from "../src/queries.js";

/** Canlı istemciyi kurar; ortam değişkenleri eksikse net hata verir. */
function useLiveClient(): void {
  if (!process.env.ERP_BASE_URL || !process.env.ERP_ACCESS_TOKEN) {
    throw new Error(
      "Canlı ERP testi için ERP_BASE_URL ve ERP_ACCESS_TOKEN ortam değişkenleri gerekir",
    );
  }
  setErpClient(createErpClientFromEnv());
}

describe.skip("canlı ERP entegrasyonu (dağıtılmış OpenConstructionERP gerekir)", () => {
  it("queryBoq canlı ERP'den pozisyonlar döner", async () => {
    useLiveClient();
    const boq = await queryBoq(process.env.ERP_BOQ_ID ?? "demo-project");
    expect(boq.positions.length).toBeGreaterThan(0);
  });

  it("queryCostItem canlı ERP'den maliyet kalemleri döner", async () => {
    useLiveClient();
    const items = await queryCostItem(
      process.env.ERP_COST_REGION ?? "TR_NATIONAL",
      process.env.ERP_COST_QUERY ?? "C25/30",
    );
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].currency).toBe("TRY");
  });
});
