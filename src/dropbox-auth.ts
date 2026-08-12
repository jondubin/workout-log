import { Dropbox, DropboxAuth } from "dropbox";

const clientId = import.meta.env.VITE_DROPBOX_CLIENT_ID as string | undefined;
const tokenKey = "workout-log:dropbox-tokens";

type Tokens = { accessToken: string; refreshToken: string; expiresAt: number };

const getTokens = (): Tokens | null => {
  const value = localStorage.getItem(tokenKey);
  return value ? JSON.parse(value) as Tokens : null;
};
const saveTokens = (tokens: Tokens) => localStorage.setItem(tokenKey, JSON.stringify(tokens));

export const isConfigured = () => Boolean(clientId);
export const isLoggedIn = () => Boolean(getTokens());
export const logout = () => localStorage.removeItem(tokenKey);

export async function startLogin() {
  if (!clientId) throw new Error("Dropbox is not configured yet.");
  const auth = new DropboxAuth({ clientId });
  const redirectUri = window.location.origin + window.location.pathname;
  const url = await auth.getAuthenticationUrl(redirectUri, undefined, "code", "offline", undefined, undefined, true);
  sessionStorage.setItem("workout-log:code-verifier", auth.getCodeVerifier());
  window.location.href = url as string;
}

export async function completeLogin() {
  const code = new URLSearchParams(window.location.search).get("code");
  const verifier = sessionStorage.getItem("workout-log:code-verifier");
  if (!code || !verifier || !clientId) return false;
  const auth = new DropboxAuth({ clientId });
  auth.setCodeVerifier(verifier);
  const response = await auth.getAccessTokenFromCode(window.location.origin + window.location.pathname, code);
  const result = response.result as { access_token: string; refresh_token: string; expires_in: number };
  saveTokens({ accessToken: result.access_token, refreshToken: result.refresh_token, expiresAt: Date.now() + result.expires_in * 1000 });
  sessionStorage.removeItem("workout-log:code-verifier");
  window.history.replaceState({}, "", window.location.pathname);
  return true;
}

export async function getClient() {
  const tokens = getTokens();
  if (!tokens || !clientId) throw new Error("Not logged in to Dropbox.");
  const auth = new DropboxAuth({ clientId, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
  if (Date.now() > tokens.expiresAt - 60_000) {
    await auth.refreshAccessToken();
    saveTokens({ accessToken: auth.getAccessToken(), refreshToken: tokens.refreshToken, expiresAt: auth.getAccessTokenExpiresAt().getTime() });
  }
  return new Dropbox({ auth });
}
