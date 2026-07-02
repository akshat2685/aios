import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FolderGit, Plus, Trash2, CheckCircle2, Circle, AlertCircle } from 'lucide-react';
import { getElectronAPI } from '@/lib/electron-api';
import { cn } from '@/lib/utils';

export function ProjectsPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  
  const [newProjectName, setNewProjectName] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');

  const loadProjects = async () => {
    const api = getElectronAPI();
    const data = await api.graph.getProjects();
    setProjects(data);
    if (data.length > 0 && !activeProjectId) {
      setActiveProjectId(data[0].id);
    }
  };

  const loadTasks = async (projectId: string) => {
    const api = getElectronAPI();
    const data = await api.graph.getTasks(projectId);
    setTasks(data);
  };

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (activeProjectId) {
      loadTasks(activeProjectId);
    } else {
      setTasks([]);
    }
  }, [activeProjectId]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    const api = getElectronAPI();
    await api.graph.createProject({ name: newProjectName });
    setNewProjectName('');
    loadProjects();
  };

  const handleDeleteProject = async (id: string) => {
    const api = getElectronAPI();
    await api.graph.deleteProject(id);
    if (activeProjectId === id) setActiveProjectId(null);
    loadProjects();
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !activeProjectId) return;
    const api = getElectronAPI();
    await api.graph.createTask({ projectId: activeProjectId, title: newTaskTitle });
    setNewTaskTitle('');
    loadTasks(activeProjectId);
  };

  const handleToggleTask = async (task: any) => {
    const api = getElectronAPI();
    const newStatus = task.status === 'done' ? 'todo' : 'done';
    await api.graph.updateTaskStatus(task.id, newStatus);
    if (activeProjectId) loadTasks(activeProjectId);
  };

  const handleDeleteTask = async (taskId: string) => {
    const api = getElectronAPI();
    await api.graph.deleteTask(taskId);
    if (activeProjectId) loadTasks(activeProjectId);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="h-full flex flex-col p-6"
    >
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary">
          <FolderGit size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects & Tasks</h1>
          <p className="text-muted-foreground text-sm">Knowledge Graph relational entity tracking</p>
        </div>
      </div>
      
      <div className="flex-1 flex overflow-hidden gap-6">
        {/* Projects Sidebar */}
        <div className="w-64 flex flex-col gap-4 border-r border-glass-border pr-6">
          <form onSubmit={handleCreateProject} className="flex gap-2">
            <input 
              type="text" 
              placeholder="New Project..." 
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              className="flex-1 bg-glass border border-glass-border rounded-md px-3 py-1.5 text-sm"
            />
            <button type="submit" className="p-1.5 bg-primary/20 text-primary rounded-md hover:bg-primary/30">
              <Plus size={16} />
            </button>
          </form>

          <div className="flex-1 overflow-y-auto space-y-1">
            {projects.map((proj) => (
              <div 
                key={proj.id}
                onClick={() => setActiveProjectId(proj.id)}
                className={cn(
                  "group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors",
                  activeProjectId === proj.id ? "bg-primary/10 text-primary" : "hover:bg-glass"
                )}
              >
                <div className="flex items-center gap-3">
                  <FolderGit size={16} />
                  <span className="font-medium">{proj.name}</span>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleDeleteProject(proj.id); }}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-opacity"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {projects.length === 0 && (
              <div className="text-center p-4 text-sm text-muted-foreground">
                No projects yet.
              </div>
            )}
          </div>
        </div>

        {/* Tasks List */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {activeProjectId ? (
            <>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold">
                  {projects.find(p => p.id === activeProjectId)?.name} Tasks
                </h2>
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-2 pr-4">
                {tasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 text-muted-foreground space-y-3 border border-dashed border-glass-border rounded-xl">
                    <AlertCircle size={24} />
                    <p>No tasks found for this project.</p>
                  </div>
                ) : (
                  tasks.map((task) => (
                    <div 
                      key={task.id} 
                      className={cn(
                        "flex items-center justify-between p-4 rounded-xl border transition-all",
                        task.status === 'done' ? "bg-glass/50 border-glass-border/50 opacity-60" : "bg-glass border-glass-border hover:border-primary/50"
                      )}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <button 
                          onClick={() => handleToggleTask(task)}
                          className={cn(
                            "flex-shrink-0",
                            task.status === 'done' ? "text-green-500" : "text-muted-foreground hover:text-primary"
                          )}
                        >
                          {task.status === 'done' ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                        </button>
                        <div className="flex flex-col">
                          <span className={cn(
                            "font-medium truncate",
                            task.status === 'done' && "line-through"
                          )}>{task.title}</span>
                          <span className="text-xs text-muted-foreground uppercase">{task.priority} Priority</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleDeleteTask(task.id)}
                        className="p-2 text-muted-foreground hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors ml-4"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="pt-4 border-t border-glass-border mt-4">
                <form onSubmit={handleCreateTask} className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Add a new task..." 
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    className="flex-1 bg-glass border border-glass-border rounded-xl px-4 py-3 focus:outline-none focus:border-primary/50"
                  />
                  <button type="submit" className="px-6 bg-primary text-primary-foreground font-medium rounded-xl hover:bg-primary/90 transition-colors">
                    Add
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground space-y-4">
              <FolderGit size={48} className="opacity-20" />
              <p>Select or create a project to view tasks.</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
