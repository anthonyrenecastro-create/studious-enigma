import { GoogleGenAI, Modality } from "@google/genai";

/**
 * Fetches audio data for the given text using Gemini native TTS.
 * @param text The text to convert to speech.
 * @returns Base64 string of PCM audio data.
 */
export const textToSpeechStream = async (text: string): Promise<string | null> => {
    try {
        const apiKey = process.env.API_KEY;
        if (!apiKey) throw new Error("API_KEY is not defined");
        
        const ai = new GoogleGenAI({ apiKey });
        
        const prompt = `Read this with a professional, scientific, and calm tone: "${text}"`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: prompt }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: 'Zephyr' },
                    },
                },
            },
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        return base64Audio || null;

    } catch (error) {
        console.error("[TTS Service] Error:", error);
        return null; 
    }
};