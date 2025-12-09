export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface HttpClientOptions {
  baseUrl?: string;
  token?: string;
  timeoutMs?: number;
}

export interface RequestOptions<TBody = unknown> {
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: TBody;
  signal?: AbortSignal;
}

function getEnv(key: string): string | undefined {
  // Vite заменит import.meta.env на конкретные значения во время сборки
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const env = (import.meta as any).env as Record<string, string | undefined>;
  return env[key];
}

export class HttpClient {
  private readonly baseUrl: string | undefined;
  private readonly token: string | undefined;
  private readonly timeoutMs: number;

  constructor(options?: HttpClientOptions) {
    this.baseUrl = options?.baseUrl ?? getEnv("VITE_API_BASE_URL");
    this.token = options?.token ?? getEnv("VITE_API_TOKEN");
    this.timeoutMs = options?.timeoutMs ?? 15000;
  }

  get isConfigured(): boolean {
    return !!this.baseUrl;
  }

  async request<TResponse = unknown, TBody = unknown>(path: string, options?: RequestOptions<TBody>): Promise<TResponse> {
    if (!this.baseUrl) {
      throw new Error("API base URL is not configured");
    }

    // Динамический импорт для избежания циклических зависимостей
    const { logger } = await import("@/lib/logger");
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const method = options?.method ?? "GET";
    const url = `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
    const startTime = Date.now();

    try {
      logger.api(method, url, options?.body);
      
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(options?.headers ?? {}),
      };

      if (this.token) {
        headers.Authorization = `Bearer ${this.token}`;
      }

      const response = await fetch(url, {
        method,
        headers,
        body: options?.body ? JSON.stringify(options.body) : undefined,
        signal: options?.signal ?? controller.signal,
      });

      const duration = Date.now() - startTime;

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        const error = new Error(`HTTP ${response.status}: ${text || response.statusText}`);
        logger.apiError(method, url, error, response.status);
        throw error;
      }

      // Пустой ответ
      if (response.status === 204) {
        logger.apiSuccess(method, url, undefined);
        return undefined as unknown as TResponse;
      }

      const data = await response.json() as TResponse;
      logger.apiSuccess(method, url, data);
      return data;
    } catch (error) {
      const duration = Date.now() - startTime;
      if (error instanceof Error && error.name === 'AbortError') {
        logger.warn('http', `Запрос прерван по таймауту: ${method} ${url}`, { duration });
      } else {
        logger.apiError(method, url, error as Error);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const httpClient = new HttpClient();


