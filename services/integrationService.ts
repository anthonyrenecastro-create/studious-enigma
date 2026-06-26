import { resolveAtlanteanApiBaseOrThrow, getStableSessionId } from './atlanteanService';

export interface IntegrationDescriptor {
  integration_id: string;
  name: string;
  capability: string;
  description: string;
  enabled: boolean;
  category: string;
  metadata: Record<string, any>;
}

export interface IntegrationRunResponse {
  success: boolean;
  integration_id: string;
  message: string;
  payload: Record<string, any>;
  result: Record<string, any>;
}

function getCandidateApiBases(): string[] {
  const bases = new Set<string>();
  bases.add(resolveAtlanteanApiBaseOrThrow());
  bases.add('/api/atlantean');

  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    const host = window.location.hostname;
    bases.add(`${origin}/api/atlantean`);

    if (host === 'localhost' || host === '127.0.0.1') {
      bases.add('http://127.0.0.1:3001/api/atlantean');
      bases.add('http://localhost:3001/api/atlantean');
      bases.add('http://127.0.0.1:5001/api/atlantean');
      bases.add('http://localhost:5001/api/atlantean');
    }
  }

  return Array.from(bases);
}

async function fetchIntegrationJson<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const bases = getCandidateApiBases();
  let lastError = 'Unknown integration API error';

  for (const base of bases) {
    const endpoint = `${base}${path}`;
    try {
      const response = await fetch(endpoint, init);
      const contentType = (response.headers.get('content-type') || '').toLowerCase();

      if (!response.ok) {
        lastError = `Integration request failed at ${endpoint}: ${response.status} ${response.statusText}`;
        continue;
      }

      // When stale dev/prod servers serve index.html on API paths, skip and try next base.
      if (contentType.includes('text/html')) {
        lastError = `Integration API returned HTML at ${endpoint} (expected JSON)`;
        continue;
      }

      return (await response.json()) as T;
    } catch (err) {
      lastError = err instanceof Error ? `${err.message} (${endpoint})` : String(err);
    }
  }

  throw new Error(lastError);
}

export async function listIntegrations(): Promise<IntegrationDescriptor[]> {
  const sessionId = getStableSessionId();
  return fetchIntegrationJson<IntegrationDescriptor[]>(`/integrations?session_id=${encodeURIComponent(sessionId)}`);
}

export async function runIntegration(
  integrationId: string,
  payload: Record<string, any> = {}
): Promise<IntegrationRunResponse> {
  const sessionId = getStableSessionId();
  return fetchIntegrationJson<IntegrationRunResponse>('/integrations/run', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ integration_id: integrationId, payload, session_id: sessionId }),
  });
}
