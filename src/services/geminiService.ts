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
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
  return new GoogleGenAI({ apiKey });
};

export async function generateSpeech(text: string, voiceName: string): Promise<string> {
  const ai = getAI();
  const model = "gemini-2.5-flash-preview-tts";

  // Add expressive speech directives for a more natural, captivating delivery
  const expressiveText = `Say the following script in a very natural, captivating and dynamic way.
Speak like a passionate YouTuber who loves their topic.
Use varied intonation: excited for key points, slightly slower for important revelations, and conversational pauses between ideas.
Add subtle emphasis on important words. Sound warm, energetic, and genuine — not robotic or monotone.
The language is French. Speak with a natural French rhythm and flow.

Here is the script to read:

${text}`;

  const response = await ai.models.generateContent({
    model,
    contents: [{ parts: [{ text: expressiveText }] }],
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
  
  if (!import.meta.env.VITE_GEMINI_API_KEY) {
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
            text: `Tu es un SCÉNARISTE YOUTUBE de génie, spécialiste des vidéos virales francophones.
            Ton style : MrBeast meets Squeezie — ultra-dynamique, captivant dès la première seconde, impossible à quitter.

            TRANSFORME l'article suivant en un script vidéo YouTube de 5 minutes EXPLOSIF.

            🎬 RÈGLES D'OR DU SCRIPT :
            - ACCROCHE DE FOU : La première phrase doit être un HOOK irrésistible (question choc, stat incroyable, provocation, cliffhanger). Le spectateur doit se dire "QUOI ?! Je DOIS voir la suite".
            - RYTHME DYNAMIQUE : Alterne entre moments d'énergie pure, révélations surprenantes, pauses dramatiques et touches d'humour. Jamais monotone.
            - TUTOIEMENT : Parle directement au spectateur comme à un pote. "Tu savais que...?", "Attends, ça va te surprendre...", "Et là... plot twist."
            - TRANSITIONS PUNCHY : Entre chaque scène, une transition qui relance l'attention ("Mais attends, le meilleur arrive...", "Et c'est là que ça devient dingue...").
            - STORYTELLING : Raconte une HISTOIRE, pas un cours. Utilise des anecdotes, des exemples concrets, des comparaisons surprenantes.
            - CLIFFHANGERS MINI : Chaque scène doit donner envie de voir la suivante.
            - CONCLUSION MÉMORABLE : Termine avec un appel à l'action naturel et une phrase qui reste en tête.
            - ÉMOTION : Fais ressentir quelque chose — surprise, curiosité, amusement, émerveillement.

            🗣️ STYLE DE VOIX-OFF :
            - Conversationnel, naturel, comme si tu parlais à quelqu'un en face.
            - Phrases courtes et percutantes mélangées avec des explications fluides.
            - Utilise des onomatopées ("Boom!", "Et bam!"), des interjections ("Franchement...", "Genre...").
            - Varie le rythme : phrases rapides pour l'excitation, phrases lentes pour les révélations.

            TOUT le contenu (titres, scripts, prompts) DOIT être en FRANÇAIS.

            🎨 Pour chaque scène, fournis :
            1. Un titre de scène ACCROCHEUR (style titre YouTube).
            2. Le script parlé (voix-off) — dynamique et captivant.
            3. TROIS (3) prompts d'illustration en ANGLAIS qui forment un MINI-SCÉNARIO SÉQUENTIEL :
               ⚠️ RÈGLE CRITIQUE : Les 3 images racontent une PROGRESSION NARRATIVE du script.
               - Image 1 = le DÉBUT du discours (situation initiale, question, accroche).
               - Image 2 = le MILIEU (le problème, la tension, le twist, la révélation).
               - Image 3 = la FIN (la solution, la réaction, la conclusion).
               Les 3 images doivent être VISUELLEMENT DIFFÉRENTES : décor différent, pose différente, émotion différente, éléments différents. JAMAIS 3 images similaires.

               Pour chaque prompt (max 3 phrases) :
               - NE PAS inclure de description du personnage principal (ajouté automatiquement).
               - Décris : l'action PRÉCISE, le décor, la pose/émotion du personnage, les éléments visuels.
               - Inclure UN MOT-CLÉ ou COURTE PHRASE EN FRANÇAIS sans faute d'orthographe comme texte doodle (ex: "INCROYABLE !", "Quoi ?!", "Astuce !", "Le saviez-vous ?").
               - Style : doodle art, croquis dessiné à la main, traits noirs sur fond blanc/coloré.

            📝 Contenu du Blog à transformer :
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
          text: `Create a hand-drawn doodle-style illustration in 16:9 format.

SCENE TO ILLUSTRATE: ${prompt}

MAIN CHARACTER (MUST appear in every image with IDENTICAL appearance):
A confident female content creator with long dark hair and black-framed glasses. Drawn in clean doodle/sketch style with bold black ink outlines. Expressive face, dynamic pose matching the scene. She has a warm, engaging personality visible through her expressions.

DOODLE ART STYLE RULES:
- Hand-drawn sketch aesthetic with bold black ink outlines on a clean white or lightly colored background.
- Playful hand-drawn elements around the character: arrows, stars, exclamation marks, underlines, small icons, squiggles.
- Whimsical, fun, energetic feel — like a YouTuber's whiteboard or notebook doodles.
- Include small doodle text annotations IN FRENCH with perfect spelling, related to the scene (keywords, reactions, fun labels) written in a handwritten font style. All text MUST be in French without any spelling mistakes.
- Selective color pops: use vibrant accent colors (red, blue, yellow) sparingly to highlight key elements against the mostly black & white sketch.
- The character must look CONSISTENT across all images: same hair, same glasses, same drawing style.
- Clean composition, not cluttered. White space is important in doodle art.
- 4K quality, sharp lines, professional doodle illustration.`,
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
