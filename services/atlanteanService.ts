/**
 * Atlantean Intelligence Service
 * 
 * TypeScript client for the Atlantean Backend API.
 * This replaces traditional state management with field-based intelligence.
 */

const ATLANTEAN_API_BASE = import.meta.env.VITE_ATLANTEAN_API_BASE || '/api/atlantean';
const ATLANTEAN_SESSION_STORAGE_KEY = 'atlantean.session_id';

function generateSessionId(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `atl-${Date.now()}-${rand}`;
}

export function getStableSessionId(): string {
  if (typeof window === 'undefined' || !window.localStorage) {
    return 'default';
  }

  try {
    const existing = window.localStorage.getItem(ATLANTEAN_SESSION_STORAGE_KEY);
    if (existing && existing.trim()) {
      return existing;
    }

    const created = generateSessionId();
    window.localStorage.setItem(ATLANTEAN_SESSION_STORAGE_KEY, created);
    return created;
  } catch {
    return 'default';
  }
}

function resolveSessionId(sessionId?: string): string {
  return sessionId || getStableSessionId();
}

export interface AtlanteanStatus {
  device_id: string;
  version: number;
  last_update: string;
  learning_capacity: number;
  cold_memory_items: number;
  fingerprint: string | null;
  field_stats: {
    phi1_mean: number;
    phi5_mean: number;
    Phi: number;
  };
}

export interface FieldData {
  phi1: number[][];
  phi5: number[][];
  Phi: number;
  version: number;
  timestamp: number;
  learning_capacity: number;
  stats: {
    phi1_mean: number;
    phi1_std: number;
    phi5_mean: number;
    phi5_std: number;
  };
}

export interface QueryResponse {
  response: string;
  status: AtlanteanStatus;
}

export interface ColdManifest {
  manifest_id: string;
  attached_at?: number;
  detached_at?: number | null;
  detached?: boolean;
  item_ids?: string[];
  metadata?: Record<string, any>;
}

export interface ReplayIntegrityProof {
  session_id: string;
  events_total: number;
  events_verified: number;
  replay_state_hash: string | null;
  live_state_hash: string;
  match: boolean;
  valid: boolean;
  issues: Array<Record<string, any>>;
  replay_head_hash: string;
  verified_up_to_seq: number | null;
}

export type LearningEventType =
  | 'user_confirmation'
  | 'user_correction'
  | 'user_positive_feedback'
  | 'user_negative_feedback'
  | 'prediction_success'
  | 'prediction_failure'
  | 'simulation_complete'
  | 'voice_session_end'
  | 'helpful_response'
  | 'unhelpful_response'
  | 'clarification_needed'
  | 'high_engagement'
  | 'low_engagement';

/**
 * Get current intelligence status
 */
