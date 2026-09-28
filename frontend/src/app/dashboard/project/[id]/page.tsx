'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import api from '@/lib/axios';
import { Loader2, Plus, GripVertical, UserPlus, MessageSquare, User, X } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/useAuthStore';

export default function ProjectBoardPage() {
  const params = useParams();
  const projectId = params.id as string;
  const { user } = useAuthStore();
  
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  // Form state for new tasks
  const [addingTaskCol, setAddingTaskCol] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  // Modals state
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [taskDetails, setTaskDetails] = useState<any>(null);
  const [newComment, setNewComment] = useState('');

  const fetchProjectDetails = useCallback(async () => {
    try {
      const res = await api.get(`/projects/${projectId}`);
      setProject(res.data);
    } catch (error) {
      console.error('Failed to fetch project details');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    setIsMounted(true);
    fetchProjectDetails();

    const newSocket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000', {
      withCredentials: true,
    });

    newSocket.on('connect', () => {
      newSocket.emit('join_project', projectId);
    });

    newSocket.on('task_created', (newTask) => {
      setProject((prev: any) => {
        if (!prev) return prev;
        const newColumns = prev.columns.map((col: any) => {
          if (col.id === newTask.columnId) {
            return { ...col, tasks: [...col.tasks, newTask].sort((a: any, b: any) => a.order - b.order) };
          }
          return col;
        });
        return { ...prev, columns: newColumns };
      });
    });

    newSocket.on('task_updated', (updatedTask) => {
      setProject((prev: any) => {
        if (!prev) return prev;
        const newColumns = prev.columns.map((col: any) => {
          const filteredTasks = col.tasks.filter((t: any) => t.id !== updatedTask.id);
          if (col.id === updatedTask.columnId) {
            filteredTasks.push(updatedTask);
            filteredTasks.sort((a: any, b: any) => a.order - b.order);
          }
          return { ...col, tasks: filteredTasks };
        });
        return { ...prev, columns: newColumns };
      });
    });

    newSocket.on('new_comment', ({ taskId, comment }) => {
      setTaskDetails((prev: any) => {
        if (prev && prev.id === taskId) {
          return { ...prev, comments: [...prev.comments, comment] };
        }
        return prev;
      });
    });

    setSocket(newSocket);

    return () => {
      newSocket.emit('leave_project', projectId);
      newSocket.disconnect();
    };
  }, [projectId, fetchProjectDetails]);

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const sourceCol = project.columns.find((c: any) => c.id === source.droppableId);
    const destCol = project.columns.find((c: any) => c.id === destination.droppableId);
    
    if (!sourceCol || !destCol) return;

    const sourceTasks = Array.from(sourceCol.tasks);
    const destTasks = source.droppableId === destination.droppableId ? sourceTasks : Array.from(destCol.tasks);

    const [movedTask] = sourceTasks.splice(source.index, 1) as any;
    destTasks.splice(destination.index, 0, movedTask);

    let newOrder = 0;
    if (destTasks.length === 1) {
      newOrder = 1000; 
    } else if (destination.index === 0) {
      newOrder = (destTasks[1] as any).order / 2; 
    } else if (destination.index === destTasks.length - 1) {
      newOrder = (destTasks[destTasks.length - 2] as any).order + 1000; 
    } else {
      const prevOrder = (destTasks[destination.index - 1] as any).order;
      const nextOrder = (destTasks[destination.index + 1] as any).order;
      newOrder = (prevOrder + nextOrder) / 2; 
    }

    movedTask.order = newOrder;
    movedTask.columnId = destCol.id;

    const newColumns = project.columns.map((col: any) => {
      if (col.id === source.droppableId) return { ...col, tasks: sourceTasks };
      if (col.id === destination.droppableId) return { ...col, tasks: destTasks };
      return col;
    });

    setProject({ ...project, columns: newColumns });

    try {
      await api.patch(`/projects/${projectId}/tasks/${movedTask.id}`, {
        columnId: destCol.id,
        order: newOrder,
        title: movedTask.title,
        description: movedTask.description
      });
    } catch (error) {
      fetchProjectDetails();
    }
  };

  const handleCreateTask = async (e: React.FormEvent, columnId: string) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    try {
      await api.post(`/projects/${projectId}/tasks`, {
        title: newTaskTitle,
        columnId,
      });
      setNewTaskTitle('');
      setAddingTaskCol(null);
    } catch (error) {
      console.error('Failed to create task');
    }
  };

  // User and Invite functionality
  const openInviteModal = async () => {
    setIsInviteModalOpen(true);
    try {
      const res = await api.get('/auth/users');
      setUsers(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const handleInviteUser = async (userId: string) => {
    try {
      await api.post(`/projects/${projectId}/members`, { userId });
      alert('User invited successfully!');
      setIsInviteModalOpen(false);
      fetchProjectDetails();
    } catch (error) {
      alert('User is already a member or error occurred.');
    }
  };

  // Task Details & Comments functionality
  const openTaskModal = async (task: any) => {
    setSelectedTask(task);
    setTaskDetails(null);
    try {
      const res = await api.get(`/projects/${projectId}/tasks/${task.id}`);
      setTaskDetails(res.data);
    } catch (error) {
      console.error('Failed to fetch task details');
    }
  };

  const handleAssignTask = async (userId: string) => {
    try {
      const res = await api.post(`/projects/${projectId}/tasks/${selectedTask.id}/assign`, { userId });
      setTaskDetails((prev: any) => ({
        ...prev,
        assignees: [...prev.assignees, res.data]
      }));
    } catch (error) {
      console.error(error);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    try {
      await api.post(`/projects/${projectId}/tasks/${selectedTask.id}/comments`, { content: newComment });
      setNewComment('');
    } catch (error) {
      console.error(error);
    }
  };

  if (!isMounted) return null;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!project) return <div>Project not found</div>;

  return (
    <div className="h-full flex flex-col">
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-jakarta">{project.name}</h1>
          <p className="text-sm text-gray-500 mt-1">{project.description}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex -space-x-2">
            {project.members?.map((m: any) => (
              <div key={m.id} className="w-8 h-8 rounded-full bg-indigo-100 border-2 border-white flex items-center justify-center text-xs font-bold text-indigo-700" title={m.user.name}>
                {m.user.name.charAt(0).toUpperCase()}
              </div>
            ))}
          </div>
          <button onClick={openInviteModal} className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-50 shadow-sm">
            <UserPlus className="w-4 h-4" />
            Invite
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto">
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-6 h-full min-h-[60vh] pb-4 items-start">
            {project.columns?.map((column: any) => (
              <div key={column.id} className="w-80 flex-shrink-0 bg-gray-100/80 rounded-xl flex flex-col border border-gray-200 shadow-sm max-h-full">
                <div className="p-4 flex justify-between items-center border-b border-gray-200">
                  <h3 className="font-semibold text-gray-700">{column.name}</h3>
                  <span className="bg-gray-200 text-gray-600 text-xs px-2 py-1 rounded-full font-medium">
                    {column.tasks?.length || 0}
                  </span>
                </div>
                
                <Droppable droppableId={column.id}>
                  {(provided, snapshot) => (
                    <div 
                      {...provided.droppableProps} 
                      ref={provided.innerRef}
                      className={`flex-1 p-3 flex flex-col gap-3 min-h-[150px] overflow-y-auto transition-colors ${snapshot.isDraggingOver ? 'bg-indigo-50/50' : ''}`}
                    >
                      {column.tasks?.map((task: any, index: number) => (
                        <Draggable key={task.id} draggableId={task.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              style={{...provided.draggableProps.style}}
                              onClick={() => openTaskModal(task)}
                              className={`bg-white p-4 rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-shadow group ${snapshot.isDragging ? 'shadow-xl ring-2 ring-indigo-500 ring-opacity-50 rotate-2' : ''}`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <h4 className="font-medium text-gray-900 mb-1 leading-tight">{task.title}</h4>
                                <GripVertical className="w-4 h-4 text-gray-300 opacity-0 group-hover:opacity-100 flex-shrink-0 mt-0.5" />
                              </div>
                              <div className="flex items-center gap-3 mt-3">
                                {task.assignees?.length > 0 && (
                                  <div className="flex -space-x-1">
                                    <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-700">
                                      <User className="w-3 h-3" />
                                    </div>
                                  </div>
                                )}
                                <div className="flex items-center gap-1 text-gray-400 text-xs">
                                  <MessageSquare className="w-3 h-3" />
                                </div>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>

                <div className="p-3 border-t border-gray-200 bg-gray-50 rounded-b-xl">
                  {addingTaskCol === column.id ? (
                    <form onSubmit={(e) => handleCreateTask(e, column.id)} className="space-y-2">
                      <input
                        autoFocus
                        type="text"
                        placeholder="Task title..."
                        className="w-full px-3 py-2 text-sm border border-indigo-500 rounded-lg text-black bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          type="button" 
                          onClick={() => { setAddingTaskCol(null); setNewTaskTitle(''); }}
                          className="text-xs font-medium text-gray-500 hover:text-gray-700 px-2 py-1"
                        >
                          Cancel
                        </button>
                        <button 
                          type="submit" 
                          disabled={!newTaskTitle.trim()}
                          className="bg-indigo-600 text-white text-xs font-medium px-3 py-1.5 rounded hover:bg-indigo-700 disabled:opacity-50"
                        >
                          Add Card
                        </button>
                      </div>
                    </form>
                  ) : (
                    <button 
                      onClick={() => setAddingTaskCol(column.id)}
                      className="flex items-center gap-2 w-full text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-200 font-medium py-2 px-2 rounded-lg transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add a card
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </DragDropContext>
      </div>

      {/* Invite Member Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900 font-jakarta">Invite Members</h3>
              <button onClick={() => setIsInviteModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              {users.length === 0 ? <p className="text-sm text-gray-500">Loading users...</p> : (
                <ul className="space-y-3">
                  {users.filter(u => !project.members.find((m: any) => m.userId === u.id)).map(u => (
                    <li key={u.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-100">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{u.name}</p>
                        <p className="text-xs text-gray-500">{u.email}</p>
                      </div>
                      <button onClick={() => handleInviteUser(u.id)} className="text-xs bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded font-medium hover:bg-indigo-200">
                        Invite
                      </button>
                    </li>
                  ))}
                  {users.filter(u => !project.members.find((m: any) => m.userId === u.id)).length === 0 && (
                    <p className="text-sm text-gray-500">All registered users are already in this project.</p>
                  )}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Task Details Modal */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold text-gray-900 font-jakarta">{selectedTask.title}</h3>
                <p className="text-xs text-gray-500 mt-1">in list <span className="underline">{project.columns.find((c:any) => c.id === selectedTask.columnId)?.name}</span></p>
              </div>
              <button onClick={() => setSelectedTask(null)} className="text-gray-400 hover:text-gray-600 p-1"><X className="w-6 h-6"/></button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 flex gap-8">
              {/* Left Column - Main Details */}
              <div className="flex-1 space-y-6">
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2"><GripVertical className="w-4 h-4"/> Description</h4>
                  <p className="text-sm text-gray-600 bg-gray-50 p-4 rounded-lg border border-gray-100 min-h-[100px]">
                    {selectedTask.description || "No description provided."}
                  </p>
                </div>
                
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2"><MessageSquare className="w-4 h-4"/> Comments</h4>
                  {!taskDetails ? <Loader2 className="w-5 h-5 animate-spin text-indigo-600"/> : (
                    <div className="space-y-4">
                      {taskDetails.comments?.map((c: any) => (
                        <div key={c.id} className="flex gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700 flex-shrink-0">
                            {c.author.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-baseline gap-2">
                              <span className="font-semibold text-sm text-gray-900">{c.author.name}</span>
                              <span className="text-xs text-gray-500">{new Date(c.createdAt).toLocaleString()}</span>
                            </div>
                            <div className="mt-1 bg-white border border-gray-200 text-gray-800 text-sm p-3 rounded-lg shadow-sm rounded-tl-none">
                              {c.content}
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      <div className="flex gap-3 mt-6">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700 flex-shrink-0">
                          {user?.name?.charAt(0).toUpperCase()}
                        </div>
                        <form onSubmit={handleAddComment} className="flex-1">
                          <input 
                            type="text"
                            placeholder="Write a comment..."
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg text-black bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                          />
                          <div className="mt-2 flex justify-end">
                            <button type="submit" disabled={!newComment.trim()} className="bg-indigo-600 text-white text-xs font-medium px-4 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50">Save</button>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Right Column - Sidebar */}
              <div className="w-64 space-y-6">
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Assignees</h4>
                  {!taskDetails ? <Loader2 className="w-4 h-4 animate-spin text-indigo-600"/> : (
                    <div className="space-y-2">
                      {taskDetails.assignees?.map((a: any) => (
                        <div key={a.id} className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg border border-gray-100">
                          <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-700">
                            {a.user.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm font-medium text-gray-800">{a.user.name}</span>
                        </div>
                      ))}
                      {taskDetails.assignees?.length === 0 && <p className="text-sm text-gray-500">No assignees yet</p>}
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Add to task</h4>
                  <div className="space-y-2">
                    <p className="text-xs text-gray-400 mb-1">Click a project member to assign:</p>
                    {project.members?.map((m: any) => (
                      <button 
                        key={m.id} 
                        onClick={() => handleAssignTask(m.userId)}
                        className="w-full flex items-center gap-2 bg-white hover:bg-gray-50 p-2 rounded-lg border border-gray-200 text-left transition-colors"
                      >
                        <User className="w-4 h-4 text-gray-400"/>
                        <span className="text-sm font-medium text-gray-700">{m.user.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
