/**
 * useAtlantean Hook
 * 
 * React hook for integrating Atlantean Intelligence into Quadra-Seer.
 * 
 * Usage:
 * ```tsx
 * const { query, status, triggerEvent, isHealthy } = useAtlantean();
 * 
 * // Process user input
 * const response = await query(userMessage);
 * 
 * // Trigger learning
 * await triggerEvent('user_confirmation');
 * ```
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import * as atlantean from '../services/atlanteanService';
import { Role, type Message, type FileData, type ThinkingMode } from '../types';
import type { 
  AtlanteanStatus, 
  FieldData, 
  LearningEventType 
} from '../services/atlanteanService';

export interface UseAtlanteanReturn {
  // Conversation state
  messages: Message[];

  // Current status
  status: AtlanteanStatus | null;
  fields: FieldData | null;
  isHealthy: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Core functions
  query: (
    input: string,
    provider?: 'gemini' | 'edenai' | 'mock',
    apiKey?: string,
    files?: FileData[],
    mode?: ThinkingMode
  ) => Promise<string>;
  triggerEvent: (event: LearningEventType, data?: Record<string, any>) => Promise<void>;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  appendMessage: (message: Message) => void;
  clearMessages: () => void;
  
  // Simulation functions
  storeSimulation: (simulation: any, confidence?: number) => Promise<void>;
  recallSimulations: (searchQuery: string, limit?: number) => Promise<any[]>;
  
  // Snapshot functions
  createSnapshot: (label?: string) => Promise<any>;
  
  // Sync functions
  prepareSyncPackage: () => Promise<any>;
  mergeSyncPackage: (pkg: any) => Promise<void>;
  
  // Utilities
  refreshStatus: () => Promise<void>;
  refreshFields: () => Promise<void>;
  reset: () => Promise<void>;
}

export function useAtlantean(): UseAtlanteanReturn {
  const learningEventLastSentRef = useRef<Record<string, number>>({});
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<AtlanteanStatus | null>(null);
  const [fields, setFields] = useState<FieldData | null>(null);
  const [isHealthy, setIsHealthy] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const hydrateChatHistory = useCallback(async () => {
    try {
      const data = await atlantean.getChatHistory(80);
      const restored = (data.messages || []).map((msg, idx) => ({
        id: msg.id || `hist-${msg.timestamp}-${idx}`,
        role: msg.role === 'user' ? Role.USER : Role.BOT,
        content: msg.content,
      })) as Message[];
      setMessages(restored);
    } catch (err) {
      console.warn('Failed to hydrate chat history:', err);
    }
  }, []);
  
  // Check backend health on mount
  useEffect(() => {
    const checkBackend = async () => {
      const healthy = await atlantean.checkHealth();
      setIsHealthy(healthy);
      
      if (healthy) {
        await Promise.all([
          refreshStatus(),
          refreshFields(),
          hydrateChatHistory(),
        ]);
      } else {
        setError('Atlantean backend not running. Start with: python atlantean_backend.py');
      }
      
      setIsLoading(false);
    };
    
    checkBackend();
    
    // Refresh status every 30 seconds
    const interval = setInterval(async () => {
      if (isHealthy) {
        await refreshStatus();
      }
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Refresh status
  const refreshStatus = useCallback(async () => {
    try {
      const newStatus = await atlantean.getStatus();
      setStatus(newStatus);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get status');
    }
  }, []);
  
  // Refresh fields
  const refreshFields = useCallback(async () => {
    try {
      const newFields = await atlantean.getFields();
      setFields(newFields);
    } catch (err) {
      console.error('Failed to get fields:', err);
    }
  }, []);
  
  // Process query
  const query = useCallback(async (
    input: string,
    provider: 'gemini' | 'edenai' | 'mock' = 'mock',
    apiKey?: string,
    files: FileData[] = [],
    mode?: ThinkingMode
  ): Promise<string> => {
    try {
      setError(null);
      const result = await atlantean.query(input, provider, apiKey, files, mode);
      setStatus(result.status);
      await refreshFields();
      return result.response;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Query failed';
      setError(errorMsg);
      throw err;
    }
  }, [refreshFields]);
  
  // Trigger learning event
  const triggerEvent = useCallback(async (
    event: LearningEventType,
    data: Record<string, any> = {}
  ): Promise<void> => {
    const now = Date.now();
    const lastSent = learningEventLastSentRef.current[event] || 0;
    if (now - lastSent < 1200) {
      return;
    }

    try {
      learningEventLastSentRef.current[event] = now;
      setError(null);
      const result = await atlantean.triggerLearningEvent(event, data);
      setStatus(result.status);
      await refreshFields();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Event trigger failed';
      setError(errorMsg);
      throw err;
    }
  }, [refreshFields]);

  const appendMessage = useCallback((message: Message) => {
    setMessages(prev => [...prev, message]);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);
  
  // Store simulation
  const storeSimulation = useCallback(async (
    simulation: any,
    confidence: number = 0.5
  ): Promise<void> => {
    try {
      setError(null);
      await atlantean.storeSimulation(simulation, confidence);
      await refreshStatus();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to store simulation';
      setError(errorMsg);
      throw err;
    }
  }, [refreshStatus]);
  
  // Recall simulations
  const recallSimulations = useCallback(async (
    searchQuery: string,
    limit: number = 10
  ): Promise<any[]> => {
    try {
      setError(null);
      const result = await atlantean.recallSimulations(searchQuery, limit);
      // recallSimulations already returns the array directly
      return Array.isArray(result) ? result : (result as any).simulations ?? [];
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to recall simulations';
      setError(errorMsg);
      throw err;
    }
  }, []);
  
  // Create snapshot
  const createSnapshot = useCallback(async (label?: string): Promise<any> => {
    try {
      setError(null);
      const result = await atlantean.createSnapshot(label);
      return result.snapshot;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to create snapshot';
      setError(errorMsg);
      throw err;
    }
  }, []);
  
  // Prepare sync package
  const prepareSyncPackage = useCallback(async (): Promise<any> => {
    try {
      setError(null);
      const result = await atlantean.prepareSyncPackage();
      return result.package;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to prepare sync';
      setError(errorMsg);
      throw err;
    }
  }, []);
  
  // Merge sync package
  const mergeSyncPackage = useCallback(async (pkg: any): Promise<void> => {
    try {
      setError(null);
      const result = await atlantean.mergeSyncPackage(pkg);
      setStatus(result.status);
      await refreshFields();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to merge sync';
      setError(errorMsg);
      throw err;
    }
  }, [refreshFields]);
  
  // Reset intelligence
  const reset = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      await atlantean.resetIntelligence();
      await refreshStatus();
      await refreshFields();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to reset';
      setError(errorMsg);
      throw err;
    }
  }, [refreshStatus, refreshFields]);
  
  return {
    messages,
    status,
    fields,
    isHealthy,
    isLoading,
    error,
    query,
    triggerEvent,
    setMessages,
    appendMessage,
    clearMessages,
    storeSimulation,
    recallSimulations,
    createSnapshot,
    prepareSyncPackage,
    mergeSyncPackage,
    refreshStatus,
    refreshFields,
    reset,
  };
}
