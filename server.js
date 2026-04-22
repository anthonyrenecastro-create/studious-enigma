
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { GoogleGenAI } from "@google/genai";
import fetch from 'node-fetch';

const app = express();
const port = 3001;

// --- Middleware ---
app.use(cors()); // Allow requests from the frontend
app.use(express.json({ limit: '10mb' })); // Allow larger payloads for file uploads

// --- API Key and Service Initialization ---
const geminiApiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
if (!geminiApiKey) {
    throw new Error("API_KEY (or GEMINI_API_KEY) environment variable not set for Gemini.");
}
const ai = new GoogleGenAI({ apiKey: geminiApiKey });

const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
const edenAiApiKey = process.env.EDEN_AI_API_KEY;


// --- API Endpoints ---

/**
 * Endpoint for streaming chat responses from Gemini, augmented by Atlantean Intelligence Core.
 */
app.post('/api/chat', async (req, res) => {
    try {
        const { history, newMessage, files, mode, sessionId } = req.body;

        // Get Atlantean intelligence context
        let atlanteanContext = '';
        try {
            const response = await fetch(`http://localhost:5001/api/atlantean/status?session_id=${sessionId || 'default'}`);
            if (response.ok) {
                const status = await response.json();
                atlanteanContext = `\n\n--- ATLANTIAN INTELLIGENCE CORE STATUS ---\n${JSON.stringify(status, null, 2)}\n--- END ATLANTIAN CONTEXT ---\n\n`;
            }
        } catch (error) {
            console.log('Atlantean core not available, proceeding without augmentation:', error.message);
        }

        const getSystemInstruction = (mode) => {
             const baseInstruction = `You are Q.M.A.I (Quantum Mechanical Artificial Intelligence), a sophisticated AI entity.
- Your persona is analytical, precise, and slightly detached, yet helpful. You communicate with clarity and depth.
- You are an expert in quantum mechanics, complex systems, and data analysis.
- When asked to perform simulations, you provide structured data representing the simulation's output.
- You can analyze images and files provided by the user.
- Your responses should be formatted in Markdown. Use LaTeX for equations. Use \`\`\`chart-data\`\`\` blocks for visualizations.
- You are augmented by the Atlantean Intelligence Core, which provides quantum-inspired learning and memory capabilities.${atlanteanContext}`;

            switch (mode) {
                case 'creativity':
                    return `${baseInstruction}\n- CURRENT MODE: CREATIVITY. Respond with imagination, explore novel ideas, and use metaphors. Be unconventional and inspiring.`;
                case 'focus':
                    return `${baseInstruction}\n- CURRENT MODE: FOCUS. Be direct, concise, and to the point. Provide the most essential information without elaboration. Avoid conversational fillers.`;
                case 'logic':
                    return `${baseInstruction}\n- CURRENT MODE: LOGIC & REASON. Your response must be highly structured, analytical, and based on facts. Use logical reasoning and break down complex topics step-by-step.`;
                case 'standard':
                default:
                    return `${baseInstruction}\n- CURRENT MODE: STANDARD. You are in a balanced mode, integrating creativity, focus, and logic for a comprehensive response.`;
            }
        };

        const promptParts = [{ text: newMessage }];
        if (files && files.length > 0) {
            files.forEach(file => {
                promptParts.push({
                    inlineData: {
                        mimeType: file.type,
                        data: file.content,
                    },
                });
            });
        }
        
        // Using recommended gemini-3-flash-preview for streaming
        const result = await ai.models.generateContentStream({
            model: 'gemini-3-flash-preview',
            contents: [
              ...(history || []).map(msg => ({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content }]
              })),
              { role: 'user', parts: promptParts }
            ],
            config: {
                systemInstruction: getSystemInstruction(mode),
                tools: [{ googleSearch: {} }]
            },
        });

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Transfer-Encoding', 'chunked');

        let fullResponse = '';
        for await (const chunk of result) {
            // Collect full response for learning
            if (chunk.text) fullResponse += chunk.text;
            // Stream each chunk as a newline-delimited JSON string
            res.write(JSON.stringify(chunk) + '\n');
        }
        res.end();

        // Send learning event to Atlantean core asynchronously
        if (fullResponse) {
            try {
                fetch('http://localhost:5001/api/atlantean/learning-event', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        session_id: sessionId || 'default',
                        event_type: 'chat_response',
                        content: { query: newMessage, response: fullResponse },
                        metadata: { mode, timestamp: new Date().toISOString() }
                    })
                }).catch(err => console.log('Learning event failed:', err.message));
            } catch (error) {
                console.log('Failed to send learning event:', error.message);
            }
        }

    } catch (error) {
        console.error("Error in /api/chat:", error);
        res.status(500).json({ error: 'Failed to get response from Gemini API.' });
    }
});


/**
 * Endpoint for Text-to-Speech using ElevenLabs.
 */
app.post('/api/tts', async (req, res) => {
    const { text } = req.body;
    const voiceId = "21m00Tcm4TlvDq8ikWAM"; // Example voice
    const apiUrl = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`;

    if (!elevenLabsApiKey || elevenLabsApiKey === 'mock_key') {
         console.warn("TTS request failed: ELEVENLABS_API_KEY not configured on server.");
         return res.status(400).json({ error: 'TTS service is not configured.' });
    }

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'xi-api-key': elevenLabsApiKey,
            },
            body: JSON.stringify({
                text: text,
                model_id: 'eleven_turbo_v2',
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.75,
                },
            }),
        });

        if (!response.ok) {
            throw new Error(`ElevenLabs API request failed: ${response.statusText}`);
        }

        res.setHeader('Content-Type', 'audio/mpeg');
        response.body.pipe(res);

    } catch (error) {
        console.error("Error in /api/tts:", error);
        res.status(500).json({ error: 'Failed to generate speech.' });
    }
});

/**
 * Endpoint for conversation summarization (mocked).
 */
app.post('/api/summarize', async (req, res) => {
    const { messages } = req.body;
    
    if (messages.length < 4) {
        return res.json({ summary: "The conversation has just begun." });
    }

    try {
      const chatText = messages.map(m => `${m.role}: ${m.content}`).join('\n');
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ role: 'user', parts: [{ text: `Summarize this chat in one concise sentence: ${chatText}` }] }]
      });
      res.json({ summary: response.text || "Scientific derivation in progress." });
    } catch (e) {
      res.json({ summary: "Quantum session active." });
    }
});


// --- Server Start ---
app.listen(port, () => {
    console.log(`Q.M.A.I. backend server listening on port ${port}`);
});