export async function getStatus(sessionId?: string): Promise<AtlanteanStatus> {
  const sid = resolveSessionId(sessionId);
  const response = await fetch(`${ATLANTEAN_API_BASE}/status?session_id=${encodeURIComponent(sid)}`);
  if (!response.ok) {
    throw new Error(`Failed to get status: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Process user query through Atlantean-powered LLM
 * 
 * @param input User's message
 * @param llmProvider Which LLM to use (gemini, edenai, etc.)
 * @param apiKey Optional API key for the LLM provider
 * @returns LLM response and updated status
 */
export async function query(
  input: string,
  llmProvider: 'gemini' | 'edenai' | 'mock' = 'gemini',
  apiKey?: string,
  history: Array<{ role: string; content: string }> = [],
  sessionId?: string
): Promise<QueryResponse> {
  const sid = resolveSessionId(sessionId);
  const body: any = { 
    input, 
    llm_provider: llmProvider,
    session_id: sid,
  };
  
  if (apiKey) {
    body.api_key = apiKey;
  }

  if (history.length > 0) {
    body.history = history;
  }

  const response = await fetch(`${ATLANTEAN_API_BASE}/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  
  if (!response.ok) {
    throw new Error(`Query failed: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Get field visualization data
 */
export async function getFields(sessionId?: string): Promise<FieldData> {
  const sid = resolveSessionId(sessionId);
  const response = await fetch(`${ATLANTEAN_API_BASE}/fields?session_id=${encodeURIComponent(sid)}`);
  if (!response.ok) {
    throw new Error(`Failed to get fields: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Trigger a learning event
 * 
 * Call this when user provides feedback or interactions complete.
 * This is how the intelligence learns!
 * 
 * @param event Type of learning event
 * @param data Event-specific data
 */
export async function triggerLearningEvent(
  event: LearningEventType,
  data: Record<string, any> = {},
  sessionId?: string
): Promise<{ success: boolean; status: AtlanteanStatus }> {
  const sid = resolveSessionId(sessionId);
  const response = await fetch(`${ATLANTEAN_API_BASE}/learning-event`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ event, data, session_id: sid }),
  });
  
  if (!response.ok) {
    throw new Error(`Learning event failed: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Store a simulation in cold memory
 */
export async function storeSimulation(
  simulation: any,
  confidence: number = 0.5,
  sessionId?: string
): Promise<{ success: boolean }> {
  const sid = resolveSessionId(sessionId);
  const response = await fetch(`${ATLANTEAN_API_BASE}/simulation/store`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ simulation, confidence, session_id: sid }),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to store simulation: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * List all stored simulations directly from backend (reliable, no embedding)
 */
export async function recallSimulations(
  searchQuery: string,
  limit: number = 50,
  sessionId?: string
): Promise<any[]> {
  const sid = resolveSessionId(sessionId);
  // Prefer /list (direct Redis listing). Fallback to /recall for backward compatibility.
  const listResponse = await fetch(
    `${ATLANTEAN_API_BASE}/simulation/list?limit=${limit}&session_id=${encodeURIComponent(sid)}`
  );
  if (listResponse.ok) {
    const data = await listResponse.json();
    return data.simulations || [];
  }

  if (listResponse.status !== 404) {
    throw new Error(`Failed to list simulations: ${listResponse.statusText}`);
  }

  const recallResponse = await fetch(`${ATLANTEAN_API_BASE}/simulation/recall`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: searchQuery, limit, session_id: sid }),
  });

  if (!recallResponse.ok) {
    throw new Error(`Failed to recall simulations: ${recallResponse.statusText}`);
  }

  const recallData = await recallResponse.json();
  return recallData.simulations || [];
}

/**
 * Create a labeled snapshot for Neural Archives
 */
export async function createSnapshot(
  label?: string,
  sessionId?: string
): Promise<{ snapshot: any }> {
  const sid = resolveSessionId(sessionId);
  const response = await fetch(`${ATLANTEAN_API_BASE}/snapshot`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ label, session_id: sid }),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to create snapshot: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * List cold-memory manifests for detachable memory management
 */
export async function listColdManifests(
  includeDetached: boolean = false,
  sessionId?: string
): Promise<{ session_id: string; manifests: ColdManifest[] }> {
  const sid = resolveSessionId(sessionId);
  const params = new URLSearchParams();
  if (includeDetached) params.set('include_detached', 'true');
  params.set('session_id', sid);
  const suffix = params.toString() ? `?${params.toString()}` : '';

  const response = await fetch(`${ATLANTEAN_API_BASE}/cold/manifests${suffix}`);
  if (!response.ok) {
    throw new Error(`Failed to list cold manifests: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Export a detachable cold-memory manifest bundle
 */
export async function exportColdManifest(
  manifestId: string,
  sessionId?: string
): Promise<{ session_id: string; manifest: any }> {
  const sid = resolveSessionId(sessionId);
  const params = new URLSearchParams({ manifest_id: manifestId });
  params.set('session_id', sid);

  const response = await fetch(`${ATLANTEAN_API_BASE}/cold/manifest/export?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to export cold manifest: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Import a detachable cold-memory manifest bundle
 */
export async function importColdManifest(
  manifest: any,
  sessionId?: string
): Promise<{ session_id: string; result: any }> {
  const sid = resolveSessionId(sessionId);
  const body: any = { manifest };
  body.session_id = sid;

  const response = await fetch(`${ATLANTEAN_API_BASE}/cold/manifest/import`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Failed to import cold manifest: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Tombstone a cold-memory item while preserving lineage
 */
export async function tombstoneColdItem(
  itemId: string,
  reason: string = 'manual',
  sessionId?: string
): Promise<{ success: boolean; session_id: string; item_id: string; reason: string }> {
  const sid = resolveSessionId(sessionId);
  const body: any = {
    item_id: itemId,
    reason,
    session_id: sid,
  };

  const response = await fetch(`${ATLANTEAN_API_BASE}/cold/tombstone`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Failed to tombstone cold item: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Prepare sync package for multi-device
 */
export async function prepareSyncPackage(): Promise<{ package: any }> {
  const response = await fetch(`${ATLANTEAN_API_BASE}/sync/prepare`);
  if (!response.ok) {
    throw new Error(`Failed to prepare sync: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Merge sync package from another device
 */
export async function mergeSyncPackage(
  syncPackage: any
): Promise<{ success: boolean; status: AtlanteanStatus }> {
  const response = await fetch(`${ATLANTEAN_API_BASE}/sync/merge`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ package: syncPackage }),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to merge sync: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Reset intelligence state (for testing/debugging)
 */
export async function resetIntelligence(): Promise<{ success: boolean }> {
  const response = await fetch(`${ATLANTEAN_API_BASE}/reset`, {
    method: 'POST',
  });
  
  if (!response.ok) {
    throw new Error(`Failed to reset: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Manually save intelligence state
 */
export async function saveState(): Promise<{ success: boolean }> {
  const response = await fetch(`${ATLANTEAN_API_BASE}/save`, {
    method: 'POST',
  });
  
  if (!response.ok) {
    throw new Error(`Failed to save: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Check if Atlantean backend is running
 */
export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch('http://localhost:5001/health');
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Deterministic replay integrity proof (ledger-derived state hash vs live state hash)
 */
export async function replayIntegrityProof(
  sessionId?: string
): Promise<ReplayIntegrityProof> {
  const sid = resolveSessionId(sessionId);
  const params = new URLSearchParams();
  params.set('session_id', sid);
  const suffix = params.toString() ? `?${params.toString()}` : '';

  const response = await fetch(`${ATLANTEAN_API_BASE}/integrity/replay${suffix}`);
  if (!response.ok) {
    throw new Error(`Failed replay proof: ${response.statusText}`);
  }
  return response.json();
}
