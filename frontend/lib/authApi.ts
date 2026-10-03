export type AuthRole = 'admin' | 'guest' | 'anonymous';

export interface AuthSession {
  role: AuthRole;
  public_mode: boolean;
}

const AUTH_MARKER = 'mujian_authenticated_role';

export function redirectForAnonymous() {
  if (typeof window === 'undefined' || window.location.pathname === '/login') return;
  const expired = window.sessionStorage.getItem(AUTH_MARKER) === 'guest';
  window.location.replace(expired ? '/login?expired=1' : '/login');
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, { credentials: 'same-origin', ...init });
  if (response.status === 401) redirectForAnonymous();
  return response;
}

async function authRequest(path: string, options?: RequestInit) {
  const response = await fetch(path, { credentials: 'same-origin', ...options });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.detail || '身份验证失败');
  }
  return response;
}

export async function fetchAuthSession(): Promise<AuthSession> {
  const response = await fetch('/api/auth/me', { credentials: 'same-origin' });
  if (!response.ok) throw new Error('读取登录状态失败');
  return response.json();
}

export async function loginWithPassword(password: string) {
  await authRequest('/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }),
  });
  window.sessionStorage.setItem(AUTH_MARKER, 'admin');
}

export async function loginWithInvite(invite_code: string) {
  await authRequest('/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invite_code }),
  });
  window.sessionStorage.setItem(AUTH_MARKER, 'guest');
}

export async function logoutSession() {
  await authRequest('/api/auth/logout', { method: 'POST' });
  window.sessionStorage.removeItem(AUTH_MARKER);
}

export interface InviteCode {
  code: string;
  note?: string;
  expires_at?: string;
  revoked?: boolean;
  last_used_at?: string | null;
}

export async function fetchInvites(): Promise<InviteCode[]> {
  const response = await authRequest('/api/admin/invites');
  return (await response.json()).invites || [];
}

export async function createInvite(note: string, hours: number): Promise<InviteCode> {
  const response = await authRequest('/api/admin/invites', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note, expires_in_hours: hours }),
  });
  const payload = await response.json();
  return payload.invite || payload;
}

export async function revokeInvite(code: string) {
  await authRequest(`/api/admin/invites/${encodeURIComponent(code)}`, { method: 'DELETE' });
}

export async function setSessionShowcase(sessionId: string, showcase: boolean) {
  await authRequest(`/api/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ showcase }),
  });
}

export interface DailyUsage {
  date: string;
  total_cny: string;
  limit_cny: string | null;
  remaining_cny: string | null;
}

export async function fetchDailyUsage(): Promise<DailyUsage> {
  const response = await authRequest('/api/admin/usage');
  return response.json();
}
