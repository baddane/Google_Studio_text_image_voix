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

export interface CapCutTutorialStep {
  title: string;
  instructions: string[];
  tip: string;
}

export interface CapCutTutorial {
  intro: string;
  steps: CapCutTutorialStep[];
  timelineRecap: string[];
}

const getAI = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
  return new GoogleGenAI({ apiKey });
};

// Generate TTS for a single text chunk and return raw PCM bytes
async function generateSpeechChunk(text: string, voiceName: string): Promise<Uint8Array> {
  const ai = getAI();
  const model = "gemini-2.5-flash-preview-tts";

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

  const binaryString = atob(base64Audio);
  const pcm = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    pcm[i] = binaryString.charCodeAt(i);
  }
  return pcm;
}

// Wrap raw PCM data in a WAV header (16-bit, 24kHz, mono)
function pcmToWavDataUrl(pcmData: Uint8Array): string {
  const len = pcmData.length;
  const buffer = new ArrayBuffer(44 + len);
  const view = new DataView(buffer);

  view.setUint32(0, 0x52494646, false);   // RIFF
  view.setUint32(4, 36 + len, true);       // file length
  view.setUint32(8, 0x57415645, false);    // WAVE
  view.setUint32(12, 0x666d7420, false);   // fmt
  view.setUint32(16, 16, true);            // format chunk length
  view.setUint16(20, 1, true);             // PCM
  view.setUint16(22, 1, true);             // mono
  view.setUint32(24, 24000, true);         // sample rate
  view.setUint32(28, 24000 * 2, true);     // byte rate
  view.setUint16(32, 2, true);             // block align
  view.setUint16(34, 16, true);            // bits per sample
  view.setUint32(36, 0x64617461, false);   // data
  view.setUint32(40, len, true);           // data length

  const wavBytes = new Uint8Array(buffer);
  wavBytes.set(pcmData, 44);

  let binary = '';
  for (let i = 0; i < wavBytes.length; i++) {
    binary += String.fromCharCode(wavBytes[i]);
  }
  return `data:audio/wav;base64,${btoa(binary)}`;
}

/**
 * Generate speech for multiple text chunks (one per scene), then concatenate
 * into a single WAV. This avoids the Gemini TTS per-request output limit
 * (~2 min) by generating each scene separately and merging the raw PCM.
 */
