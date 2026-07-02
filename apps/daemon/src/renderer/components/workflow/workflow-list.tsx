import React, { useEffect, useState } from 'react';
import { getElectronAPI } from '@/lib/electron-api';
import { Play, Square, Trash, Edit, Plus } from 'lucide-react';

export function WorkflowList({ onNew }: { onNew: () => void }) {
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const fetchWorkflows = async () => {
    setLoading(true);
    try {
      const api = getElectronAPI();
      const list = await api.workflow.list();
      setWorkflows(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const api = getElectronAPI();
    await api.workflow.delete(id);
    fetchWorkflows();
  };

  const handleTrigger = async (id: string) => {
    const api = getElectronAPI();
    // Assuming we have a manual trigger event we can broadcast, or we can just send the event.
    // For now, since the trigger is generic, we'll just send an arbitrary event to see if it catches.
    await api.workflow.trigger('manual_trigger', { workflowId: id });
    alert(`Triggered workflow ${id}`);
  };

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Loading workflows from Memory...</div>;
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Automation Workflows</h1>
          <p className="text-muted-foreground">Manage your background AI tasks</p>
        </div>
        <button 
          onClick={onNew}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-lg flex items-center gap-2 hover:opacity-90"
        >
          <Plus className="w-4 h-4" />
          Create Workflow
        </button>
      </div>

      {workflows.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl p-12 text-center text-muted-foreground flex flex-col items-center justify-center">
          <p className="mb-4">No workflows found in Vector Memory.</p>
          <button onClick={onNew} className="text-primary hover:underline">Create your first workflow</button>
        </div>
      ) : (
        <div className="space-y-4">
          {workflows.map(wf => (
            <div key={wf.id} className="border border-border bg-card rounded-xl p-6 flex justify-between items-center">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="font-semibold text-lg">{wf.name}</h3>
                  {wf.isActive ? (
                    <span className="bg-green-500/20 text-green-500 text-xs px-2 py-0.5 rounded-full font-medium border border-green-500/30">Active</span>
                  ) : (
                    <span className="bg-zinc-500/20 text-zinc-400 text-xs px-2 py-0.5 rounded-full font-medium border border-zinc-500/30">Inactive</span>
                  )}
                </div>
                <p className="text-muted-foreground text-sm mb-2">{wf.description || 'No description'}</p>
                <div className="text-xs text-muted-foreground/70 font-mono">
                  Trigger: {wf.trigger?.type} {wf.trigger?.config?.cron ? `(${wf.trigger.config.cron})` : ''}
                </div>
              </div>
              
              <div className="flex gap-2">
                <button onClick={() => handleTrigger(wf.id)} className="p-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80" title="Run Now">
                  <Play className="w-4 h-4" />
                </button>
                <button className="p-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80" title="Edit">
                  <Edit className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(wf.id)} className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20" title="Delete">
                  <Trash className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
