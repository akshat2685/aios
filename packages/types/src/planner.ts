export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  parentId?: string;
  dependencies: string[];
  assignedAgent?: string;
  result?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Plan {
  id: string;
  goal: string;
  tasks: Task[];
  createdAt: number;
}