export async function generateSpeech(
  sceneTexts: string[],
  voiceName: string,
  onProgress?: (done: number, total: number) => void,
): Promise<string> {
  const pcmChunks: Uint8Array[] = [];
  const total = sceneTexts.length;

  for (let i = 0; i < total; i++) {
    onProgress?.(i, total);
    const pcm = await generateSpeechChunk(sceneTexts[i], voiceName);
    pcmChunks.push(pcm);
  }
  onProgress?.(total, total);

  // Concatenate all PCM chunks
  const totalLen = pcmChunks.reduce((sum, c) => sum + c.length, 0);
  const merged = new Uint8Array(totalLen);
  let offset = 0;
  for (const chunk of pcmChunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  return pcmToWavDataUrl(merged);
}

export async function generateYouTubeScript(blogContent: string, durationMinutes: number = 5): Promise<VideoScript> {
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

            TRANSFORME l'article suivant en un script vidéo YouTube de ${durationMinutes} minute${durationMinutes > 1 ? 's' : ''} EXPLOSIF.

            📏 LONGUEUR DU SCRIPT : Le script TOTAL (toutes scènes combinées) doit contenir environ ${durationMinutes * 150} mots (environ 150 mots par minute de vidéo). C'est CRUCIAL pour que la voix-off dure bien ${durationMinutes} minute${durationMinutes > 1 ? 's' : ''}.

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
            3. Des prompts d'illustration en ANGLAIS — ⚠️ PAS 3 IMAGES PAR DÉFAUT ! Le nombre d'images VARIE selon la scène :

               📐 MÉTHODE OBLIGATOIRE POUR DÉTERMINER LE NOMBRE D'IMAGES :
               - Découpe le script de la scène en PHRASES ou GROUPES DE PHRASES qui abordent chacun UNE idée distincte.
               - Crée EXACTEMENT 1 prompt d'illustration PAR idée/moment identifié.
               - Résultat attendu : entre 2 et 8 images par scène selon la longueur et la richesse du script.

               ❌ INTERDIT : Toujours mettre 3 images. C'est FAUX si le script contient plus ou moins de 3 idées.
               ✅ CORRECT : Compter les idées distinctes dans le script et créer autant de prompts.

               Exemple : Si le script dit "D'abord on parle de X. Ensuite Y arrive. Puis Z se passe. Et enfin W conclut." → 4 images (une par idée).

               Chaque image = un PASSAGE PRÉCIS du script. L'ensemble couvre TOUT le contenu de la scène.
               Toutes les images doivent être VISUELLEMENT DIFFÉRENTES : décor, pose, émotion, éléments différents.

               Pour chaque prompt (2-3 phrases max par prompt) :
               - NE PAS inclure de description du personnage principal (ajouté automatiquement).
               - Décris : l'action PRÉCISE, le décor, la pose/émotion du personnage, les éléments visuels.
               - Inclure UN SEUL MOT EN FRANÇAIS comme texte doodle — le mot le plus pertinent et percutant selon le contexte du script (ex: une émotion, une réaction, un mot-clé du sujet). MAXIMUM 1 mot, jamais plus. Pas de phrase, pas de mot composé.
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
                    description: "VARIABLE number of illustration prompts (2 to 8). One prompt per distinct idea/moment in the scene script. Do NOT default to 3 — count the actual ideas in the script."
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
- Include ONLY 1 French word as doodle text — choose the most relevant and impactful word based on the scene context (e.g. a key emotion, reaction, or subject keyword). MAXIMUM 1 word. Keep it SHORT (3-6 letters max). NEVER write sentences or compound words — AI models make spelling errors on long text.
- Selective color pops: use vibrant accent colors (red, blue, yellow) sparingly to highlight key elements against the mostly black & white sketch.
- The character must look CONSISTENT across all images: same hair, same glasses, same drawing style.
- Clean composition, not cluttered. White space is important in doodle art.
- 4K quality, sharp lines, professional doodle illustration.

CRITICAL — TEXT IN IMAGE:
- MAXIMUM 1 word visible in the entire image. Keep it SHORT (3-6 letters max).
- Choose the single most relevant French word that captures the essence of the scene.
- NEVER write sentences, long words, or compound words — they WILL contain spelling errors.
- Use doodle symbols (!, ?, ★, →, ✓, ✗) instead of extra words.`,
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

export async function generateCapCutTutorial(
  videoScript: VideoScript,
  audioDurationSeconds: number
): Promise<CapCutTutorial> {
  const ai = getAI();
  const model = "gemini-3.1-flash-lite-preview";

  const sceneSummary = videoScript.scenes.map((s, i) =>
    `Scène ${i + 1} — "${s.title}" : ${s.illustrationPrompts.length} images. Script : "${s.script.substring(0, 100)}..."`
  ).join('\n');

  const totalImages = videoScript.scenes.reduce((sum, s) => sum + s.illustrationPrompts.length, 0);
  const nbScenes = videoScript.scenes.length;
  const avgSceneDuration = Math.round(audioDurationSeconds / nbScenes);
  const avgImagesPerScene = totalImages / nbScenes;
  const avgImageDuration = Math.round(avgSceneDuration / avgImagesPerScene);

  const response = await ai.models.generateContent({
    model,
    contents: {
      role: "user",
      parts: [{
        text: `Tu es un EXPERT en montage vidéo CapCut, spécialisé dans la création de vidéos YouTube à partir d'images doodle et de voix-off IA.

Génère un tutoriel CapCut PERSONNALISÉ et DÉTAILLÉ pour monter cette vidéo spécifique.

📊 DONNÉES DE LA VIDÉO :
- Titre : "${videoScript.title}"
- Durée totale estimée : ${videoScript.totalEstimatedDuration}
- Durée audio réelle : ${audioDurationSeconds} secondes
- Nombre de scènes : ${nbScenes}
- Nombre total d'images : ${totalImages}
- Durée moyenne par scène : ~${avgSceneDuration}s
- Durée moyenne par image : ~${avgImageDuration}s

📋 DÉTAIL DES SCÈNES :
${sceneSummary}

🎯 INSTRUCTIONS :
- Le tuto doit être SPÉCIFIQUE à cette vidéo (mentionne les noms des scènes, les durées calculées, le nombre d'images exact).
- Donne des timecodes précis pour le placement des images sur la timeline (ex: "Scène 1 : Image 1 de 0:00 à 0:${avgImageDuration}").
- Recommande des transitions ADAPTÉES au ton de chaque scène (dynamique → Glitch, émotion → Fade, révélation → Flash, etc.).
- Suggère des animations Ken Burns adaptées au contenu de chaque image.
- Recommande un style de musique de fond en rapport avec le sujet "${videoScript.title}".
- Donne des astuces de sous-titrage spécifiques au rythme du script.
- Tout en FRANÇAIS.

Réponds en JSON structuré.`
      }]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          intro: {
            type: Type.STRING,
            description: "Introduction personnalisée du tuto (2-3 phrases contextuelles)"
          },
          steps: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING, description: "Titre de l'étape" },
                instructions: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "Liste d'instructions détaillées et spécifiques"
                },
                tip: { type: Type.STRING, description: "Astuce pro contextuelle" }
              },
              required: ["title", "instructions", "tip"]
            }
          },
          timelineRecap: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Lignes du récap timeline avec timecodes réels"
          }
        },
        required: ["intro", "steps", "timelineRecap"]
      }
    }
  });

  let text = response.text;
  if (!text) throw new Error("Pas de tutoriel généré.");

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) text = jsonMatch[0];

  return JSON.parse(text);
}
