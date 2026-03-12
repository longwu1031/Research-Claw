/**
 * Wentor Connect — OAuth2 PKCE Authentication Flow
 *
 * Implements the OAuth2 Authorization Code flow with PKCE (Proof Key for
 * Code Exchange) for secure authentication with the wentor.ai platform.
 *
 * Flow:
 *   1. Generate code_verifier (random 43-128 char string)
 *   2. Derive code_challenge = base64url(sha256(code_verifier))
 *   3. Open browser to authorization URL with code_challenge
 *   4. Start local HTTP server to receive callback with auth code
 *   5. Exchange auth code + code_verifier for tokens
 *   6. Store tokens securely in the local config
 */

import { createHash, randomBytes } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { URL } from 'node:url';

import { WentorApiClient } from './api.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number; // Unix timestamp in ms
}

export interface AuthConfig {
  /** Base URL of the wentor.ai platform */
  baseUrl: string;
  /** OAuth2 client ID for Research-Claw */
  clientId: string;
  /** Port for the local callback server (default: 19876) */
  callbackPort: number;
  /** Scopes to request (default: ['profile', 'skills:sync', 'activity:write']) */
  scopes: string[];
}

export interface AuthState {
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  username: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_CLIENT_ID = 'research-claw-local';
const DEFAULT_CALLBACK_PORT = 19876;
const DEFAULT_SCOPES = ['profile', 'skills:sync', 'activity:write'];
const VERIFIER_LENGTH = 64; // characters
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // Refresh 5 min before expiry

// ---------------------------------------------------------------------------
// PKCE Helpers
// ---------------------------------------------------------------------------

/** Generate a cryptographically random code verifier (43-128 URL-safe characters). */
export function generateCodeVerifier(length: number = VERIFIER_LENGTH): string {
  const bytes = randomBytes(Math.ceil((length * 3) / 4));
  return bytes
    .toString('base64url')
    .slice(0, length);
}

/** Derive the code challenge from a code verifier using SHA-256. */
export function generateCodeChallenge(verifier: string): string {
  const hash = createHash('sha256').update(verifier, 'utf-8').digest();
  return hash.toString('base64url');
}

// ---------------------------------------------------------------------------
// AuthManager
// ---------------------------------------------------------------------------

export class AuthManager {
  private config: AuthConfig;
  private api: WentorApiClient;
  private tokens: AuthTokens | null = null;
  private username: string | null = null;

  /** Callback for persisting tokens (injected by plugin entry point). */
  onTokensChanged: ((tokens: AuthTokens | null) => void) | null = null;

  constructor(
    api: WentorApiClient,
    config: Partial<AuthConfig> = {},
  ) {
    this.api = api;
    this.config = {
      baseUrl: config.baseUrl ?? 'https://wentor.ai',
      clientId: config.clientId ?? DEFAULT_CLIENT_ID,
      callbackPort: config.callbackPort ?? DEFAULT_CALLBACK_PORT,
      scopes: config.scopes ?? DEFAULT_SCOPES,
    };
  }

  // -----------------------------------------------------------------------
  // State
  // -----------------------------------------------------------------------

  get state(): AuthState {
    return {
      tokens: this.tokens,
      isAuthenticated: this.tokens !== null && Date.now() < this.tokens.expires_at,
      username: this.username,
    };
  }

  /** Load previously persisted tokens. */
  loadTokens(tokens: AuthTokens | null): void {
    this.tokens = tokens;
    if (tokens) {
      this.api.setAccessToken(tokens.access_token);
    }
  }

  // -----------------------------------------------------------------------
  // Login flow
  // -----------------------------------------------------------------------

  /**
   * Build the authorization URL for the browser.
   * Returns the URL and the code verifier (must be kept for the exchange step).
   */
  buildAuthorizationUrl(): { url: string; codeVerifier: string } {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const redirectUri = `http://127.0.0.1:${this.config.callbackPort}/callback`;

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: redirectUri,
      scope: this.config.scopes.join(' '),
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      prompt: 'consent',
    });

