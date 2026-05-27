import { Message, Role, FileData, ThinkingMode } from '../types';

/**
 * Stream chat response through backend to keep API key secure.
 * 
 * SECURITY ARCHITECTURE:
 * ========================
 * 
 * ❌ NEVER call Gemini API directly from the browser
 * ✅ ALWAYS route through /api/atlantean/query backend endpoint
 * 
 * Why:
 * - API keys injected into frontend builds are visible in browser memory
 * - Any user can extract the key and abuse it
 * - Backend keeps keys completely hidden from clients
 * 
 * Flow:
 * Browser → Backend Endpoint → Gemini API (with server-side API key)
 * 
 * The backend at atlantean_backend.py:641 handles:
 * - Receiving user messages and file data
 * - Managing Gemini API key securely
 * - Streaming responses back to frontend
 */
export const streamChatResponse = async (
    history: Message[],
    newMessage: string,
    files: FileData[],
    mode: ThinkingMode
): Promise<any> => {
    const backendUrl = import.meta.env.VITE_API_BASE || '/api';
    
    // Prepare file data for backend
    const fileData = files.map(f => ({
        name: f.name,
        type: f.type,
        content: f.content,
        extractedText: f.extractedText
    }));

    try {
        // Call secure backend endpoint
        // Backend handles Gemini API interaction with server-side API key
        const response = await fetch(`${backendUrl}/atlantean/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                input: newMessage,
                history: history.map(m => ({ 
                    role: m.role === Role.USER ? 'user' : 'assistant', 
                    content: m.content 
                })),
                files: fileData,
                mode: mode,
                llm_provider: 'gemini'
            })
        });

        if (!response.ok) {
            throw new Error(`Backend query failed: ${response.status} ${response.statusText}`);
        }

        // Return response for streaming consumption by chat interface
        return response;
    } catch (error) {
        // Re-throw with context
        throw new Error(`Failed to query backend: ${error instanceof Error ? error.message : String(error)}`);
    }
};
