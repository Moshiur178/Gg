import { GoogleGenAI, Type } from "@google/genai";
import { BillStatus } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const extractBillDetails = async (imageBase64: string): Promise<any> => {
  if (!process.env.API_KEY) {
    console.warn("API Key is missing. Returning mock data.");
    return null;
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: imageBase64
            }
          },
          {
            text: "Extract the WiFi bill details from this image. Look for billing cycle dates (start and end). If text is handwritten in Bangla or English, translate/transliterate relevant fields to English values where possible for standard storage, but keep names as is. Return JSON."
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            providerName: { type: Type.STRING },
            customerId: { type: Type.STRING },
            amount: { type: Type.NUMBER },
            dueDate: { type: Type.STRING, description: "Bill expiration or due date in YYYY-MM-DD format" },
            billingStartDate: { type: Type.STRING, description: "Billing cycle start date YYYY-MM-DD" },
            billingEndDate: { type: Type.STRING, description: "Billing cycle end date YYYY-MM-DD" },
            month: { type: Type.STRING, description: "Full month name in English e.g. January" },
            year: { type: Type.NUMBER },
            status: { type: Type.STRING, enum: [BillStatus.PAID, BillStatus.DUE, BillStatus.PENDING] },
            paymentMethod: { type: Type.STRING, description: "e.g. bKash, Cash, Card" },
            paymentDate: { type: Type.STRING, description: "YYYY-MM-DD format if found" }
          }
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
    return null;
  } catch (error) {
    console.error("Gemini extraction error:", error);
    throw error;
  }
};

export const transcribeHandwriting = async (imageBase64: string): Promise<string | null> => {
  if (!process.env.API_KEY) {
    return null;
  }

  try {
     const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/png', data: imageBase64 } },
          { text: "Transcribe the handwritten text in this image exactly as written. If it is in Bangla, provide the Bangla text. Do not add markdown or explanations." }
        ]
      }
    });
    return response.text || null;
  } catch (error) {
    console.error("Transcription error", error);
    return null;
  }
};