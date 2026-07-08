import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  User, Code2, MessageSquare, Target, Pencil,
  BarChart3, Clock, Sparkles,
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

interface CodingStyle {
  indentation: string;
  namingConvention: string;
  commentDensity: number;
  preferredLanguages: string[];
  typeStrictness: string;
  complexityPreference: string;
  functionalVsOop: number;
}

interface TonePrefs {
  formality: number;
  verbosity: number;
  technicalDepth: number;
  emojiUsage: number;
  responseStructure: string;
}

interface Objective {
  id: string;
  title: string;
  progress: number;
  priority: string;
}

export default function TwinPage() {
  const [codingStyle] = useState<CodingStyle>({
    indentation: 'spaces-2',
    namingConvention: 'camelCase',
    commentDensity: 0.35,
    preferredLanguages: ['TypeScript', 'Python', 'Rust'],
    typeStrictness: 'strict',
    complexityPreference: 'moderate',
    functionalVsOop: 0.6,
  });

  const [tone] = useState<TonePrefs>({
    formality: 0.4,
    verbosity: 0.55,
    technicalDepth: 0.8,
    emojiUsage: 0.15,
    responseStructure: 'mixed',
  });

  const [objectives] = useState<Objective[]>([
    { id: '1', title: 'Build AIOS Phase 10', progress: 0.1, priority: 'critical' },
    { id: '2', title: 'Learn Rust systems programming', progress: 0.35, priority: 'high' },
    { id: '3', title: 'Write comprehensive test suite', progress: 0.6, priority: 'medium' },
  ]);

  const [confidence] = useState(0.42);
  const [observations] = useState(42);

  const radarDimensions = [
    { label: 'Formality', value: tone.formality },
    { label: 'Verbosity', value: tone.verbosity },
    { label: 'Tech Depth', value: tone.technicalDepth },
    { label: 'Comment Density', value: codingStyle.commentDensity },
    { label: 'Functional', value: codingStyle.functionalVsOop },
    { label: 'Strictness', value: codingStyle.typeStrictness === 'strict' ? 0.9 : 0.5 },
  ];

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
            <User className="text-secondary" /> Digital Twin
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your AI's model of you — coding style, tone, and long-term objectives.
          </p>
        </div>
        <div className="glass-interactive rounded-xl px-4 py-2 flex items-center gap-3">
          <Sparkles size={14} className="text-secondary" />
          <div className="text-xs">
            <span className="text-muted-foreground">Profile Confidence: </span>
            <span className="text-foreground font-mono">{(confidence * 100).toFixed(0)}%</span>
          </div>
          <div className="w-20 bg-glass-strong h-1.5 rounded-full overflow-hidden">
            <div className="bg-secondary h-full transition-all" style={{ width: `${confidence * 100}%` }} />
          </div>
          <span className="text-[10px] text-muted-foreground">{observations} observations</span>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1">
        {/* Coding Style */}
        <motion.div variants={cardVariants} className="glass-interactive rounded-xl p-5">
          <h2 className="text-sm font-semibold flex items-center gap-2 mb-4">
            <Code2 size={16} className="text-accent" /> Coding Style Profile
          </h2>
          <div className="space-y-3">
            {[
              { label: 'Indentation', value: codingStyle.indentation },
              { label: 'Naming Convention', value: codingStyle.namingConvention },
              { label: 'Type Strictness', value: codingStyle.typeStrictness },
              { label: 'Complexity', value: codingStyle.complexityPreference },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{item.label}</span>
                <span className="text-xs font-mono text-foreground glass-strong px-2 py-1 rounded">{item.value}</span>
              </div>
            ))}
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Comment Density</span>
              <div className="flex items-center gap-2">
                <div className="w-24 bg-glass-strong h-1.5 rounded-full overflow-hidden">
                  <div className="bg-accent h-full" style={{ width: `${codingStyle.commentDensity * 100}%` }} />
                </div>
                <span className="text-[10px] font-mono text-muted-foreground">{(codingStyle.commentDensity * 100).toFixed(0)}%</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Functional ↔ OOP</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">OOP</span>
                <div className="w-24 bg-glass-strong h-1.5 rounded-full overflow-hidden">
                  <div className="bg-secondary h-full" style={{ width: `${codingStyle.functionalVsOop * 100}%` }} />
                </div>
                <span className="text-[10px] text-muted-foreground">FP</span>
              </div>
            </div>
            <div className="mt-3">
              <span className="text-xs text-muted-foreground">Preferred Languages</span>
              <div className="flex gap-1.5 mt-1.5">
                {codingStyle.preferredLanguages.map(lang => (
                  <span key={lang} className="text-[10px] bg-accent/15 text-accent px-2 py-0.5 rounded-full border border-accent/20">
                    {lang}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Tone Preferences */}
        <motion.div variants={cardVariants} className="glass-interactive rounded-xl p-5">
          <h2 className="text-sm font-semibold flex items-center gap-2 mb-4">
            <MessageSquare size={16} className="text-secondary" /> Tone Preferences
          </h2>
          <div className="space-y-4">
            {[
              { label: 'Formality', value: tone.formality, low: 'Casual', high: 'Formal', color: 'bg-accent' },
              { label: 'Verbosity', value: tone.verbosity, low: 'Terse', high: 'Detailed', color: 'bg-secondary' },
              { label: 'Technical Depth', value: tone.technicalDepth, low: 'High-level', high: 'Deep', color: 'bg-green-500' },
              { label: 'Emoji Usage', value: tone.emojiUsage, low: 'Never', high: 'Frequent', color: 'bg-amber-500' },
            ].map(item => (
              <div key={item.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                  <span className="text-[10px] font-mono text-muted-foreground">{(item.value * 100).toFixed(0)}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-muted-foreground w-14 text-right">{item.low}</span>
                  <div className="flex-1 bg-glass-strong h-2 rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full transition-all', item.color)} style={{ width: `${item.value * 100}%` }} />
                  </div>
                  <span className="text-[9px] text-muted-foreground w-14">{item.high}</span>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 border-t border-glass-border">
              <span className="text-xs text-muted-foreground">Response Structure</span>
              <span className="text-xs font-mono text-foreground glass-strong px-2 py-1 rounded">{tone.responseStructure}</span>
            </div>
          </div>
        </motion.div>

        {/* Long-Term Objectives */}
        <motion.div variants={cardVariants} className="glass-interactive rounded-xl p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold flex items-center gap-2 mb-4">
            <Target size={16} className="text-green-400" /> Long-Term Objectives
          </h2>
          <div className="space-y-3">
            {objectives.map(obj => (
              <div key={obj.id} className="glass-strong rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{obj.title}</span>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-[10px] px-2 py-0.5 rounded-full border',
                      obj.priority === 'critical' ? 'bg-red-500/15 text-red-400 border-red-500/30' :
                      obj.priority === 'high' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' :
                      'bg-blue-500/15 text-blue-400 border-blue-500/30'
                    )}>
                      {obj.priority}
                    </span>
                    <span className="text-xs font-mono text-muted-foreground">{(obj.progress * 100).toFixed(0)}%</span>
                  </div>
                </div>
                <div className="w-full bg-glass-strong h-2 rounded-full overflow-hidden">
                  <motion.div
                    className="bg-green-500 h-full rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${obj.progress * 100}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
