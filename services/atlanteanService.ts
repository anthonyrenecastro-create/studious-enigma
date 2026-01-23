/**
 * Atlantean Intelligence Service
 * 
 * TypeScript client for the Atlantean Backend API.
 * This replaces traditional state management with field-based intelligence.
 */

const ATLANTEAN_API_BASE = 'http://localhost:5001/api/atlantean';

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
export async function getStatus(): Promise<AtlanteanStatus> {
  const response = await fetch(`${ATLANTEAN_API_BASE}/status`);
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
  apiKey?: string
): Promise<QueryResponse> {
  const body: any = { 
    input, 
    llm_provider: llmProvider 
  };
  
  if (apiKey) {
    body.api_key = apiKey;
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
export async function getFields(): Promise<FieldData> {
  const response = await fetch(`${ATLANTEAN_API_BASE}/fields`);
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
  data: Record<string, any> = {}
): Promise<{ success: boolean; status: AtlanteanStatus }> {
  const response = await fetch(`${ATLANTEAN_API_BASE}/learning-event`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ event, data }),
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
  confidence: number = 0.5
): Promise<{ success: boolean }> {
  const response = await fetch(`${ATLANTEAN_API_BASE}/simulation/store`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ simulation, confidence }),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to store simulation: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Recall past simulations from cold memory
 */
export async function recallSimulations(
  searchQuery: string,
  limit: number = 10
): Promise<{ simulations: any[] }> {
  const response = await fetch(`${ATLANTEAN_API_BASE}/simulation/recall`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: searchQuery, limit }),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to recall simulations: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Create a labeled snapshot for Neural Archives
 */
export async function createSnapshot(
  label?: string
): Promise<{ snapshot: any }> {
  const response = await fetch(`${ATLANTEAN_API_BASE}/snapshot`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ label }),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to create snapshot: ${response.statusText}`);
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
