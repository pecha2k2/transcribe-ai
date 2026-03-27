import { Router, Response } from 'express';
import { prisma } from '../index.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const projects = await prisma.project.findMany({
      where: {
        members: { some: { userId: req.userId } }
      },
      include: {
        members: {
          include: { user: { select: { id: true, email: true, name: true } } }
        },
        _count: { select: { jobs: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(projects);
  } catch (error) {
    console.error('List projects error:', error);
    res.status(500).json({ error: 'Failed to list projects' });
  }
});

router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { name, description } = req.body;

    const project = await prisma.project.create({
      data: {
        name,
        description,
        members: {
          create: { 
            userId: req.userId!, 
            role: 'OWNER' 
          }
        }
      },
      include: {
        members: {
          include: { user: { select: { id: true, email: true, name: true } } }
        },
        _count: { select: { jobs: true } }
      }
    });

    res.json(project);
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const membership = await prisma.projectMember.findFirst({
      where: { projectId: req.params.id, userId: req.userId }
    });

    if (!membership) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: {
        members: {
          include: { user: { select: { id: true, email: true, name: true } } }
        },
        jobs: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: { id: true, fileName: true, status: true, createdAt: true }
        }
      }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ ...project, userRole: membership.role });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get project' });
  }
});

router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const membership = await prisma.projectMember.findFirst({
      where: { projectId: req.params.id, userId: req.userId, role: { in: ['OWNER', 'EDITOR'] } }
    });

    if (!membership) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    const { name, description } = req.body;

    const project = await prisma.project.update({
      where: { id: req.params.id },
      data: { name, description }
    });

    res.json(project);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update project' });
  }
});

router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const membership = await prisma.projectMember.findFirst({
      where: { projectId: req.params.id, userId: req.userId, role: 'OWNER' }
    });

    if (!membership) {
      return res.status(403).json({ error: 'Only owner can delete project' });
    }

    await prisma.project.delete({ where: { id: req.params.id } });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

router.post('/:id/members', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const membership = await prisma.projectMember.findFirst({
      where: { projectId: req.params.id, userId: req.userId, role: { in: ['OWNER', 'EDITOR'] } }
    });

    if (!membership) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    const { email, role = 'VIEWER' } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const existing = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId: user.id, projectId: req.params.id } }
    });

    if (existing) {
      return res.status(400).json({ error: 'User is already a member' });
    }

    const member = await prisma.projectMember.create({
      data: { userId: user.id, projectId: req.params.id, role },
      include: { user: { select: { id: true, email: true, name: true } } }
    });

    res.json(member);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add member' });
  }
});

router.delete('/:id/members/:userId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const membership = await prisma.projectMember.findFirst({
      where: { projectId: req.params.id, userId: req.userId, role: 'OWNER' }
    });

    if (!membership) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    if (req.params.userId === req.userId) {
      return res.status(400).json({ error: 'Cannot remove yourself' });
    }

    await prisma.projectMember.delete({
      where: { userId_projectId: { userId: req.params.userId, projectId: req.params.id } }
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

router.patch('/:id/members/:userId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const membership = await prisma.projectMember.findFirst({
      where: { projectId: req.params.id, userId: req.userId, role: 'OWNER' }
    });

    if (!membership) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    const { role } = req.body;

    const member = await prisma.projectMember.update({
      where: { userId_projectId: { userId: req.params.userId, projectId: req.params.id } },
      data: { role }
    });

    res.json(member);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update member role' });
  }
});

export default router;
