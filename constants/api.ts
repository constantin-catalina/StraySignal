import Constants from 'expo-constants';



function computeBaseUrl() {
  const fromEnv = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  
  return 'http://localhost:3000';
}

function normalizeBase(raw: string) {
  
  try {
    if (/^http:\/\/localhost(?::\d+)?$/.test(raw)) {
      const hostUri: string | undefined =
        (Constants as any)?.expoConfig?.hostUri ||
        (Constants as any)?.manifest2?.extra?.expoClient?.hostUri ||
        (Constants as any)?.manifest?.hostUri;
      if (hostUri && hostUri.includes(':')) {
        const host = hostUri.split(':')[0];
        if (host && host !== 'localhost') {
          const port = raw.split(':')[2] || '3000';
          return `http://${host}:${port}`;
        }
      }
    }
  } catch {}
  return raw;
}

const rawBase = normalizeBase(computeBaseUrl());
export const API_BASE_URL = `${rawBase.replace(/\/$/, '')}/api`;

export const API_ENDPOINTS = {
  REPORTS: `${API_BASE_URL}/reports`,
  REPORTS_LOST_PET: `${API_BASE_URL}/reports/lost-pet`,
  REPORTS_NEARBY: `${API_BASE_URL}/reports/nearby`,
  USERS: `${API_BASE_URL}/users`,
  HEALTH: `${API_BASE_URL}/health`,
  MATCHES: `${API_BASE_URL}/matches`,
  CHAT_OPEN: `${API_BASE_URL}/chat/open`,
  CHAT_CONVERSATIONS: `${API_BASE_URL}/chat/conversations`,
  CHAT_MESSAGES: `${API_BASE_URL}/chat/messages`,
};


export async function pingHealth(timeoutMs: number = 4000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(API_ENDPOINTS.HEALTH, { signal: controller.signal });
    clearTimeout(t);
    return res.ok;
  } catch {
    clearTimeout(t);
    return false;
  }
}
