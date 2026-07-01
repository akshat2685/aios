import { motion } from 'framer-motion';
import { Zap, Clock, FileCode, FolderSync, Terminal, Plus } from 'lucide-react';

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const automationTemplates = [
  { name: 'File Organizer', description: 'Automatically organize files by type and date', icon: FolderSync, color: 'text-accent' },
  { name: 'Code Formatter', description: 'Format code files on save in watched directories', icon: FileCode, color: 'text-secondary' },
  { name: 'Scheduled Script', description: 'Run scripts on a cron schedule', icon: Clock, color: 'text-warning' },
  { name: 'Custom Command', description: 'Execute shell commands with triggers', icon: Terminal, color: 'text-success' },
];

export default function AutomationPage() {
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
          <Zap size={20} className="text-warning" />
          <h1 className="text-2xl font-semibold">Automation Hub</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Create workflows to automate repetitive tasks. Dangerous actions require confirmation.
        </p>
      </motion.div>

      {/* Create New */}
      <motion.div variants={itemVariants} className="mb-6">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-warning/15 text-warning border border-warning/20 text-sm font-medium hover:bg-warning/20 transition-colors"
        >
          <Plus size={16} />
          Create Workflow
        </motion.button>
      </motion.div>

      {/* Templates */}
      <motion.div variants={itemVariants}>
        <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
          Templates
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {automationTemplates.map((template) => {
            const Icon = template.icon;
            return (
              <motion.div
                key={template.name}
                whileHover={{ scale: 1.01, y: -2 }}
                className="glass-interactive p-4 cursor-pointer"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-glass-strong flex items-center justify-center">
                    <Icon size={16} className={template.color} />
                  </div>
                  <span className="text-sm font-medium">{template.name}</span>
                </div>
                <p className="text-xs text-muted-foreground">{template.description}</p>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Active Workflows — Placeholder */}
      <motion.div variants={itemVariants} className="mt-8">
        <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
          Active Workflows
        </h2>
        <div className="glass-subtle p-8 text-center">
          <Zap size={32} className="text-muted-foreground mx-auto mb-3 opacity-30" />
          <p className="text-sm text-muted-foreground">No active workflows yet</p>
          <p className="text-xs text-muted-foreground mt-1">Create a workflow from a template above to get started</p>
        </div>
      </motion.div>
    </motion.div>
  );
}
