export interface Task {
  id: string;
  title: string;
  description: string;
  dependencies: string[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  assignedAgent?: string;
  complexity: 'low' | 'medium' | 'high';
  result?: string;
}

export interface Epic {
  id: string;
  goal: string;
  tasks: Task[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}
