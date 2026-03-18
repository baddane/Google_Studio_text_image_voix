import { useState, useEffect } from 'react';
import { generateYouTubeScript, generateImage, generateSpeech, VideoScript } from './services/geminiService';
import { 
  FileText, 
  Youtube, 
  Image as ImageIcon, 
  Loader2, 
  Check, 
  Copy,
  Sparkles,
  RefreshCw,
  Wand2,
  ArrowRight,
  Terminal,
  ExternalLink,
  Zap,
  Sun,
  Moon,
  Download,
  Mic,
  Play,
  Pause,
  Volume2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [blogContent, setBlogContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [videoScript, setVideoScript] = useState<VideoScript | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [generatedImages, setGeneratedImages] = useState<Record<number, string[]>>({});
  const [imageLoading, setImageLoading] = useState<Record<number, boolean[]>>({});
  const [imageError, setImageError] = useState<Record<number, (string | null)[]>>({});
  const [selectedVoice, setSelectedVoice] = useState('Zephyr');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioLoading, setAudioLoading] = useState(false);

  const voices = [
    { name: 'Zephyr', desc: 'Calme & Professionnel' },
    { name: 'Puck', desc: 'Énergique & Jeune' },
    { name: 'Charon', desc: 'Profond & Narratif' },
    { name: 'Kore', desc: 'Doux & Informatif' },
    { name: 'Fenrir', desc: 'Autoritaire & Clair' }
  ];

  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      return saved ? saved === 'dark' : true;
    }
    return true;
  });

  useEffect(() => {
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const handleGenerate = async () => {
    if (!blogContent.trim()) return;
    
    if (!import.meta.env.VITE_GEMINI_API_KEY) {
      setError("Clé API Gemini manquante. Veuillez configurer GEMINI_API_KEY dans les paramètres.");
      return;
    }

    setLoading(true);
    setError(null);
    setAudioUrl(null);
    setGeneratedImages({});
    setImageLoading({});
    setImageError({});
    try {
      const result = await generateYouTubeScript(blogContent);
      setVideoScript(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue lors de la génération.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateImages = async (prompts: string[], script: string, sceneIndex: number) => {
    setImageLoading(prev => ({ ...prev, [sceneIndex]: [true, true, true] }));
    setImageError(prev => ({ ...prev, [sceneIndex]: [null, null, null] }));
    
    const generationPromises = prompts.map(async (prompt, imgIndex) => {
      try {
        const imageUrl = await generateImage(prompt, script);
        setGeneratedImages(prev => {
          const current = prev[sceneIndex] || [];
          const updated = [...current];
          updated[imgIndex] = imageUrl;
          return { ...prev, [sceneIndex]: updated };
        });
      } catch (err) {
        console.error(`Image ${imgIndex} generation error:`, err);
        setImageError(prev => {
          const current = prev[sceneIndex] || [null, null, null];
          const updated = [...current];
          updated[imgIndex] = err instanceof Error ? err.message : 'Erreur';
          return { ...prev, [sceneIndex]: updated };
        });
      } finally {
        setImageLoading(prev => {
          const current = prev[sceneIndex] || [true, true, true];
          const updated = [...current];
          updated[imgIndex] = false;
          return { ...prev, [sceneIndex]: updated };
        });
      }
    });

    await Promise.all(generationPromises);
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const downloadImage = (base64Data: string, sceneTitle: string, index: number) => {
    const link = document.createElement('a');
    link.href = base64Data;
    link.download = `${sceneTitle.replace(/\s+/g, '-').toLowerCase()}-img-${index + 1}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadAllImages = (images: string[], sceneTitle: string) => {
    images.forEach((img, i) => {
      if (img) {
        // Use a small timeout to avoid browser blocking multiple downloads
        setTimeout(() => {
          downloadImage(img, sceneTitle, i);
        }, i * 200);
      }
    });
  };

  const handleGenerateAudio = async () => {
    if (!videoScript) return;
    setAudioLoading(true);
    try {
      const fullText = videoScript.scenes.map(s => s.script).join('\n\n');
      const url = await generateSpeech(fullText, selectedVoice);
      setAudioUrl(url);
    } catch (err) {
      console.error("Audio generation error:", err);
      setError("Erreur lors de la génération de l'audio.");
    } finally {
      setAudioLoading(false);
    }
  };

  return (
    <div className={`min-h-screen ${isDark ? 'dark bg-[#0a0a0a] text-white' : 'bg-slate-50 text-slate-900'} font-sans selection:bg-indigo-500/30 transition-colors duration-300`}>
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 glass border-b border-slate-200 dark:border-white/5 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-500 p-2 rounded-xl neon-glow">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="font-display font-bold text-xl tracking-tight">Gemini Nano Studio</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsDark(!isDark)}
              className="p-2 rounded-xl glass glass-hover text-slate-500 dark:text-white/60 hover:text-indigo-500 dark:hover:text-indigo-400 transition-all"
              title={isDark ? "Passer en mode jour" : "Passer en mode nuit"}
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <div className="h-4 w-px bg-slate-200 dark:bg-white/10" />
            <a 
              href="https://vercel.com" 
              target="_blank" 
              className="hidden sm:flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-white/40 hover:text-indigo-500 dark:hover:text-white transition-colors"
            >
              Vercel Ready <ExternalLink className="w-3 h-3" />
            </a>
            <div className="h-4 w-px bg-slate-200 dark:bg-white/10 hidden sm:block" />
            <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded border border-indigo-500/20">
              v2.5 Nano Banana
            </span>
          </div>
        </div>
      </nav>

      <main className="pt-24 min-h-screen flex flex-col lg:flex-row">
        {/* Left Pane: Input */}
        <div className="lg:w-1/2 p-8 lg:p-12 border-r border-slate-200 dark:border-white/5 bg-white dark:bg-[#0d0d0d]">
          <div className="max-w-xl ml-auto space-y-12">
            <div className="space-y-4">
              <h2 className="text-4xl lg:text-5xl font-display font-bold leading-tight text-slate-900 dark:text-white">
                Transformez vos <span className="text-gradient">articles</span> en scripts YouTube.
              </h2>
              <p className="text-slate-500 dark:text-white/40 text-lg leading-relaxed">
                Collez votre article de blog et laissez Gemini Nano Banana générer un script de 5 minutes avec des illustrations Stickman professionnelles.
              </p>
            </div>

            <div className="space-y-6">
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-2xl blur opacity-10 dark:opacity-20 group-hover:opacity-30 dark:group-hover:opacity-40 transition duration-1000"></div>
                <textarea
                  value={blogContent}
                  onChange={(e) => setBlogContent(e.target.value)}
                  placeholder="Collez votre article ici..."
                  className="relative w-full h-[400px] p-6 bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-2xl focus:border-indigo-500 outline-none transition-all resize-none text-slate-700 dark:text-white/80 leading-relaxed font-mono text-sm"
                />
              </div>

              <button
                onClick={handleGenerate}
                disabled={loading || !blogContent.trim()}
                className="w-full bg-slate-900 dark:bg-white hover:bg-indigo-500 dark:hover:bg-indigo-500 text-white dark:text-black hover:text-white font-bold py-5 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed group shadow-xl shadow-indigo-500/10"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Génération en cours...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 group-hover:animate-pulse" />
                    Générer le Studio
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>

              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs font-mono flex items-center gap-3">
                  <Terminal className="w-4 h-4" />
                  {error}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Pane: Output */}
        <div className="lg:w-1/2 p-8 lg:p-12 bg-white dark:bg-[#0a0a0a] overflow-y-auto">
          <div className="max-w-xl mr-auto">
            <AnimatePresence mode="wait">
              {!videoScript && !loading ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="h-full min-h-[500px] flex flex-col items-center justify-center text-center space-y-6"
                >
                  <div className="w-20 h-20 rounded-3xl glass flex items-center justify-center text-slate-200 dark:text-white/10">
                    <Youtube className="w-10 h-10" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-display font-bold text-slate-900 dark:text-white">En attente de contenu</h3>
                    <p className="text-slate-400 dark:text-white/30 text-sm max-w-xs">
                      Le studio de création s'activera dès que vous aurez soumis votre article.
                    </p>
                  </div>
                </motion.div>
              ) : loading ? (
                <div className="space-y-8">
                  <div className="h-12 bg-slate-100 dark:bg-white/5 rounded-xl animate-pulse w-3/4" />
                  {[1, 2].map((i) => (
                    <div key={i} className="space-y-4 p-8 glass rounded-3xl animate-pulse">
                      <div className="h-6 bg-slate-100 dark:bg-white/5 rounded w-1/4" />
                      <div className="h-20 bg-slate-100 dark:bg-white/5 rounded w-full" />
                      <div className="h-40 bg-slate-100 dark:bg-white/5 rounded w-full" />
                    </div>
                  ))}
                </div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-12"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-indigo-600 dark:text-indigo-400">Production Finalisée</span>
                      <span className="text-[10px] font-mono text-slate-500 dark:text-white/40 bg-slate-100 dark:bg-white/5 px-2 py-1 rounded border border-slate-200 dark:border-white/10">
                        {videoScript?.totalEstimatedDuration}
                      </span>
                    </div>
                    <h2 className="text-4xl font-display font-bold tracking-tight text-slate-900 dark:text-white">{videoScript?.title}</h2>
                  </div>

                  {/* Script Complet */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass rounded-3xl p-8 space-y-6 border-indigo-500/20"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                        <FileText className="w-4 h-4" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Script Complet (Voix-Off)</span>
                      </div>
                      <button 
                        onClick={() => copyToClipboard(videoScript?.scenes.map(s => s.script).join('\n\n') || '', -1)}
                        className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-all text-slate-400 hover:text-indigo-500 border border-transparent hover:border-indigo-500/20"
                        title="Copier le script complet"
                      >
                        {copiedIndex === -1 ? (
                          <>
                            <Check className="w-3 h-3" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Copié</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Copier Tout</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="relative">
                      <div className="absolute -left-4 top-0 bottom-0 w-1 bg-indigo-500/30 rounded-full" />
                      <p className="text-slate-600 dark:text-white/70 leading-relaxed text-lg font-serif italic whitespace-pre-wrap pl-4">
                        {videoScript?.scenes.map(s => s.script).join('\n\n')}
                      </p>
                    </div>
                  </motion.div>

                  {/* Text to Speech Section */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass rounded-3xl p-8 space-y-8 border-indigo-500/20"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                        <Mic className="w-4 h-4" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Studio Voix (TTS)</span>
                      </div>
                      {audioUrl && (
                        <a 
                          href={audioUrl} 
                          download={`${videoScript?.title.replace(/\s+/g, '-').toLowerCase()}-voix.mp3`}
                          className="flex items-center gap-2 text-indigo-500 hover:text-indigo-600 text-[10px] font-bold uppercase tracking-widest"
                        >
                          <Download className="w-3 h-3" />
                          Télécharger MP3
                        </a>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30">
                          Choisir une Voix
                        </label>
                        <div className="grid grid-cols-1 gap-2">
                          {voices.map((voice) => (
                            <button
                              key={voice.name}
                              onClick={() => setSelectedVoice(voice.name)}
                              className={`flex items-center justify-between p-3 rounded-xl border transition-all text-left ${
                                selectedVoice === voice.name 
                                  ? 'bg-indigo-500/10 border-indigo-500 text-indigo-600 dark:text-indigo-400' 
                                  : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/60 hover:border-indigo-500/30'
                              }`}
                            >
                              <div>
                                <div className="text-sm font-bold">{voice.name}</div>
                                <div className="text-[10px] opacity-60">{voice.desc}</div>
                              </div>
                              {selectedVoice === voice.name && <Check className="w-4 h-4" />}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-col justify-center space-y-6 bg-slate-50 dark:bg-white/5 rounded-2xl p-6 border border-slate-200 dark:border-white/10">
                        {!audioUrl ? (
                          <div className="text-center space-y-4">
                            <div className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center mx-auto text-indigo-500">
                              <Volume2 className="w-8 h-8" />
                            </div>
                            <p className="text-xs text-slate-500 dark:text-white/40">
                              Générez la voix-off complète de votre script avec l'IA.
                            </p>
                            <button
                              onClick={handleGenerateAudio}
                              disabled={audioLoading}
                              className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                              {audioLoading ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Génération...
                                </>
                              ) : (
                                <>
                                  <Zap className="w-4 h-4" />
                                  Générer l'Audio
                                </>
                              )}
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-500">Audio Prêt</span>
                              <button 
                                onClick={() => setAudioUrl(null)}
                                className="text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-red-500"
                              >
                                Réinitialiser
                              </button>
                            </div>
                            <audio controls className="w-full h-10 custom-audio">
                              <source src={audioUrl} type="audio/wav" />
                              Votre navigateur ne supporte pas l'élément audio.
                            </audio>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>

                  <div className="space-y-8">
                    {videoScript?.scenes.map((scene, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="glass rounded-3xl overflow-hidden group hover:border-indigo-500/30 transition-all duration-500"
                      >
                        <div className="p-8 space-y-8">
                          {/* Scene Header */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-black flex items-center justify-center font-display font-bold text-lg">
                                {String(idx + 1).padStart(2, '0')}
                              </div>
                              <h4 className="font-display font-bold text-xl tracking-tight text-slate-900 dark:text-white">{scene.title}</h4>
                            </div>
                          </div>

                          {/* Script */}
                          <div className="space-y-4">
                            <div className="flex items-center gap-2 text-slate-300 dark:text-white/20">
                              <Terminal className="w-4 h-4" />
                              <span className="text-[10px] font-bold uppercase tracking-widest">Voix-Off</span>
                            </div>
                            <p className="text-slate-600 dark:text-white/70 leading-relaxed text-lg font-serif italic border-l-2 border-indigo-500/30 pl-6">
                              "{scene.script}"
                            </p>
                          </div>

                          {/* Illustrations */}
                          <div className="space-y-6">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                                <ImageIcon className="w-4 h-4" />
                                <span className="text-[10px] font-bold uppercase tracking-widest">Nano Banana Assets</span>
                              </div>
                              <div className="flex items-center gap-3">
                                {generatedImages[idx] && generatedImages[idx].filter(Boolean).length === 3 && (
                                  <button 
                                    onClick={() => downloadAllImages(generatedImages[idx], scene.title)}
                                    className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500 text-indigo-600 dark:text-indigo-400 hover:text-white rounded-xl transition-all text-xs font-bold uppercase tracking-wider border border-indigo-500/20"
                                    title="Tout télécharger"
                                  >
                                    <Download className="w-3 h-3" />
                                    Tout
                                  </button>
                                )}
                                <button 
                                  onClick={() => handleGenerateImages(scene.illustrationPrompts, scene.script, idx)}
                                  disabled={imageLoading[idx]?.some(l => l)}
                                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-white/5 hover:bg-slate-900 dark:hover:bg-white text-slate-600 dark:text-white/60 hover:text-white dark:hover:text-black disabled:opacity-50 rounded-xl transition-all text-xs font-bold uppercase tracking-wider border border-slate-200 dark:border-white/10"
                                >
                                  {imageLoading[idx]?.some(l => l) ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Wand2 className="w-3 h-3" />
                                  )}
                                  {generatedImages[idx] ? 'Régénérer' : 'Générer'}
                                </button>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-1 gap-8">
                              {scene.illustrationPrompts.map((prompt, imgIdx) => (
                                <div key={imgIdx} className="space-y-4">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-bold text-slate-300 dark:text-white/20 uppercase tracking-[0.2em]">Séquence {imgIdx + 1}</span>
                                    <button 
                                      onClick={() => copyToClipboard(prompt, idx * 10 + imgIdx)}
                                      className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-all text-slate-300 dark:text-white/20 hover:text-slate-900 dark:hover:text-white"
                                    >
                                      {copiedIndex === idx * 10 + imgIdx ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                    </button>
                                  </div>
                                  
                                  <p className="text-slate-500 dark:text-white/40 text-xs leading-relaxed italic">
                                    "{prompt}"
                                  </p>

                                  {imageError[idx]?.[imgIdx] && (
                                    <div className="text-[10px] text-red-500 bg-red-500/5 p-3 rounded-xl border border-red-500/10 font-mono">
                                      {imageError[idx][imgIdx]}
                                    </div>
                                  )}

                                  <AnimatePresence>
                                    {(generatedImages[idx]?.[imgIdx] || imageLoading[idx]?.[imgIdx]) && (
                                      <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="relative aspect-video w-full overflow-hidden rounded-2xl border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/5 flex items-center justify-center group"
                                      >
                                        {imageLoading[idx]?.[imgIdx] ? (
                                          <div className="flex flex-col items-center gap-3">
                                            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                                            <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-[0.3em]">Rendu Nano Banana...</span>
                                          </div>
                                        ) : (
                                          <>
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 z-10">
                                              <button 
                                                onClick={() => downloadImage(generatedImages[idx][imgIdx], scene.title, imgIdx)}
                                                className="p-3 bg-white text-black rounded-xl hover:scale-110 transition-transform shadow-xl"
                                                title="Télécharger l'image"
                                              >
                                                <Download className="w-5 h-5" />
                                              </button>
                                            </div>
                                            <img 
                                              src={generatedImages[idx][imgIdx]} 
                                              alt={`Illustration ${imgIdx + 1}`}
                                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                                              referrerPolicy="no-referrer"
                                            />
                                          </>
                                        )}
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  <div className="flex justify-center pt-12 pb-24">
                    <button 
                      onClick={() => {
                        setVideoScript(null);
                        setBlogContent('');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="flex items-center gap-2 text-slate-300 dark:text-white/20 hover:text-indigo-500 dark:hover:text-indigo-400 transition-all text-[10px] font-bold uppercase tracking-[0.4em]"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Réinitialiser le Studio
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* Background Decor */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 dark:bg-indigo-500/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/5 dark:bg-emerald-500/5 blur-[120px] rounded-full" />
      </div>
    </div>
  );
}
