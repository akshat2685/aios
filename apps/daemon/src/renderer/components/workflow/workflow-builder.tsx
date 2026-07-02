import React, { useState, useCallback, useEffect } from 'react';
import { ReactFlow, MiniMap, Controls, Background, BackgroundVariant, useNodesState, useEdgesState, addEdge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { getElectronAPI } from '@/lib/electron-api';

const initialNodes = [
  { id: '1', position: { x: 0, y: 0 }, data: { label: 'Time Trigger (8:00 AM)' } },
  { id: '2', position: { x: 0, y: 100 }, data: { label: 'Check HackerNews' } },
];
const initialEdges = [{ id: 'e1-2', source: '1', target: '2' }];

export function WorkflowBuilder() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [workflowName, setWorkflowName] = useState('My New Workflow');

  const onConnect = useCallback((params: any) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  const saveWorkflow = async () => {
    const api = getElectronAPI();
    
    // Construct workflow JSON structure
    const workflowConfig = {
      id: Math.random().toString(36).substring(7),
      name: workflowName,
      description: 'Auto-generated visual workflow',
      trigger: {
        id: 'trigger-1',
        type: 'time',
        config: { cron: '0 8 * * *' },
        enabled: true
      },
      steps: [
        {
          id: 'step-1',
          action: {
            id: 'action-1',
            name: 'Check HackerNews',
            type: 'agent',
            params: { task: 'Summarize top 3 AI posts on HackerNews' }
          }
        }
      ],
      isActive: true,
      uiData: { nodes, edges }
    };

    const res = await api.workflow.save(workflowConfig);
    if (res.status === 'success') {
      alert('Workflow saved to Vector DB!');
    } else {
      alert('Failed to save: ' + res.error);
    }
  };

  return (
    <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '10px', display: 'flex', gap: '10px', borderBottom: '1px solid #ccc' }}>
        <input 
          value={workflowName} 
          onChange={(e) => setWorkflowName(e.target.value)}
          className="border border-border rounded px-2 py-1 bg-background text-foreground"
          style={{ flexGrow: 1 }}
        />
        <button 
          onClick={saveWorkflow}
          className="bg-primary text-primary-foreground px-4 py-1 rounded"
        >
          Save to Qdrant
        </button>
      </div>
      <div style={{ flexGrow: 1, position: 'relative' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
        >
          <Controls />
          <MiniMap />
          <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        </ReactFlow>
      </div>
    </div>
  );
}
