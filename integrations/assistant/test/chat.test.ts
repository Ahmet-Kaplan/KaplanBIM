import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  Assistant,
  classifyQuestion,
  createDefaultAssistant,
} from "../src/chat.js";
import type { ErpBridge, ModelMcp } from "../src/chat.js";
import {
  queryBoq,
  queryCostItem,
  setErpClient,
} from "../../erp-bridge/src/queries.js";
import {
  createErpClientFromEnv,
  ErpClient,
} from "../../erp-bridge/src/client.js";
import type { Boq, CostItem } from "../../erp-bridge/src/queries.js";

const REGION = "TR_NATIONAL";
const PROJECT_ID = "demo-project";

function sampleBoq(overrides: Partial<Boq> = {}): Boq {
  return {
    id: "boq-1",
    positions: [
      {
        code: "P-001",
        description: "Beton C25/30",
        unit: "m3",
        quantity: 42.5,
        unit_rate: 1250,
        total: 53125,
      },
    ],
    grand_total: 53125,
    currency: "TRY",
    ...overrides,
  };
}

function sampleCostItems(): CostItem[] {
  return [
    {
      id: "c-1",
      code: "C25/30",
      description: "Beton C25/30",
      unit: "m3",
      rate: "1250.00",
      currency: "TRY",
    },
  ];
}

function mockErp(): ErpBridge {
  return {
    queryBoq: vi.fn<(projectId: string) => Promise<Boq>>(),
    queryCostItem: vi.fn<(region: string, query: string) => Promise<CostItem[]>>(),
  };
}

function mockMcp(): ModelMcp {
  return {
    queryModel: vi.fn<(question: string) => Promise<string>>(),
  };
}

describe("classifyQuestion (saf, deterministik)", () => {
  it("model/geometri/metraj sorusunu 'bim' olarak sınıflandırır", () => {
    expect(classifyQuestion("3. kattaki havalandırma kanalı metrajı ne?")).toBe(
      "bim",
    );
  });

  it("maliyet/BOQ/bütçe sorusunu 'erp' olarak sınıflandırır", () => {
    expect(classifyQuestion("bu kalem neden bütçeyi aştı?")).toBe("erp");
  });

  it("iki arka uca da uymayan soruyu 'unknown' olarak sınıflandırır", () => {
    expect(classifyQuestion("bugün hava nasıl?")).toBe("unknown");
  });
});

describe("ERP yönlendirme yolu (mock'lanmış köprü, canlı ERP yok)", () => {
  let erp: ErpBridge;
  let assistant: Assistant;

  beforeEach(() => {
    erp = mockErp();
    assistant = new Assistant({ erp });
  });

  it("bütçe sorusunu ERP köprüsüne yönlendirir ve veriyi döner", async () => {
    erp.queryCostItem = vi
      .fn<(region: string, query: string) => Promise<CostItem[]>>()
      .mockResolvedValue(sampleCostItems());
    erp.queryBoq = vi
      .fn<(projectId: string) => Promise<Boq>>()
      .mockResolvedValue(sampleBoq());

    const reply = await assistant.answer("bu kalem neden bütçeyi aştı?");

    expect(reply.route).toBe("erp");
    expect(erp.queryCostItem).toHaveBeenCalledTimes(1);
    expect(erp.queryCostItem).toHaveBeenCalledWith(
      REGION,
      "bu kalem neden bütçeyi aştı?",
    );
    expect(erp.queryBoq).toHaveBeenCalledTimes(1);
    expect(erp.queryBoq).toHaveBeenCalledWith(PROJECT_ID);

    const data = reply.data as { costItems: CostItem[]; boq: Boq };
    expect(data.costItems).toHaveLength(1);
    expect(data.boq.positions).toHaveLength(1);
    expect(reply.text).toContain("ERP");
  });
});

describe("MCP yönlendirme yolu (mock'lanmış MCP)", () => {
  it("bim sorusunu enjekte edilen MCP arayüzüne iletir", async () => {
    const mcp = mockMcp();
    (mcp.queryModel as ReturnType<typeof vi.fn>).mockResolvedValue(
      "Havalandırma kanalı metrajı: 42 m.",
    );
    const assistant = new Assistant({ erp: mockErp(), mcp });

    const reply = await assistant.answer(
      "3. kattaki havalandırma kanalı metrajı ne?",
    );

    expect(reply.route).toBe("bim");
    expect(mcp.queryModel).toHaveBeenCalledTimes(1);
    expect(mcp.queryModel).toHaveBeenCalledWith(
      "3. kattaki havalandırma kanalı metrajı ne?",
    );
    expect(reply.text).toBe("Havalandırma kanalı metrajı: 42 m.");
  });

  it("MCP enjekte edilmemişse çalışan bir MCP varmış gibi davranmaz", async () => {
    const assistant = new Assistant({ erp: mockErp() });

    const reply = await assistant.answer(
      "3. kattaki havalandırma kanalı metrajı ne?",
    );

    expect(reply.route).toBe("bim");
    expect(reply.text).toContain("MCP");
  });
});

describe("unknown yönlendirme yolu", () => {
  it("iki arka ucu da çağırmadan 'unknown' döner", async () => {
    const erp = mockErp();
    const assistant = new Assistant({ erp });

    const reply = await assistant.answer("bugün hava nasıl?");

    expect(reply.route).toBe("unknown");
    expect(erp.queryBoq).not.toHaveBeenCalled();
    expect(erp.queryCostItem).not.toHaveBeenCalled();
  });
});

describe("createDefaultAssistant (varsayılan ERP adaptörü)", () => {
  afterEach(() => {
    setErpClient(createErpClientFromEnv());
  });

  it("deps'i gerçek Task 2.3 queryBoq/queryCostItem fonksiyonlarına bağlar", () => {
    const assistant = createDefaultAssistant();

    expect(assistant.deps.erp.queryBoq).toBe(queryBoq);
    expect(assistant.deps.erp.queryCostItem).toBe(queryCostItem);
    expect(assistant.deps.mcp).toBeUndefined();
  });

  it("enjekte edilen istemciyle, canlı ERP ve ağ olmadan çağrılabilir", async () => {
    const mockFetch = vi.fn<
      (input: string, init?: RequestInit) => Promise<Response>
    >();
    setErpClient(
      new ErpClient({
        baseUrl: "https://erp.example.com",
        fetch: mockFetch,
      }),
    );
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "boq-1", positions: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const assistant = createDefaultAssistant();
    const boq = await assistant.deps.erp.queryBoq("demo-project");

    expect(boq.id).toBe("boq-1");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
