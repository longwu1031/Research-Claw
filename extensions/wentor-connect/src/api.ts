/**
 * Wentor.ai API Client
 *
 * HTTP client for communicating with the wentor.ai platform API.
 * Handles authentication token injection, retry logic, and error normalization.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WentorApiConfig {
  /** Base URL for the wentor.ai API (default: https://wentor.ai) */
  baseUrl: string;
  /** OAuth2 access token, refreshed by the auth module */
  accessToken?: string;
  /** Request timeout in ms (default: 30000) */
  timeoutMs: number;
  /** User-Agent header for API requests */
  userAgent: string;
}

export interface ApiResponse<T = unknown> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  avatar_url: string | null;
  created_at: string;
}

export interface SkillSyncPayload {
  skills: SkillEntry[];
  client_version: string;
  timestamp: string;
}

export interface SkillEntry {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  source: 'builtin' | 'plugin' | 'user';
}

export interface ActivitySummary {
  period: string;
  papers_read: number;
  papers_added: number;
  tasks_completed: number;
  tasks_created: number;
  reading_minutes: number;
  highlights: string[];
}

// ---------------------------------------------------------------------------
// API Client
// ---------------------------------------------------------------------------

export class WentorApiClient {
  private config: WentorApiConfig;

  constructor(config: Partial<WentorApiConfig> = {}) {
    this.config = {
      baseUrl: config.baseUrl ?? 'https://wentor.ai',
      accessToken: config.accessToken,
      timeoutMs: config.timeoutMs ?? 30_000,
      userAgent: config.userAgent ?? 'Research-Claw/0.3.0',
    };
  }

  // -----------------------------------------------------------------------
  // Configuration
  // -----------------------------------------------------------------------

  setAccessToken(token: string): void {
    this.config.accessToken = token;
  }

  clearAccessToken(): void {
    this.config.accessToken = undefined;
  }

  get baseUrl(): string {
    return this.config.baseUrl;
  }

  get isAuthenticated(): boolean {
    return !!this.config.accessToken;
  }

  // -----------------------------------------------------------------------
  // Core HTTP
  // -----------------------------------------------------------------------

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<ApiResponse<T>> {
    const url = `${this.config.baseUrl}/api/v1${path}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': this.config.userAgent,
    };

    if (this.config.accessToken) {
      headers['Authorization'] = `Bearer ${this.config.accessToken}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const contentType = response.headers.get('content-type') ?? '';
      let data: T | undefined;

      if (contentType.includes('application/json')) {
        data = (await response.json()) as T;
      }

      if (!response.ok) {
        const errorBody = data as unknown as { detail?: string; message?: string } | undefined;
        return {
          ok: false,
          status: response.status,
          error: errorBody?.detail ?? errorBody?.message ?? `HTTP ${response.status}`,
        };
      }

      return { ok: true, status: response.status, data };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes('abort')) {
        return { ok: false, status: 0, error: `Request timeout after ${this.config.timeoutMs}ms` };
      }
      return { ok: false, status: 0, error: errMsg };
    } finally {
      clearTimeout(timeout);
    }
  }

  // -----------------------------------------------------------------------
  // API Endpoints
  // -----------------------------------------------------------------------

  /** Get the authenticated user's profile. */
  async getProfile(): Promise<ApiResponse<UserProfile>> {
    return this.request<UserProfile>('GET', '/users/me');
  }

  /** Upload the local skills inventory to wentor.ai for sync. */
  async syncSkills(payload: SkillSyncPayload): Promise<ApiResponse<{ synced: number }>> {
    return this.request<{ synced: number }>('POST', '/connect/skills/sync', payload);
  }

  /** Download skills configuration from wentor.ai. */
  async downloadSkills(): Promise<ApiResponse<{ skills: SkillEntry[] }>> {
    return this.request<{ skills: SkillEntry[] }>('GET', '/connect/skills');
  }

  /** Upload a research activity summary to wentor.ai. */
  async uploadActivity(summary: ActivitySummary): Promise<ApiResponse<{ ok: boolean }>> {
    return this.request<{ ok: boolean }>('POST', '/connect/activity', summary);
  }

  /** Check if the server is reachable and the token is valid. */
  async healthCheck(): Promise<ApiResponse<{ status: string }>> {
    return this.request<{ status: string }>('GET', '/connect/health');
  }

  /** Exchange an authorization code for tokens (used during OAuth callback). */
  async exchangeCode(
    code: string,
    codeVerifier: string,
    redirectUri: string,
  ): Promise<ApiResponse<{ access_token: string; refresh_token: string; expires_in: number }>> {
    return this.request('POST', '/auth/oauth/token', {
      grant_type: 'authorization_code',
      code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
    });
  }

  /** Refresh the access token using a refresh token. */
  async refreshToken(
    refreshToken: string,
  ): Promise<ApiResponse<{ access_token: string; refresh_token: string; expires_in: number }>> {
    return this.request('POST', '/auth/oauth/token', {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });
  }

  /** Revoke a refresh token (logout). */
  async revokeToken(refreshToken: string): Promise<ApiResponse<void>> {
    return this.request('POST', '/auth/oauth/revoke', {
      token: refreshToken,
    });
  }
}
