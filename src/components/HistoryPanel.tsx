import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Trash2,
  FileText,
  Image as ImageIcon,
  Mic,
  Scissors,
  Clock,
  FolderOpen,
  HardDrive,
  AlertTriangle,
} from 'lucide-react';
import type { HistoryEntry } from '../services/storageService';
import { getStorageUsageMB, getStorageQuotaMB } from '../services/storageService';

interface HistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  entries: HistoryEntry[];
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function HistoryPanel({ isOpen, onClose, entries, onLoad, onDelete }: HistoryPanelProps) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [storageMB, setStorageMB] = useState(0);
  const [quotaMB, setQuotaMB] = useState(0);

  useEffect(() => {
    if (isOpen) {
      getStorageUsageMB().then(setStorageMB);
      getStorageQuotaMB().then(setQuotaMB);
    }
  }, [isOpen, entries.length]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const displayQuota = quotaMB > 0 ? `${Math.round(quotaMB)} MB` : '∞';
  const pct = quotaMB > 0 ? Math.min(100, (storageMB / quotaMB) * 100) : 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 left-0 h-full w-full max-w-md bg-white dark:bg-[#0d0d0d] border-r border-slate-200 dark:border-white/10 z-[70] flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-bold text-lg">Historique</h2>
                  <p className="text-[10px] text-slate-400 dark:text-white/30 uppercase tracking-widest">
                    {entries.length} projet{entries.length !== 1 ? 's' : ''} sauvegardé{entries.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Storage indicator */}
            <div className="px-6 py-3 border-b border-slate-100 dark:border-white/5 flex items-center gap-2 text-xs text-slate-400 dark:text-white/30">
              <HardDrive className="w-3.5 h-3.5" />
              <span>Stockage : {storageMB} MB / {displayQuota}</span>
              <div className="flex-1 h-1.5 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden ml-2">
                <div
                  className={`h-full rounded-full transition-all ${pct > 80 ? 'bg-red-500' : pct > 60 ? 'bg-amber-500' : 'bg-indigo-500'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {entries.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-4 text-slate-300 dark:text-white/20">
                  <FolderOpen className="w-12 h-12" />
                  <div>
                    <p className="font-bold">Aucun projet sauvegardé</p>
                    <p className="text-xs mt-1 text-slate-400 dark:text-white/30">
                      Cliquez sur "Sauvegarder" dans le studio pour conserver vos productions.
                    </p>
                  </div>
                </div>
              ) : (
                entries.map((entry) => (
                  <motion.div
                    key={entry.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 space-y-3 hover:border-indigo-500/30 transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-sm truncate text-slate-900 dark:text-white">{entry.title}</h3>
                        <p className="text-[10px] text-slate-400 dark:text-white/30 mt-0.5">
                          {formatDate(entry.createdAt)} &middot; {entry.scenesCount} scènes
                        </p>
                      </div>
                    </div>

                    {/* Badges */}
                    <div className="flex flex-wrap gap-1.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-500 text-[10px] font-bold">
                        <FileText className="w-3 h-3" /> Script
                      </span>
                      {entry.hasImages && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 text-[10px] font-bold">
                          <ImageIcon className="w-3 h-3" /> {entry.imageCount} img
                        </span>
                      )}
                      {entry.hasAudio && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-500 text-[10px] font-bold">
                          <Mic className="w-3 h-3" /> Audio
                        </span>
                      )}
                      {entry.hasTuto && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-500 text-[10px] font-bold">
                          <Scissors className="w-3 h-3" /> Tuto
                        </span>
                      )}
                      {!entry.mediaStored && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500/10 text-red-400 text-[10px] font-bold">
                          <AlertTriangle className="w-3 h-3" /> Media non sauvé
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => { onLoad(entry.id); onClose(); }}
                        className="flex-1 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold uppercase tracking-widest rounded-xl transition-all"
                      >
                        Charger
                      </button>
                      {confirmDelete === entry.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => { onDelete(entry.id); setConfirmDelete(null); }}
                            className="px-3 py-2 bg-red-500 text-white text-[10px] font-bold uppercase rounded-xl"
                          >
                            Confirmer
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="px-3 py-2 bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-white/60 text-[10px] font-bold uppercase rounded-xl"
                          >
                            Annuler
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(entry.id)}
                          className="p-2 rounded-xl hover:bg-red-500/10 text-slate-300 dark:text-white/20 hover:text-red-500 transition-all"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
