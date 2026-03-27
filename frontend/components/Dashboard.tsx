'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/hooks/useAuthStore';
import { Search, Plus, FolderOpen, FileAudio, Clock, Tag, MoreVertical, LogOut, ChevronRight, Mic, Upload, Filter, Pencil, Trash2, Eye, X } from 'lucide-react';

interface Job {
  id: string;
  fileName: string;
  status: string;
  type: string;
  createdAt: string;
  progress: number;
  project?: { id: string; name: string } | null;
  tags?: string[];
}

interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  _count: { jobs: number };
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { setView, setCurrentJob } = useAuthStore();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [editingProject, setEditingProject] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const token = useAuthStore.getState().token;
    try {
      const [jobsRes, projectsRes] = await Promise.all([
        fetch('/api/jobs', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/projects', { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (jobsRes.ok) {
        const jobsData = await jobsRes.json();
        setJobs(jobsData.jobs || []);
      }
      if (projectsRes.ok) {
        const projectsData = await projectsRes.json();
        setProjects(projectsData || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredJobs = jobs.filter(job => {
    const searchLower = search.toLowerCase();
    const matchesFileName = job.fileName.toLowerCase().includes(searchLower);
    const matchesTags = job.tags?.some((tag: string) => tag.toLowerCase().includes(searchLower));
    const matchesProject = job.project?.name.toLowerCase().includes(searchLower);
    return matchesFileName || matchesTags || matchesProject;
  });

  const handleJobClick = (jobId: string) => {
    setCurrentJob(jobId);
    setView('wizard');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'text-green-400';
      case 'PROCESSING': return 'text-yellow-400';
      case 'FAILED': return 'text-red-400';
      default: return 'text-text-secondary';
    }
  };

  const startEditingProject = (project: Project) => {
    setEditingProject(project.id);
    setEditingName(project.name);
  };

  const saveProjectName = async () => {
    if (!editingProject || !editingName.trim()) return;
    const token = useAuthStore.getState().token;
    try {
      const res = await fetch(`/api/projects/${editingProject}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name: editingName.trim() })
      });
      if (res.ok) {
        setProjects(projects.map(p => p.id === editingProject ? { ...p, name: editingName.trim() } : p));
        setEditingProject(null);
      }
    } catch (error) {
      console.error('Error updating project:', error);
    }
  };

  const updateProjectName = async (projectId: string, newName: string) => {
    const token = useAuthStore.getState().token;
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name: newName })
      });
      if (res.ok) {
        setProjects(projects.map(p => p.id === projectId ? { ...p, name: newName } : p));
      }
    } catch (error) {
      console.error('Error updating project:', error);
    }
  };

  const deleteProject = async (projectId: string) => {
    if (!confirm('¿Eliminar este proyecto?')) return;
    const token = useAuthStore.getState().token;
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setProjects(projects.filter(p => p.id !== projectId));
        if (selectedProject === projectId) {
          setSelectedProject(null);
        }
      }
    } catch (error) {
      console.error('Error deleting project:', error);
    }
  };

  const deleteJob = async (jobId: string) => {
    const token = useAuthStore.getState().token;
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setJobs(jobs.filter(j => j.id !== jobId));
      }
    } catch (error) {
      console.error('Error deleting job:', error);
    }
  };

  const updateJobFileName = async (jobId: string, newName: string) => {
    const token = useAuthStore.getState().token;
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ fileName: newName })
      });
      if (res.ok) {
        setJobs(jobs.map(j => j.id === jobId ? { ...j, fileName: newName } : j));
      }
    } catch (error) {
      console.error('Error updating job:', error);
    }
  };

  const assignJobToProject = async (jobId: string, projectId: string) => {
    const token = useAuthStore.getState().token;
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ projectId })
      });
      if (res.ok) {
        const project = projects.find(p => p.id === projectId);
        setJobs(jobs.map(j => j.id === jobId ? { ...j, project: project || null } : j));
      }
    } catch (error) {
      console.error('Error assigning job to project:', error);
    }
  };

  const addTag = async (jobId: string, tag: string) => {
    const token = useAuthStore.getState().token;
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    const newTags = [...(job.tags || []), tag];
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ tags: newTags })
      });
      if (res.ok) {
        setJobs(jobs.map(j => j.id === jobId ? { ...j, tags: newTags } : j));
      }
    } catch (error) {
      console.error('Error adding tag:', error);
    }
  };

  const removeTag = async (jobId: string, tag: string) => {
    const token = useAuthStore.getState().token;
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    const newTags = (job.tags || []).filter(t => t !== tag);
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ tags: newTags })
      });
      if (res.ok) {
        setJobs(jobs.map(j => j.id === jobId ? { ...j, tags: newTags } : j));
      }
    } catch (error) {
      console.error('Error removing tag:', error);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background-secondary/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-hero-gradient flex items-center justify-center">
              <FileAudio className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold gradient-text">Transcribe AI</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-text-secondary">{user?.email}</span>
            <button
              onClick={logout}
              className="p-2 rounded-lg hover:bg-background-secondary transition-colors text-text-secondary hover:text-text-primary"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row gap-8">
          <aside className="w-full md:w-64 shrink-0">
            <div className="sticky top-24 space-y-6">
              <button
                onClick={() => setView('wizard')}
                className="w-full py-3 px-4 rounded-xl bg-accent-cyan text-white font-semibold flex items-center justify-center gap-2 hover:bg-accent-cyan/90 transition-opacity"
              >
                <Plus className="w-5 h-5" />
                Nuevo Trabajo
              </button>
              <button
                onClick={async () => {
                  const name = prompt('Nombre del nuevo proyecto:');
                  if (name && name.trim()) {
                    const token = useAuthStore.getState().token;
                    try {
                      const res = await fetch('/api/projects', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          Authorization: `Bearer ${token}`
                        },
                        body: JSON.stringify({ name: name.trim() })
                      });
                      if (res.ok) {
                        const newProject = await res.json();
                        setProjects([newProject, ...projects]);
                      }
                    } catch (error) {
                      console.error('Error creating project:', error);
                    }
                  }
                }}
                className="w-full py-3 px-4 rounded-xl bg-hero-gradient text-white font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
              >
                <Plus className="w-5 h-5" />
                Nuevo proyecto
              </button>

              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider px-2">Proyectos</h3>
                <button
                  onClick={() => setSelectedProject(null)}
                  className={`w-full px-3 py-2 rounded-lg text-left text-sm flex items-center gap-2 transition-colors ${!selectedProject ? 'bg-accent-purple/20 text-accent-purple' : 'text-text-secondary hover:bg-background-secondary'}`}
                >
                  <FolderOpen className="w-4 h-4" />
                  Todos los archivos
                </button>
                {projects.length === 0 && (
                  <p className="text-xs text-text-secondary px-3 py-2">No hay proyectos</p>
                )}
                {projects.map(project => (
                  <div
                    key={project.id}
                    className="w-full px-3 py-2 rounded-lg text-sm flex items-center gap-2 bg-accent-purple/5 hover:bg-accent-purple/10 border border-transparent hover:border-accent-purple/30 transition-all"
                  >
                    <FolderOpen className="w-5 h-5 shrink-0 text-accent-purple" />
                    {editingProject === project.id ? (
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onBlur={saveProjectName}
                        onKeyDown={(e) => e.key === 'Enter' && saveProjectName()}
                        className="flex-1 bg-background border border-accent-purple rounded px-2 py-1 text-sm focus:outline-none"
                        autoFocus
                      />
                    ) : (
                      <>
                        <button
                          onClick={() => setSelectedProject(project.id)}
                          className="flex-1 truncate text-left font-medium"
                        >
                          {project.name}
                        </button>
                        <button
                          onClick={() => startEditingProject(project)}
                          className="p-1 rounded hover:bg-accent-purple/20 text-accent-purple"
                          title="Editar nombre"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => deleteProject(project.id)}
                          className="p-1 rounded hover:bg-red-500/20 text-red-400"
                          title="Eliminar proyecto"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </>
                    )}
                    <span className="text-xs bg-background px-2 py-1 rounded text-text-secondary">{project._count?.jobs || 0}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <div className="flex-1">
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
                <input
                  type="text"
                  placeholder="Buscar archivos..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-xl bg-background-secondary border border-border text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent-purple transition-colors"
                />
              </div>

              <div className="flex gap-2">
                <button className="px-4 py-2 rounded-xl bg-background-secondary border border-border text-text-secondary hover:border-accent-purple transition-colors flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  Filtros
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin w-8 h-8 border-2 border-accent-purple border-t-transparent rounded-full" />
              </div>
            ) : filteredJobs.length === 0 ? (
              <div className="text-center py-20">
                <FileAudio className="w-16 h-16 mx-auto mb-4 text-text-secondary opacity-50" />
                <h3 className="text-lg font-semibold mb-2">No hay archivos</h3>
                <p className="text-text-secondary mb-6">Sube un archivo o graba una reunión para comenzar</p>
                <button
                  onClick={() => setView('wizard')}
                  className="px-6 py-3 rounded-xl bg-hero-gradient text-white font-semibold"
                >
                  Comenzar
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredJobs.map(job => (
                  <div
                    key={job.id}
                    className="p-4 rounded-xl bg-background-secondary border border-border hover:border-accent-purple/50 transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div 
                        className={`w-10 h-10 rounded-lg flex items-center justify-center cursor-pointer ${job.type === 'RECORD' ? 'bg-accent-cyan/20' : 'bg-accent-purple/20'}`}
                        onClick={() => handleJobClick(job.id)}
                      >
                        {job.type === 'RECORD' ? (
                          <Mic className="w-5 h-5 text-accent-cyan" />
                        ) : (
                          <Upload className="w-5 h-5 text-accent-purple" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium truncate cursor-pointer" onClick={() => handleJobClick(job.id)}>{job.fileName}</h3>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const newName = prompt('Nuevo nombre del archivo:', job.fileName);
                              if (newName && newName.trim() && newName !== job.fileName) {
                                updateJobFileName(job.id, newName.trim());
                              }
                            }}
                            className="p-1 rounded hover:bg-accent-purple/20 text-accent-purple shrink-0"
                            title="Editar nombre del archivo"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-text-secondary">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(job.createdAt).toLocaleDateString('es-ES')}
                          </span>
                          <span className={getStatusColor(job.status)}>{job.status}</span>
                          {job.project ? (
                            <span className="flex items-center gap-1">
                              <FolderOpen className="w-3 h-3" />
                              <span className="truncate max-w-[100px]">{job.project.name}</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const projId = job.project!.id;
                                  const projName = job.project!.name;
                                  const newName = prompt('Nuevo nombre del proyecto:', projName);
                                  if (newName && newName.trim()) {
                                    updateProjectName(projId, newName.trim());
                                  }
                                }}
                                className="p-1 rounded hover:bg-accent-purple/20 text-accent-purple"
                                title="Editar nombre del proyecto"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            </span>
                          ) : (
                            <select
                              className="bg-background border border-border rounded px-2 py-1 text-xs text-text-secondary focus:outline-none focus:border-accent-purple"
                              value=""
                              onChange={(e) => {
                                if (e.target.value) {
                                  assignJobToProject(job.id, e.target.value);
                                }
                              }}
                            >
                              <option value="">Sin proyecto</option>
                              {projects.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                            </select>
                          )}
                          <div className="flex items-center gap-1 flex-wrap mt-1">
                            {job.tags?.map((tag: string, idx: number) => (
                              <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-purple/10 text-accent-purple text-xs">
                                {tag}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeTag(job.id, tag);
                                  }}
                                  className="hover:text-red-400"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            ))}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const tag = prompt('Nuevo tag:');
                                if (tag && tag.trim()) {
                                  addTag(job.id, tag.trim());
                                }
                              }}
                              className="px-2 py-0.5 rounded-full bg-background text-text-secondary text-xs hover:text-accent-purple hover:bg-accent-purple/10"
                            >
                              + Tag
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {job.status === 'PROCESSING' && (
                          <div className="w-20 h-2 rounded-full bg-background overflow-hidden">
                            <div
                              className="h-full bg-hero-gradient transition-all"
                              style={{ width: `${job.progress}%` }}
                            />
                          </div>
                        )}
                        <button
                          onClick={() => handleJobClick(job.id)}
                          className="p-2 rounded-lg hover:bg-accent-purple/10 text-accent-purple"
                          title="Ver detalles"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('¿Eliminar este archivo?')) {
                              deleteJob(job.id);
                            }
                          }}
                          className="p-2 rounded-lg hover:bg-red-500/20 text-red-400"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
