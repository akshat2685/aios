import { useState } from 'react';
import { motion } from 'framer-motion';
import { FlaskConical, Search, Loader2, BookOpen, ExternalLink } from 'lucide-react';
import { getElectronAPI } from '@/lib/electron-api';

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export default function ResearchPage() {
  const api = getElectronAPI();
  const [query, setQuery] = useState('');
  const [isResearching, setIsResearching] = useState(false);
  const [report, setReport] = useState<any>(null);

  const handleResearch = async () => {
    if (!query.trim() || isResearching) return;
    setIsResearching(true);
    setReport(null);

    try {
      const result = await api.research.conduct({ query: query.trim() });
      setReport(result);
    } catch (e: any) {
      setReport({ topic: query, summary: `Research failed: ${e.message}`, keyFindings: [], metadata: { sourcesAnalyzed: 0 } });
    } finally {
      setIsResearching(false);
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="h-full p-6 overflow-y-auto"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <FlaskConical size={20} className="text-success" />
          <h1 className="text-2xl font-semibold">Research Lab</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Conduct AI-powered research on any topic. Sources are fetched, analyzed, and synthesized into reports.
        </p>
      </motion.div>

      {/* Search */}
      <motion.div variants={itemVariants} className="glass-strong rounded-2xl flex items-center gap-3 p-3 mb-6">
        <Search size={16} className="text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleResearch()}
          placeholder="What would you like to research?"
          className="flex-1 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground"
        />
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleResearch}
          disabled={!query.trim() || isResearching}
          className="px-4 py-2 rounded-xl bg-success/15 text-success border border-success/20 text-sm font-medium hover:bg-success/20 transition-colors disabled:opacity-50"
        >
          {isResearching ? (
            <div className="flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              Researching...
            </div>
          ) : (
            'Research'
          )}
        </motion.button>
      </motion.div>

      {/* Report */}
      {report && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass p-6 space-y-4"
        >
          <div className="flex items-center gap-2">
            <BookOpen size={16} className="text-accent" />
            <h2 className="text-lg font-semibold">{report.topic}</h2>
          </div>

          <div className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
            {report.summary}
          </div>

          {report.metadata && (
            <div className="flex items-center gap-4 pt-4 border-t border-glass-border text-xs text-muted-foreground">
              <span>Sources analyzed: {report.metadata.sourcesAnalyzed}</span>
              {report.metadata.endTime && report.metadata.startTime && (
                <span>Time: {((report.metadata.endTime - report.metadata.startTime) / 1000).toFixed(1)}s</span>
              )}
            </div>
          )}
        </motion.div>
      )}

      {/* Empty State */}
      {!report && !isResearching && (
        <motion.div variants={itemVariants} className="text-center py-16">
          <FlaskConical size={48} className="text-muted-foreground mx-auto mb-4 opacity-30" />
          <p className="text-sm text-muted-foreground">
            Enter a research query above to get started
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}
