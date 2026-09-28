import { Router } from 'express';
import { createProject, getProjects, getProjectDetails, createTask, updateTask, getTaskDetails, assignTask, addProjectMember } from '../controllers/project.controller';
import { addComment } from '../controllers/comment.controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Protect all project routes
router.use(authMiddleware);

router.post('/', createProject);
router.get('/', getProjects);
router.get('/:id', getProjectDetails);
router.post('/:projectId/members', addProjectMember);

// Tasks
router.post('/:projectId/tasks', createTask);
router.get('/:projectId/tasks/:taskId', getTaskDetails);
router.patch('/:projectId/tasks/:taskId', updateTask);
router.post('/:projectId/tasks/:taskId/assign', assignTask);

// Comments
router.post('/:projectId/tasks/:taskId/comments', addComment);

export default router;
