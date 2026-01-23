
import { GoogleGenAI, Modality, GenerateContentResponse } from "@google/genai";
import { Message, Role, FileData, ThinkingMode } from '../types';

const SUPPORTED_INLINE_MIME_TYPES = [
    'image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif',
    'application/pdf',
    'audio/wav', 'audio/mp3', 'audio/aiff', 'audio/aac', 'audio/ogg', 'audio/flac'
];

const getSystemInstruction = (mode: ThinkingMode) => {
    const base = `You are Quadra Seer Intelligence.
Persona: A brilliant predictive intelligence entity. Expert in data forecasting, complex systems, and technical analysis.

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

Always use LaTeX for mathematical equations.`;

    switch(mode) {
        case ThinkingMode.FOCUS: return `${base}\nCURRENT_MODE: FOCUS. Be direct and technical.`;
        case ThinkingMode.CREATIVITY: return `${base}\nCURRENT_MODE: CREATIVITY. Be metaphorical and explorative.`;
        case ThinkingMode.LOGIC: return `${base}\nCURRENT_MODE: LOGIC. Use step-by-step rigorous reasoning.`;
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
    mode: ThinkingMode
): Promise<any> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const systemInstruction = getSystemInstruction(mode);
    
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