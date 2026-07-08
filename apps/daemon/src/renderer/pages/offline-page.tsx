import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Cpu, Download, Trash2, Power, PowerOff, Mic,
  Volume2, Eye, Type, Layers, WifiOff, HardDrive,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] } },
};

interface LocalModel {
  id: string;
  name: string;
  type: 'embedding' | 'stt' | 'tts' | 'ocr' | 'vision';
  sizeMb: number;
  status: 'not_downloaded' | 'downloading' | 'ready' | 'loaded';
  downloadProgress: number;
  quantization?: string;
}

interface Capability {
  type: string;
  label: string;
  icon: any;
  enabled: boolean;
  modelId?: string;
  status: string;
}

export default function OfflinePage() {
  const [airGapped, setAirGapped] = useState(false);

  const [models] = useState<LocalModel[]>([
    { id: 'all-minilm-l6-v2', name: 'all-MiniLM-L6-v2', type: 'embedding', sizeMb: 90, status: 'loaded', downloadProgress: 1, quantization: 'f32' },
    { id: 'whisper-base-en', name: 'Whisper Base (English)', type: 'stt', sizeMb: 142, status: 'ready', downloadProgress: 1 },
    { id: 'piper-en-amy', name: 'Piper TTS (Amy)', type: 'tts', sizeMb: 63, status: 'not_downloaded', downloadProgress: 0 },
    { id: 'tesseract-eng', name: 'Tesseract OCR (English)', type: 'ocr', sizeMb: 12, status: 'ready', downloadProgress: 1 },
    { id: 'moondream-v2', name: 'Moondream v2 (Vision)', type: 'vision', sizeMb: 1700, status: 'downloading', downloadProgress: 0.45, quantization: 'q4_0' },
  ]);

  const [capabilities] = useState<Capability[]>([
    { type: 'embeddings', label: 'Local Embeddings', icon: Layers, enabled: true, modelId: 'all-minilm-l6-v2', status: 'loaded' },
    { type: 'stt', label: 'Speech-to-Text', icon: Mic, enabled: true, modelId: 'whisper-base-en', status: 'ready' },
    { type: 'tts', label: 'Text-to-Speech', icon: Volume2, enabled: false, status: 'not_downloaded' },
    { type: 'ocr', label: 'OCR', icon: Type, enabled: true, modelId: 'tesseract-eng', status: 'ready' },
    { type: 'vision', label: 'Vision', icon: Eye, enabled: false, status: 'downloading' },
  ]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'loaded': return { text: 'Loaded', class: 'bg-green-500/15 text-green-400 border-green-500/30' };
      case 'ready': return { text: 'Ready', class: 'bg-blue-500/15 text-blue-400 border-blue-500/30' };
      case 'downloading': return { text: 'Downloading', class: 'bg-amber-500/15 text-amber-400 border-amber-500/30' };
      default: return { text: 'Not Downloaded', class: 'bg-gray-500/15 text-gray-400 border-gray-500/30' };
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'embedding': return Layers;
      case 'stt': return Mic;
      case 'tts': return Volume2;
      case 'ocr': return Type;
      case 'vision': return Eye;
      default: return Cpu;
    }
  };

  const totalSizeMb = models.filter(m => m.status !== 'not_downloaded').reduce((sum, m) => sum + m.sizeMb, 0);
  const loadedCount = models.filter(m => m.status === 'loaded').length;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="h-full p-6 flex flex-col overflow-auto"
    >
      {/* Header */}
      <motion.div variants={cardVariants} className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-3">
            <Cpu className="text-red-400" /> Offline Intelligence
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Fully local AI stack — embeddings, speech, vision, OCR — no internet required.
          </p>
        </div>
        <button
          onClick={() => setAirGapped(!airGapped)}
          className={cn(
            'glass-interactive px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors border',
            airGapped
              ? 'border-red-500/30 text-red-400 bg-red-500/10'
              : 'border-glass-border text-muted-foreground hover:text-foreground'
          )}
        >
          <WifiOff size={14} />
          {airGapped ? 'Air-Gapped Mode ON' : 'Air-Gapped Mode'}
        </button>
      </motion.div>

      {/* Resource Overview */}
      <motion.div variants={cardVariants} className="grid grid-cols-3 gap-3 mb-4">
        <div className="glass-interactive p-4 rounded-xl">
          <div className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
            <HardDrive size={12} /> Disk Usage
          </div>
          <div className="text-2xl font-mono text-foreground">{(totalSizeMb / 1024).toFixed(1)} GB</div>
          <div className="text-[10px] text-muted-foreground">{models.filter(m => m.status !== 'not_downloaded').length} models on disk</div>
        </div>
        <div className="glass-interactive p-4 rounded-xl">
          <div className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
            <Power size={12} /> Loaded Models
          </div>
          <div className="text-2xl font-mono text-green-400">{loadedCount}</div>
          <div className="text-[10px] text-muted-foreground">of {models.length} total</div>
        </div>
        <div className="glass-interactive p-4 rounded-xl">
          <div className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
            <Cpu size={12} /> GPU
          </div>
          <div className="text-2xl font-mono text-muted-foreground">CPU</div>
          <div className="text-[10px] text-muted-foreground">No GPU acceleration detected</div>
        </div>
      </motion.div>

      {/* Capabilities */}
      <motion.div variants={cardVariants} className="grid grid-cols-5 gap-3 mb-4">
        {capabilities.map(cap => (
          <div
            key={cap.type}
            className={cn(
              'glass-interactive rounded-xl p-3 text-center transition-all',
              cap.enabled ? 'border border-green-500/20' : 'opacity-60'
            )}
          >
            <cap.icon size={20} className={cn('mx-auto mb-2', cap.enabled ? 'text-green-400' : 'text-muted-foreground')} />
            <div className="text-xs font-medium">{cap.label}</div>
            <div className={cn(
              'text-[9px] mt-1',
              cap.enabled ? 'text-green-400' : 'text-muted-foreground'
            )}>
              {cap.enabled ? '✓ Active' : '✗ Inactive'}
            </div>
          </div>
        ))}
      </motion.div>

      {/* Model Library */}
      <motion.div variants={cardVariants} className="glass-interactive rounded-xl p-5 flex-1">
        <h2 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">Model Library</h2>
        <div className="space-y-2">
          {models.map(model => {
            const TypeIcon = getTypeIcon(model.type);
            const badge = getStatusBadge(model.status);

            return (
              <div key={model.id} className="glass-strong rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <TypeIcon size={16} className="text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium">{model.name}</div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span>{model.sizeMb < 1024 ? `${model.sizeMb} MB` : `${(model.sizeMb / 1024).toFixed(1)} GB`}</span>
                      {model.quantization && <span>· {model.quantization}</span>}
                      <span>· {model.type}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {model.status === 'downloading' && (
                    <div className="w-20 flex items-center gap-2">
                      <div className="flex-1 bg-glass-strong h-1.5 rounded-full overflow-hidden">
                        <div className="bg-amber-400 h-full transition-all" style={{ width: `${model.downloadProgress * 100}%` }} />
                      </div>
                      <span className="text-[10px] text-amber-400 font-mono">{(model.downloadProgress * 100).toFixed(0)}%</span>
                    </div>
                  )}
                  <span className={cn('text-[10px] px-2 py-0.5 rounded-full border', badge.class)}>
                    {badge.text}
                  </span>
                  {model.status === 'ready' && (
                    <button className="glass-interactive p-1.5 rounded-lg text-green-400 hover:bg-green-500/10 transition-colors">
                      <Power size={12} />
                    </button>
                  )}
                  {model.status === 'loaded' && (
                    <button className="glass-interactive p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors">
                      <PowerOff size={12} />
                    </button>
                  )}
                  {model.status === 'not_downloaded' && (
                    <button className="glass-interactive p-1.5 rounded-lg text-accent hover:bg-accent/10 transition-colors">
                      <Download size={12} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}
