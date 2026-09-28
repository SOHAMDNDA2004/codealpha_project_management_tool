import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { getIo } from '../utils/socket';
import { z } from 'zod';

const commentSchema = z.object({
  content: z.string().min(1),
});

export const addComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId, taskId } = req.params as { projectId: string; taskId: string };
    const { content } = commentSchema.parse(req.body);
    const userId = (req as any).user.id;

    const member = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
    });
    if (!member) {
      res.status(403).json({ message: 'Access denied' });
      return;
    }

    const comment = await prisma.comment.create({
      data: {
        content,
        taskId,
        authorId: userId,
      },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } }
      }
    });

    getIo().to(`project:${projectId}`).emit('new_comment', { taskId, comment });

    res.status(201).json(comment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: 'Invalid data', errors: error.issues });
      return;
    }
    res.status(500).json({ message: 'Internal server error' });
  }
};
