/**
 * AI asistan sohbet katmanı — Task 2.4.
 *
 * Verilen doğal dil sorusunu sınıflandırır ve doğru arka uca yönlendirir:
 *   - model/geometri/metraj  → KaplanBIM MCP (script-first, ≤10 çekirdek araç)
 *   - maliyet/BOQ/bütçe      → ERP köprüsü (queryBoq / queryCostItem, Task 2.3)
 *
 * İki bağımlılık da enjekte edilebilir (Task 2.3'teki yaklaşımla tutarlı):
 * birim testler canlı MCP veya canlı ERP olmadan çalışır. Bu katman, çalışan
 * bir MCP veya ERP varmış gibi davranmaz; bağlı olmayan bir arka uç açıkça
 * söylenir.
 */

import type { Boq, CostItem } from "../../erp-bridge/src/queries.js";

/** Sorunun yönlendirileceği arka uç. */
export type Classification = "bim" | "erp" | "unknown";

/** ERP köprüsünün (Task 2.3) asistanın kullandığı yüzeyi. */
export interface ErpBridge {
  queryBoq(projectId: string): Promise<Boq>;
  queryCostItem(region: string, query: string): Promise<CostItem[]>;
}

/**
 * KaplanBIM MCP'nin (script-first, ≤10 çekirdek araç) asistanın kullandığı
 * yüzeyi. Canlı bir MCP çağrısını temsil eder; bu ortamda canlı MCP yoktur.
 */
export interface ModelMcp {
  queryModel(question: string): Promise<string>;
}

/** Asistan bağımlılıkları (hermetic testler için enjekte edilir). */
export interface AssistantDeps {
  erp: ErpBridge;
  mcp?: ModelMcp;
}

/** Asistan yapılandırması. */
export interface AssistantOptions {
  /** ERP maliyet araması için bölge (varsayılan `TR_NATIONAL`). */
  region?: string;
  /** BOQ/bütçe sorgusu için proje kimliği (varsayılan `demo-project`). */
  projectId?: string;
}

/** Asistanın yapılandırılmış yanıtı. */
export interface AssistantReply {
  route: Classification;
  text: string;
  /** Yanıtlayan arka ucun döndürdüğü veri. */
  data?: unknown;
}

const DEFAULT_REGION = "TR_NATIONAL";
const DEFAULT_PROJECT_ID = "demo-project";

const BIM_KEYWORDS = [
  "metraj",
  "miktar",
  "model",
  "geometri",
  "geometry",
  "3d",
  "kanal",
  "havalandırma",
  "duvar",
  "kolon",
  "kiriş",
  "döşeme",
  "çatı",
  "merdiven",
  "boru",
  "cephe",
  "tavan",
  "kapı",
  "pencere",
  "quantity",
  "takeoff",
];

const ERP_KEYWORDS = [
  "bütçe",
  "maliyet",
  "fiyat",
  "kalem",
  "boq",
  "budget",
  "cost",
  "teklif",
  "ihale",
  "birim fiyat",
];

/**
 * Soruyu `"bim" | "erp" | "unknown"` olarak sınıflandırır (saf, deterministik).
 * Hem model hem maliyet anahtarlarına uyan sorularda `"unknown"` döner
 * (belirsiz — sessizce yanlış arka uca göndermektense net sinyal verilir).
 */
export function classifyQuestion(text: string): Classification {
  const normalized = text.toLocaleLowerCase("tr-TR");
  const isBim = BIM_KEYWORDS.some((keyword) => normalized.includes(keyword));
  const isErp = ERP_KEYWORDS.some((keyword) => normalized.includes(keyword));
  if (isBim && isErp) return "unknown";
  if (isBim) return "bim";
  if (isErp) return "erp";
  return "unknown";
}

/**
 * Yönlendirme katmanı. `answer()` soruyu sınıflandırır ve uygun arka ucu
 * çağırıp yapılandırılmış bir yanıt döner.
 */
export class Assistant {
  private readonly deps: AssistantDeps;
  private readonly region: string;
  private readonly projectId: string;

  constructor(deps: AssistantDeps, options: AssistantOptions = {}) {
    this.deps = deps;
    this.region = options.region ?? DEFAULT_REGION;
    this.projectId = options.projectId ?? DEFAULT_PROJECT_ID;
  }

  async answer(question: string): Promise<AssistantReply> {
    const route = classifyQuestion(question);
    switch (route) {
      case "bim":
        return this.answerBim(question);
      case "erp":
        return this.answerErp(question);
      default:
        return {
          route: "unknown",
          text:
            `Bu soruyu yanıtlayabilecek bir arka uç belirlenemedi: "${question}". ` +
            "Model/metraj sorularını KaplanBIM MCP'ye, maliyet/BOQ/bütçe sorularını ERP köprüsüne yönlendiririm.",
        };
    }
  }

  private async answerBim(question: string): Promise<AssistantReply> {
    if (!this.deps.mcp) {
      return {
        route: "bim",
        text:
          `"${question}" KaplanBIM MCP'ye yönlendirilir; ancak bu ortamda canlı ` +
          "MCP bağlantısı kurulu değil.",
      };
    }
    const modelAnswer = await this.deps.mcp.queryModel(question);
    return { route: "bim", text: modelAnswer, data: { modelAnswer } };
  }

  private async answerErp(question: string): Promise<AssistantReply> {
    const [costItems, boq] = await Promise.all([
      this.deps.erp.queryCostItem(this.region, question),
      this.deps.erp.queryBoq(this.projectId),
    ]);

    const parts: string[] = [];
    parts.push(
      `"${question}" için ERP köprüsünden ${costItems.length} maliyet kalemi bulundu.`,
    );
    if (boq.positions.length > 0) {
      const totalText =
        boq.grand_total !== undefined
          ? `, toplam ${boq.grand_total}${boq.currency ? ` ${boq.currency}` : ""}`
          : "";
      parts.push(
        `BOQ (${boq.id}) ${boq.positions.length} pozisyon içeriyor${totalText}.`,
      );
    }
    parts.push(
      "Bütçe aşımının nedeni, planlanan (BOQ) ve fiili tutarların karşılaştırılmasını " +
        "gerektirir; bu katman yalnızca ERP'den gelen veriyi aktarır.",
    );

    return {
      route: "erp",
      text: parts.join(" "),
      data: { costItems, boq },
    };
  }
}
