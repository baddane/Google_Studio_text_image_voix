import { GoogleGenAI, Type, Modality } from "@google/genai";

export interface Scene {
  title: string;
  script: string;
  illustrationPrompts: string[];
}

export interface VideoScript {
  title: string;
  totalEstimatedDuration: string;
  scenes: Scene[];
}

const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY || "";
  return new GoogleGenAI({ apiKey });
};

export async function generateSpeech(text: string, voiceName: string): Promise<string> {
  const ai = getAI();
  const model = "gemini-2.5-flash-preview-tts";
  
  const response = await ai.models.generateContent({
    model,
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) {
    throw new Error("Échec de la génération de l'audio.");
  }

  // Gemini TTS returns raw PCM 16-bit 24kHz. We need to add a WAV header for browser playback.
  const binaryString = atob(base64Audio);
  const len = binaryString.length;
  const buffer = new ArrayBuffer(44 + len);
  const view = new DataView(buffer);

  // RIFF identifier
  view.setUint32(0, 0x52494646, false);
  // file length
  view.setUint32(4, 36 + len, true);
  // RIFF type
  view.setUint32(8, 0x57415645, false);
  // format chunk identifier
  view.setUint32(12, 0x666d7420, false);
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (1 = PCM)
  view.setUint16(20, 1, true);
  // channel count (1 = Mono)
  view.setUint16(22, 1, true);
  // sample rate (24000 for gemini-2.5-flash-preview-tts)
  view.setUint32(24, 24000, true);
  // byte rate (sample rate * block align)
  view.setUint32(28, 24000 * 2, true);
  // block align (channel count * bytes per sample)
  view.setUint16(32, 2, true);
  // bits per sample
  view.setUint16(34, 16, true);
  // data chunk identifier
  view.setUint32(36, 0x64617461, false);
  // data chunk length
  view.setUint32(40, len, true);

  for (let i = 0; i < len; i++) {
    view.setUint8(44 + i, binaryString.charCodeAt(i));
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64Wav = btoa(binary);

  return `data:audio/wav;base64,${base64Wav}`;
}

export async function generateYouTubeScript(blogContent: string): Promise<VideoScript> {
  const ai = getAI();
  const model = "gemini-3.1-flash-lite-preview";
  
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Clé API Gemini manquante. Veuillez la configurer dans les paramètres.");
  }

  console.log("Starting script generation with model:", model);
  try {
    const response = await ai.models.generateContent({
      model,
      contents: {
        role: "user",
        parts: [
          {
            text: `Transformez l'article de blog suivant en un script vidéo YouTube de 5 minutes. 
            Le script doit être engageant, conversationnel et structuré pour une vidéo de 5 minutes.
            TOUT le contenu généré (titres, scripts, prompts d'illustration) doit être en FRANÇAIS.
            
            Pour chaque scène, fournissez :
            1. Un titre de scène.
            2. Le script parlé (voix-off).
            3. TROIS (3) prompts d'illustration extrêmement détaillés qui ILLUSTRENT PRÉCISÉMENT différents moments ou angles de l'action décrits dans le script voix-off. 
               Chaque image doit être une traduction visuelle directe de ce qui est dit.
               Le style doit être celui d'une bande dessinée moderne et colorée. 
               Le personnage principal est TOUJOURS un "stickman" (bonhomme bâton) avec un corps noir filiforme et une tête blanche très expressive. 
               L'arrière-plan doit être riche en détails, coloré et professionnel.
               IMPORTANT : Si du texte doit apparaître dans les images (bulles, panneaux, écrans), il doit être écrit avec une orthographe PARFAITE et sans aucune faute.
            
            Contenu du Blog :
            ${blogContent}`,
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            totalEstimatedDuration: { type: Type.STRING },
            scenes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  script: { type: Type.STRING },
                  illustrationPrompts: { 
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "Exactly 3 detailed illustration prompts."
                  },
                },
                required: ["title", "script", "illustrationPrompts"],
              },
            },
          },
          required: ["title", "totalEstimatedDuration", "scenes"],
        },
      },
    });

    let text = response.text;
    if (!text) {
      throw new Error("Le modèle n'a pas renvoyé de texte.");
    }

    // Nettoyage du texte pour s'assurer qu'il s'agit d'un JSON valide
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      text = jsonMatch[0];
    }

    console.log("Script generation successful");
    return JSON.parse(text);
  } catch (error) {
    console.error("Script generation error:", error);
    throw error;
  }
}

export async function generateImage(prompt: string, scriptContext?: string): Promise<string> {
  const ai = getAI();
  const model = "gemini-2.5-flash-image";
  
  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        {
          text: `Create a high-quality, vibrant, and detailed comic book illustration.
          CONTEXT (Voice-over script): "${scriptContext || ''}"
          VISUAL DESCRIPTION TO ILLUSTRATE: ${prompt}
          
          REQUIREMENTS:
          - TEXT ACCURACY: If any text is present in the image (speech bubbles, signs, screens), it must be spelled correctly without any typos or orthographic errors.
          - The image MUST perfectly match the action described in the context and visual description.
          - MAIN CHARACTER: A simple black stickman with a white, highly expressive head.
          - STYLE: Modern digital comic illustration, clean lines, vibrant colors, detailed and professional backgrounds.
          - ASPECT RATIO: 16:9 cinematic.`,
        },
      ],
    },
    config: {
      imageConfig: {
        aspectRatio: "16:9",
        imageSize: "1K",
      },
    },
  });

  if (!response.candidates?.[0]?.content?.parts) {
    throw new Error("No image generated");
  }

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }

  throw new Error("No image data found");
}
