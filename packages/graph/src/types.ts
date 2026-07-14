export interface IGraphService {
  init(): Promise<void>;

  // Projects
  createProject(name: string, description?: string): Promise<string>;
  getProjects(): Promise<any[]>;
  deleteProject(id: string): Promise<void>;

  // Tasks
  createTask(projectId: string, title: string, description?: string, priority?: 'low' | 'medium' | 'high'): Promise<string>;
  getTasksForProject(projectId: string): Promise<any[]>;
  updateTaskStatus(id: string, status: 'todo' | 'in_progress' | 'done'): Promise<void>;
  deleteTask(id: string): Promise<void>;
  searchTasksSemantically(query: string, limit?: number): Promise<any[]>;

  // Files
  linkFileToTask(taskId: string, filePath: string): Promise<string>;
  getFilesForTask(taskId: string): Promise<any[]>;
}
