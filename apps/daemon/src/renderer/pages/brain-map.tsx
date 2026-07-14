import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Brain, Filter, Search, ZoomIn, ZoomOut, Maximize2,
  Circle, GitBranch, BarChart3, Eye,
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

const NODE_COLORS: Record<string, string> = {
  memory: '#3b82f6',
  project: '#22c55e',
  chat: '#a855f7',
  file: '#f59e0b',
  task: '#ef4444',
  agent: '#06b6d4',
  preference: '#ec4899',
  goal: '#8b5cf6',
};

interface MockNode {
  id: string;
  type: string;
  label: string;
  x: number;
  y: number;
  weight: number;
}

export default function BrainMapPage() {
  const [nodes] = useState<MockNode[]>(() => generateMockNodes(24));
  const [zoom, setZoom] = useState(1);
  const [selectedNode, setSelectedNode] = useState<MockNode | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const nodeTypes = ['all', 'memory', 'project', 'chat', 'file', 'task', 'agent', 'goal'];

  const filteredNodes = nodes.filter(n => {
    if (filterType !== 'all' && n.type !== filterType) return false;
    if (searchQuery && !n.label.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const stats = {
    totalNodes: nodes.length,
    totalEdges: Math.floor(nodes.length * 1.5),
    clusters: Object.keys(NODE_COLORS).filter(t => nodes.some(n => n.type === t)).length,
    avgDegree: 3.2,
  };

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
            <Brain className="text-accent" /> Brain Map
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Interactive knowledge graph — see every connection in your AI's brain.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button aria-label="Zoom out" onClick={() => setZoom(z => Math.max(0.3, z - 0.1))} className="glass-interactive p-2 rounded-lg">
            <ZoomOut size={16} />
          </button>
          <span className="text-xs text-muted-foreground font-mono w-12 text-center">{(zoom * 100).toFixed(0)}%</span>
          <button aria-label="Zoom in" onClick={() => setZoom(z => Math.min(3, z + 0.1))} className="glass-interactive p-2 rounded-lg">
            <ZoomIn size={16} />
          </button>
          <button aria-label="Reset zoom" onClick={() => setZoom(1)} className="glass-interactive p-2 rounded-lg">
            <Maximize2 size={16} />
          </button>
        </div>
      </motion.div>

      {/* Stats Bar */}
      <motion.div variants={cardVariants} className="grid grid-cols-4 gap-3 mb-4">
        {[
          { label: 'Nodes', value: stats.totalNodes, icon: Circle },
          { label: 'Edges', value: stats.totalEdges, icon: GitBranch },
          { label: 'Clusters', value: stats.clusters, icon: BarChart3 },
          { label: 'Avg Degree', value: stats.avgDegree.toFixed(1), icon: Eye },
        ].map(stat => (
          <div key={stat.label} className="glass-interactive p-3 rounded-xl flex items-center gap-3">
            <stat.icon size={14} className="text-accent" />
            <div>
              <div className="text-lg font-mono text-foreground">{stat.value}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{stat.label}</div>
            </div>
          </div>
        ))}
      </motion.div>

      {/* Filter & Search Bar */}
      <motion.div variants={cardVariants} className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-1 glass-interactive rounded-xl px-3 py-2 flex-1">
          <Search size={14} className="text-muted-foreground" />
          <input
            type="text"
            aria-label="Search nodes"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search nodes..."
            className="bg-transparent border-none outline-none text-sm text-foreground flex-1 ml-2"
          />
        </div>
        <div className="flex items-center gap-1">
          <Filter size={14} className="text-muted-foreground" />
          {nodeTypes.map(type => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={cn(
                'px-2 py-1 rounded-lg text-xs font-medium transition-all',
                filterType === type
                  ? 'bg-accent/20 text-accent border border-accent/30'
                  : 'text-muted-foreground hover:text-foreground hover:bg-glass-strong'
              )}
            >
              {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Graph Canvas */}
      <motion.div variants={cardVariants} className="flex-1 glass-interactive rounded-xl relative overflow-hidden min-h-[400px]">
        <svg
          className="w-full h-full"
          viewBox="-500 -400 1000 800"
          style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
        >
          {/* Edges */}
          {filteredNodes.map((node, i) => {
            const target = filteredNodes[(i + 3) % filteredNodes.length];
            if (!target || node.id === target.id) return null;
            return (
              <line
                key={`edge-${node.id}-${target.id}`}
                x1={node.x}
                y1={node.y}
                x2={target.x}
                y2={target.y}
                stroke="rgba(255,255,255,0.08)"
                strokeWidth={1}
              />
            );
          })}

          {/* Nodes */}
          {filteredNodes.map(node => (
            <g
              key={node.id}
              onClick={() => setSelectedNode(node)}
              onKeyDown={(e) => { if(e.key === 'Enter') setSelectedNode(node); }}
              role="button"
              tabIndex={0}
              className="cursor-pointer"
            >
              <circle
                cx={node.x}
                cy={node.y}
                r={8 + node.weight * 4}
                fill={NODE_COLORS[node.type] || '#888'}
                opacity={0.8}
                className="transition-all hover:opacity-100"
              />
              <circle
                cx={node.x}
                cy={node.y}
                r={12 + node.weight * 4}
                fill="none"
                stroke={NODE_COLORS[node.type] || '#888'}
                strokeWidth={selectedNode?.id === node.id ? 2 : 0}
                opacity={0.5}
              />
              <text
                x={node.x}
                y={node.y + 20 + node.weight * 4}
                textAnchor="middle"
                fill="rgba(255,255,255,0.6)"
                fontSize={9}
              >
                {node.label}
              </text>
            </g>
          ))}
        </svg>

        {/* Node Type Legend */}
        <div className="absolute bottom-3 left-3 glass-strong rounded-lg p-2 flex flex-wrap gap-2">
          {Object.entries(NODE_COLORS).map(([type, color]) => (
            <div key={type} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-[9px] text-muted-foreground capitalize">{type}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Node Details Panel */}
      {selectedNode && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 glass-interactive rounded-xl p-4"
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: NODE_COLORS[selectedNode.type] }} />
              {selectedNode.label}
            </h3>
            <button aria-label="Close details" onClick={() => setSelectedNode(null)} className="text-xs text-muted-foreground hover:text-foreground">
              ✕
            </button>
          </div>
          <div className="grid grid-cols-3 gap-4 text-xs text-muted-foreground">
            <div><span className="text-foreground font-medium">Type:</span> {selectedNode.type}</div>
            <div><span className="text-foreground font-medium">ID:</span> {selectedNode.id.substring(0, 12)}...</div>
            <div><span className="text-foreground font-medium">Weight:</span> {selectedNode.weight.toFixed(1)}</div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

function generateMockNodes(count: number): MockNode[] {
  const types = ['memory', 'project', 'chat', 'file', 'task', 'agent', 'preference', 'goal'];
  const labels = [
    'AIOS Core', 'Chat History', 'RAG Pipeline', 'User Prefs', 'LLM Router',
    'Workspace Sync', 'Security Policy', 'Task Queue', 'Agent Config', 'Memory DB',
    'Plugin System', 'Settings Store', 'Coder Agent', 'Research Agent', 'Planner Agent',
    'Knowledge Base', 'Vector Store', 'API Keys', 'Dashboard UI', 'Automation Rules',
    'File Watcher', 'Git Integration', 'Build Cache', 'Test Results',
  ];
  return labels.slice(0, count).map((label, i) => ({
    id: `node-${i}`,
    type: types[i % types.length],
    label,
    x: (Math.cos((i / count) * Math.PI * 2) * 300) + (Math.random() - 0.5) * 80,
    y: (Math.sin((i / count) * Math.PI * 2) * 250) + (Math.random() - 0.5) * 80,
    weight: 0.5 + Math.random() * 2,
  }));
}
