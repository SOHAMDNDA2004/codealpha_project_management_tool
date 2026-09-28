import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { getIo } from '../utils/socket';
import { z } from 'zod';

const createProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

export const createProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description } = createProjectSchema.parse(req.body);
    const userId = (req as any).user.id;

    const project = await prisma.project.create({
      data: {
        name,
        description,
        members: {
          create: {
            userId,
            role: 'ADMIN',
          },
        },
        columns: {
          create: [
            { name: 'To Do', order: 1 },
            { name: 'In Progress', order: 2 },
            { name: 'Done', order: 3 },
          ]
        }
      },
      include: {
        members: true,
        columns: true
      }
    });

    res.status(201).json(project);
  } catch (error: any) {
    console.error('Project Creation Error:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: 'Invalid data', errors: error.issues });
      return;
    }
    res.status(500).json({ message: error.message || 'Internal server error' });
  }
};

export const getProjects = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;

    const projects = await prisma.project.findMany({
      where: {
        members: {
          some: {
            userId,
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true }
            }
          }
        }
      }
    });

    res.status(200).json(projects);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getProjectDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params as { id: string };
    const userId = (req as any).user.id;

    // Verify user is a member
    const member = await prisma.projectMember.findUnique({
      where: {
        userId_projectId: {
          userId,
          projectId: id,
        },
      },
    });

    if (!member) {
      res.status(403).json({ message: 'Access denied' });
      return;
    }

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        columns: {
          orderBy: { order: 'asc' },
          include: {
            tasks: {
              orderBy: { order: 'asc' },
              include: {
                assignees: {
                  include: {
                    user: { select: { id: true, name: true } }
                  }
                }
              }
            }
          }
        },
        members: {
          include: {
            user: { select: { id: true, name: true, email: true } }
          }
        }
      },
    });

    if (!project) {
      res.status(404).json({ message: 'Project not found' });
      return;
    }

    res.status(200).json(project);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const createTask = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params as { projectId: string };
    const { title, description, columnId } = req.body;
    const userId = (req as any).user.id;

    const member = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
    });
    if (!member) {
      res.status(403).json({ message: 'Access denied' });
      return;
    }

    // Determine the max order in the column to append it
    const lastTask = await prisma.task.findFirst({
      where: { columnId },
      orderBy: { order: 'desc' },
    });
    const order = lastTask ? lastTask.order + 1 : 1;

    const task = await prisma.task.create({
      data: {
        title,
        description,
        projectId,
        columnId,
        order,
      },
    });

    getIo().to(`project:${projectId}`).emit('task_created', task);

    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const updateTask = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId, taskId } = req.params as { projectId: string; taskId: string };
    const { title, description, columnId, order } = req.body;
    const userId = (req as any).user.id;

    const member = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
    });
    if (!member) {
      res.status(403).json({ message: 'Access denied' });
      return;
    }

    const task = await prisma.task.update({
      where: { id: taskId },
      data: {
        title,
        description,
        columnId,
        order,
      },
    });

    getIo().to(`project:${projectId}`).emit('task_updated', task);

    res.status(200).json(task);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getTaskDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId, taskId } = req.params as { projectId: string; taskId: string };
    
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignees: {
          include: { user: { select: { id: true, name: true, email: true } } }
        },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: { author: { select: { id: true, name: true, email: true } } }
        }
      }
    });

    if (!task) {
      res.status(404).json({ message: 'Task not found' });
      return;
    }

    res.status(200).json(task);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const assignTask = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId, taskId } = req.params as { projectId: string; taskId: string };
    const { userId } = req.body;

    const assignee = await prisma.taskAssignee.create({
      data: {
        taskId,
        userId
      },
      include: { user: { select: { id: true, name: true, email: true } } }
    });

    getIo().to(`project:${projectId}`).emit('task_assigned', { taskId, assignee });

    res.status(201).json(assignee);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
};
export const addProjectMember = async (req: Request, res: Response): Promise<void> => { try { const { projectId } = req.params as { projectId: string }; const { userId, role } = req.body; const member = await prisma.projectMember.create({ data: { projectId, userId, role: role || 'MEMBER' }, include: { user: { select: { id: true, name: true, email: true } } } }); res.status(201).json(member); } catch (error) { res.status(500).json({ message: 'Internal server error' }); } };