    const url = `${this.config.baseUrl}/oauth/authorize?${params.toString()}`;
    return { url, codeVerifier };
  }

  /**
   * Start the OAuth login flow.
   *
   * 1. Start a local HTTP server to listen for the callback.
   * 2. Return the authorization URL for the caller to open in a browser.
   * 3. Wait for the callback with the auth code.
   * 4. Exchange the code for tokens.
   * 5. Fetch the user profile.
   *
   * @returns A promise that resolves when the login is complete.
   */
  async login(): Promise<{
    authUrl: string;
    waitForCompletion: () => Promise<AuthState>;
  }> {
    const { url: authUrl, codeVerifier } = this.buildAuthorizationUrl();
    const redirectUri = `http://127.0.0.1:${this.config.callbackPort}/callback`;

    const waitForCompletion = (): Promise<AuthState> => {
      return new Promise<AuthState>((resolve, reject) => {
        const server = createServer(
          async (req: IncomingMessage, res: ServerResponse) => {
            const reqUrl = new URL(req.url ?? '/', `http://127.0.0.1:${this.config.callbackPort}`);

            if (reqUrl.pathname !== '/callback') {
              res.writeHead(404, { 'Content-Type': 'text/plain' });
              res.end('Not found');
              return;
            }

            const code = reqUrl.searchParams.get('code');
            const error = reqUrl.searchParams.get('error');

            if (error) {
              const description = reqUrl.searchParams.get('error_description') ?? error;
              res.writeHead(400, { 'Content-Type': 'text/html' });
              res.end(`<html><body><h1>Authentication Failed</h1><p>${description}</p><p>You can close this tab.</p></body></html>`);
              server.close();
              reject(new Error(`OAuth error: ${description}`));
              return;
            }

            if (!code) {
              res.writeHead(400, { 'Content-Type': 'text/html' });
              res.end('<html><body><h1>Missing Code</h1><p>No authorization code received.</p></body></html>');
              server.close();
              reject(new Error('No authorization code received'));
              return;
            }

            // Exchange code for tokens
            try {
              const tokenResult = await this.api.exchangeCode(code, codeVerifier, redirectUri);
              if (!tokenResult.ok || !tokenResult.data) {
                throw new Error(tokenResult.error ?? 'Token exchange failed');
              }

              const { access_token, refresh_token, expires_in } = tokenResult.data;
              this.tokens = {
                access_token,
                refresh_token,
                expires_at: Date.now() + expires_in * 1000,
              };
              this.api.setAccessToken(access_token);

              // Persist tokens
              this.onTokensChanged?.(this.tokens);

              // Fetch user profile
              const profileResult = await this.api.getProfile();
              if (profileResult.ok && profileResult.data) {
                this.username = profileResult.data.username;
              }

              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end(
                `<html><body>
                <h1>Research-Claw Connected!</h1>
                <p>Logged in as <strong>${this.username ?? 'user'}</strong>.</p>
                <p>You can close this tab and return to Research-Claw.</p>
                </body></html>`,
              );

              server.close();
              resolve(this.state);
            } catch (err) {
              res.writeHead(500, { 'Content-Type': 'text/html' });
              res.end(
                `<html><body><h1>Error</h1><p>${err instanceof Error ? err.message : String(err)}</p></body></html>`,
              );
              server.close();
              reject(err);
            }
          },
        );

        server.listen(this.config.callbackPort, '127.0.0.1');

        // Auto-close after 5 minutes (user abandoned the flow)
        const timeout = setTimeout(() => {
          server.close();
          reject(new Error('Login timed out after 5 minutes'));
        }, 5 * 60 * 1000);

        server.on('close', () => clearTimeout(timeout));
      });
    };

    return { authUrl, waitForCompletion };
  }

  // -----------------------------------------------------------------------
  // Token refresh
  // -----------------------------------------------------------------------

  /** Refresh the access token if it is close to expiring. */
  async ensureFreshToken(): Promise<boolean> {
    if (!this.tokens) return false;

    // Check if token still has enough time
    if (Date.now() + TOKEN_REFRESH_BUFFER_MS < this.tokens.expires_at) {
      return true; // Token is still fresh
    }

    // Refresh
    const result = await this.api.refreshToken(this.tokens.refresh_token);
    if (!result.ok || !result.data) {
      // Refresh failed — clear tokens
      this.tokens = null;
      this.api.clearAccessToken();
      this.onTokensChanged?.(null);
      return false;
    }

    const { access_token, refresh_token, expires_in } = result.data;
    this.tokens = {
      access_token,
      refresh_token,
      expires_at: Date.now() + expires_in * 1000,
    };
    this.api.setAccessToken(access_token);
    this.onTokensChanged?.(this.tokens);
    return true;
  }

  // -----------------------------------------------------------------------
  // Logout
  // -----------------------------------------------------------------------

  async logout(): Promise<void> {
    if (this.tokens?.refresh_token) {
      await this.api.revokeToken(this.tokens.refresh_token).catch(() => {});
    }
    this.tokens = null;
    this.username = null;
    this.api.clearAccessToken();
    this.onTokensChanged?.(null);
  }
}
