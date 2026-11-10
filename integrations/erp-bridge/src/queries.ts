/**
 * BOQ ve maliyet sorguları — Task 2.3'ün ürettiği, Task 2.4'ün tükettiği
 * genel arayüz:
 *
 *   queryBoq(projectId: string): Promise<Boq>
 *   queryCostItem(region: string, query: string): Promise<CostItem[]>
 *
 * Tipler, OpenConstructionERP'nin gerçek veri şeklinden türetilmiştir
 * (deploy/blackbox/README.md, deploy/README.md, deploy/blackbox/calibration.md):
 * BOQ pozisyonları `ordinal/description/unit/quantity/unit_rate/total`,
 * maliyet kalemleri `description/unit/rate/currency/components[]/classification`.
 * ERP bir FastAPI backend'i olduğundan alan adları snake_case tutulmuştur.
 */

import { createErpClientFromEnv, type ErpClient } from "./client.js";

/** BOQ içindeki tek bir pozisyon (kalem). */
export interface BoqPosition {
  /** Pozisyon sıra numarası (ör. "P-001"). */
  ordinal?: string;
  /** Pozisyon kodu. */
  code?: string;
  /** Kalem açıklaması. */
  description: string;
  /** Birim (ör. "m3", "m2", "saat"). */
  unit: string;
  /** Miktar. */
  quantity: number;
  /** Birim fiyat. */
  unit_rate?: number;
  /** Pozisyon toplamı (`quantity × unit_rate`). */
  total?: number;
  /** Sınıflandırma kodu (DIN 276 / NRM / MasterFormat). */
  classification?: string;
}

/** Bir projenin/BOQ'nun tamamı. */
export interface Boq {
  /** BOQ kimliği. */
  id: string;
  /** İlişkili proje kimliği. */
  projectId?: string;
  /** Para birimi (ör. "TRY"). */
  currency?: string;
  /** Toplam tutar. */
  grand_total?: number;
  /** BOQ pozisyonları. */
  positions: BoqPosition[];
}

/** Maliyet kaleminin kaynak bileşeni (işçilik/malzeme/makine). */
export interface CostItemComponent {
  type: "labor" | "material" | "equipment" | "operator" | string;
  code?: string;
  name?: string;
  quantity?: number;
  unit?: string;
}

/** Tek bir maliyet kalemi. */
export interface CostItem {
  id?: string;
  code?: string;
  description: string;
  unit?: string;
  /** Birim fiyat. ERP bunu bazen string (`"1250.00"`) döner. */
  rate?: number | string;
  /** Pozisyon başına toplam maliyet (arama yanıtında). */
  total_cost_per_position?: number;
  currency?: string;
  /** Bölge kimliği (ör. "TR_NATIONAL"). */
  region?: string;
  classification?: string;
  category?: string;
  components?: CostItemComponent[];
}

/**
 * Sorguların kullandığı varsayılan istemci.
 * Testler `setErpClient` ile mock'lanmış bir istemci enjekte eder.
 */
let defaultClient: ErpClient | null = null;

function getDefaultClient(): ErpClient {
  if (!defaultClient) {
    defaultClient = createErpClientFromEnv();
  }
  return defaultClient;
}

/**
 * Test dikişi: `queryBoq`/`queryCostItem`'ın kullanacağı istemciyi değiştirir.
 * Canlı kullanımda çağrılmaz — varsayılan istemci ortam değişkenlerinden kurulur.
 */
export function setErpClient(client: ErpClient): void {
  defaultClient = client;
}

/**
 * Bir projenin BOQ'sunu (pozisyonlarıyla) döner.
 *
 * ERP uç noktası: `GET /api/v1/boqs/{id}`. Parametre adı brief'te
 * `projectId`'dir; ERP tarafında bu değer BOQ kimliğine karşılık gelir
 * (ERP'nin BOQ editörü "positions, quantities" taşıyan hiyerarşik BOQ'dur;
 * `POST /api/v1/boqs/{id}/validate/` kaynağın `/api/v1/boqs/{id}` olduğunu
 * gösterir). Canlı ERP'de bu eşleme doğrulanmalıdır.
 */
export function queryBoq(projectId: string): Promise<Boq> {
  return getDefaultClient().get<Boq>(
    `/api/v1/boqs/${encodeURIComponent(projectId)}`,
  );
}

/**
 * Bir bölgede (ör. `TR_NATIONAL`) metin sorgusuyla maliyet kalemlerini arar.
 *
 * ERP uç noktası: `GET /api/v1/costs/?region={region}&q={query}` (sondaki `/`
 * zorunludur; `redirect_slashes=False` nedeniyle `/api/v1/costs` 404 döner).
 */
export function queryCostItem(region: string, query: string): Promise<CostItem[]> {
  return getDefaultClient().get<CostItem[]>(`/api/v1/costs/`, {
    region,
    q: query,
  });
}
