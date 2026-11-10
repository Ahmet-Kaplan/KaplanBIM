import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FetchLike } from "../src/client.js";
import { ErpClient } from "../src/client.js";
import { queryBoq, queryCostItem, setErpClient } from "../src/queries.js";

const BASE_URL = "https://erp.example.com";
const TOKEN = "test-access-token";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("ERP bridge (hermetic — mocked HTTP transport)", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    const client = new ErpClient({
      baseUrl: BASE_URL,
      accessToken: TOKEN,
      fetch: mockFetch as unknown as FetchLike,
    });
    setErpClient(client);
  });

  it("queryBoq returns positions for a project", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        id: "boq-1",
        projectId: "demo-project",
        positions: [
          {
            code: "P-001",
            description: "Beton C25/30",
            unit: "m3",
            quantity: 42.5,
          },
        ],
      }),
    );

    const boq = await queryBoq("demo-project");

    expect(boq.positions.length).toBeGreaterThan(0);
    expect(boq.positions[0].description).toBe("Beton C25/30");

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/v1/boqs/demo-project");
  });

  it("queryCostItem returns cost items for a region and query", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse([
        { id: "c-1", code: "C25/30", description: "Beton C25/30", unit: "m3", rate: "1250.00", currency: "TRY" },
        { id: "c-2", code: "C30/37", description: "Beton C30/37", unit: "m3", rate: "1350.00", currency: "TRY" },
      ]),
    );

    const items = await queryCostItem("TR_NATIONAL", "C25/30");

    expect(items).toHaveLength(2);
    expect(items[0].currency).toBe("TRY");

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/v1/costs/");
    expect(url).toContain("region=TR_NATIONAL");
    expect(url).toContain("q=C25%2F30");
  });

  it("attaches the SSO bearer token to every request", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: "boq-1", positions: [] }));

    await queryBoq("demo-project");

    const [, init] = mockFetch.mock.calls[0];
    expect(init?.headers).toMatchObject({ Authorization: `Bearer ${TOKEN}` });
  });

  it("rejects non-2xx responses with ErpError (no silent accept)", async () => {
    mockFetch.mockResolvedValueOnce(new Response("Unauthorized", { status: 401 }));

    await expect(queryBoq("demo-project")).rejects.toMatchObject({
      name: "ErpError",
      status: 401,
    });
  });
});
