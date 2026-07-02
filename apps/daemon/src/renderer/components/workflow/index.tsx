import React, { useState } from 'react';
import { WorkflowList } from './workflow-list';
import { WorkflowBuilder } from './workflow-builder';

export function WorkflowEngine() {
  const [view, setView] = useState<'list' | 'builder'>('list');

  if (view === 'builder') {
    return (
      <div className="h-full flex flex-col relative">
        <button 
          onClick={() => setView('list')}
          className="absolute top-4 right-4 z-50 bg-background border border-border px-4 py-2 rounded-lg shadow-lg hover:bg-secondary"
        >
          &larr; Back to List
        </button>
        <WorkflowBuilder />
      </div>
    );
  }

  return <WorkflowList onNew={() => setView('builder')} />;
}
