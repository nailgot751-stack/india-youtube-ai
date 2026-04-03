import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const generateVideoRecommendations = async (currentVideoTitle: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Generate 5 related video titles and channel names for a video titled "${currentVideoTitle}". Return as a JSON array of objects with "title" and "channel" properties.`,
      config: {
        responseMimeType: "application/json",
      },
    });
    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Error generating recommendations:", error);
    return [];
  }
};
