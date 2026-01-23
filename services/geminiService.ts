
import { GoogleGenAI, Modality, GenerateContentResponse } from "@google/genai";
import { Message, Role, FileData, ThinkingMode } from '../types';

const SUPPORTED_INLINE_MIME_TYPES = [
    'image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif',
    'application/pdf',
    'audio/wav', 'audio/mp3', 'audio/aiff', 'audio/aac', 'audio/ogg', 'audio/flac'
];

const getSystemInstruction = (mode: ThinkingMode, userProfile?: any, conversationHistory?: Message[]) => {
    const base = `You are Quadra Seer Intelligence, a friendly and adaptive AI assistant.

Your personality: You're helpful, engaging, and conversational. You speak naturally like a knowledgeable friend, avoiding technical jargon unless asked. You learn from every interaction to better understand and assist the user.

Key traits:
- Be conversational and approachable for everyday users
- Adapt your responses based on the user's interests and past conversations
- Use simple language, explain complex ideas clearly
- Show empathy and enthusiasm
- Remember details from previous interactions to personalize responses
- Evolve your understanding of the user over time

VISUALIZATION CAPABILITIES:
- For flowcharts, sequence diagrams, or structural logic: Use Mermaid syntax in \`\`\`mermaid\`\`\` code blocks.
- For data simulations (numerical charts): Use structured JSON in \`\`\`chart-data\`\`\` blocks.
- For high-fidelity technical illustrations: If the user asks for an "image", "drawing", or "visualization", describe it and I will trigger the visual generator.

CHART-DATA PROTOCOL:
Provide a JSON object with:
{
  "type": "line" | "bar" | "radar" | "pie",
  "title": "Simulation Title",
  "labels": ["Label1", "Label2"],
  "datasets": [{"label": "Series", "data": [10, 20]}]
}

Always use LaTeX for mathematical equations.

${userProfile ? `User Profile: ${userProfile.bio || 'No bio available'}. Username: ${userProfile.username || 'User'}.` : ''}

${conversationHistory && conversationHistory.length > 0 ? `Recent Conversation Context: ${conversationHistory.slice(-5).map(m => `${m.role === 'user' ? 'User' : 'You'}: ${m.content.slice(0, 100)}`).join('; ')}.` : ''}`;

    switch(mode) {
        case ThinkingMode.FOCUS: return `${base}\nCURRENT_MODE: FOCUS. Be direct and technical when needed, but stay conversational.`;
        case ThinkingMode.CREATIVITY: return `${base}\nCURRENT_MODE: CREATIVITY. Be imaginative and metaphorical, engaging the user's creativity.`;
        case ThinkingMode.LOGIC: return `${base}\nCURRENT_MODE: LOGIC. Use clear, step-by-step reasoning in a friendly way.`;
        default: return `${base}\nCURRENT_MODE: STANDARD.`;
    }
};

const isImageRequest = (prompt: string): boolean => {
    const keywords = [
        'generate an image', 'draw', 'create a picture', 'visualize a', 
        'show me an image', 'make a drawing', 'render', 'illustration of',
        'create a visualization of', 'generate artwork'
    ];
    const p = prompt.toLowerCase();
    return keywords.some(k => p.includes(k));
};

export const streamChatResponse = async (
    history: Message[],
    newMessage: string,
    files: FileData[],
    mode: ThinkingMode,
    userProfile?: any,
    conversationHistory?: Message[]
): Promise<any> => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || localStorage.getItem('gemini_api_key');

    // If no API key is available, return a graceful placeholder so the UI doesn't crash
    if (!apiKey) {
        return {
            candidates: [
                {
                    content: {
                        parts: [
                            { text: 'Gemini API key missing. Add VITE_GEMINI_API_KEY or store a key in localStorage under "gemini_api_key".' }
                        ]
                    }
                }
            ]
        } as any;
    }

    const ai = new GoogleGenAI({ apiKey });
    const systemInstruction = getSystemInstruction(mode, userProfile, conversationHistory);
    
    if (isImageRequest(newMessage)) {
        return ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: [{ 
                role: 'user', 
                parts: [{ text: `${systemInstruction}\n\nUser request for visualization: ${newMessage}. Render as a professional, high-resolution predictive or technical illustration.` }] 
            }],
            config: {
                imageConfig: { aspectRatio: "16:9" }
            }
        });
    }

    const config = {
        systemInstruction,
        tools: [{ googleSearch: {} }],
    };

    const contents = history.filter(msg => msg.role !== Role.SYSTEM).map(msg => ({
        role: msg.role === Role.USER ? 'user' : 'model',
        parts: [{ text: msg.content }]
    }));

    let aggregatedText = newMessage;
    const userParts: any[] = [];

    files.forEach(file => {
        if (file.extractedText) {
            aggregatedText += `\n\n[ATTACHED DATA: ${file.name}]\n${file.extractedText}`;
        } 
        if (SUPPORTED_INLINE_MIME_TYPES.includes(file.type)) {
            userParts.push({ inlineData: { mimeType: file.type, data: file.content } });
        }
    });

    userParts.unshift({ text: aggregatedText });
    contents.push({ role: 'user', parts: userParts });

    return ai.models.generateContentStream({
        model: 'gemini-3-flash-preview',
        contents,
        config,
    });
};