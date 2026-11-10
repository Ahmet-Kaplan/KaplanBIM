/**
 * OpenConstructionERP FastAPI istemcisi.
 *
 * Bu modül, KaplanBIM ajanının ERP'ye yaptığı HTTP çağrılarını tek bir yerden
 * yönetir: temel URL, SSO bearer token'ı (Task 2.2) ve enjekte edilebilir
 * taşıma katmanı (transport). Taşıma katmanının enjekte edilebilir olması,
 * birim testlerin canlı bir ERP'ye ihtiyaç duymadan çalışmasını sağlar.
 */

/** `fetch` benzeri HTTP taşıma fonksiyonu. Testlerde mock'lanır. */
export type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

/** ERP istemcisi yapılandırması. */
export interface ErpClientConfig {
  /** ERP temel URL'i, ör. `https://erp.ornekfirma.com` (sonda `/` olmadan). */
  baseUrl: string;
  /**
   * ERP `/auth/login` uç noktasından alınan SSO bearer token'ı (Task 2.2).
   * Verilirse her isteğe `Authorization: Bearer <token>` başlığı eklenir.
   */
  accessToken?: string;
  /** Enjekte edilebilir HTTP taşıma katmanı. Varsayılan: `globalThis.fetch`. */
  fetch?: FetchLike;
}

/** ERP'den gelen HTTP-dışı (non-2xx) yanıtları temsil eden hata. */
export class ErpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ErpError";
    this.status = status;
  }
}

/** ERP FastAPI istemcisi. */
export class ErpClient {
  private readonly baseUrl: string;
  private readonly accessToken?: string;
  private readonly fetchFn: FetchLike;

  constructor(config: ErpClientConfig) {
    if (!config.baseUrl) {
      throw new Error("ErpClient requires a non-empty baseUrl");
    }
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.accessToken = config.accessToken;
    this.fetchFn =
      config.fetch ?? ((input, init) => globalThis.fetch(input, init));
  }

  /**
   * Bir GET isteği yapar ve JSON gövdesini `T` olarak döner.
   * 2xx dışı yanıtlarda `ErpError` fırlatır (sessiz kabul yok).
   */
  async get<T>(
    path: string,
    params?: Record<string, string | number | undefined>,
  ): Promise<T> {
    const url = new URL(this.baseUrl + path);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const headers: Record<string, string> = { Accept: "application/json" };
    if (this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    }

    const response = await this.fetchFn(url.toString(), {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      let detail = "";
      try {
        detail = (await response.text()).slice(0, 500);
      } catch {
        // gövde okunamıyorsa detay boş kalır
      }
      throw new ErpError(
        response.status,
        `ERP GET ${path} başarısız: HTTP ${response.status}${detail ? ` — ${detail}` : ""}`,
      );
    }

    return (await response.json()) as T;
  }
}

/**
 * Varsayılan ERP istemcisini ortam değişkenlerinden kurar.
 * `ERP_BASE_URL` ve `ERP_ACCESS_TOKEN` (ikisi de isteğe bağlıdır).
 */
export function createErpClientFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): ErpClient {
  return new ErpClient({
    baseUrl: env.ERP_BASE_URL ?? "http://localhost:8000",
    accessToken: env.ERP_ACCESS_TOKEN,
  });
}
