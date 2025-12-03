import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const router = new Hono();

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';

// POST /auth/login
router.post('/login', async (c) => {
  try {
    const { username, password } = await c.req.json();

    if (!username || !password) {
      return c.json({ error: 'Username and password are required' }, 400);
    }

    const user = await User.findOne({ username });
    if (!user) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    const token = jwt.sign(
      {
        userId: user._id.toString(),
        username: user.username,
        name: user.name,
        role: user.role,
        assignedBusId: user.assignedBusId,
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return c.json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        role: user.role,
        assignedBusId: user.assignedBusId,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// POST /auth/verify
router.post('/verify', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ valid: false, error: 'No token provided' }, 401);
    }

    const token = authHeader.substring(7);
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      return c.json({
        valid: true,
        user: {
          userId: decoded.userId,
          username: decoded.username,
          name: decoded.name,
          role: decoded.role,
          assignedBusId: decoded.assignedBusId,
        },
      });
    } catch (err) {
      return c.json({ valid: false, error: 'Invalid token' }, 401);
    }
  } catch (error) {
    console.error('Verify error:', error);
    return c.json({ valid: false, error: 'Internal server error' }, 500);
  }
});

// GET /auth/users - Get all users (for admin)
router.get('/users', async (c) => {
  try {
    const users = await User.find({}, { passwordHash: 0 });
    return c.json({ users });
  } catch (error) {
    console.error('Get users error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// PUT /auth/users/:id/assign-bus - Assign bus to student
router.put('/users/:id/assign-bus', async (c) => {
  try {
    const { id } = c.req.param();
    const { busId } = await c.req.json();

    const user = await User.findByIdAndUpdate(
      id,
      { assignedBusId: busId },
      { new: true }
    );

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        role: user.role,
        assignedBusId: user.assignedBusId,
      },
    });
  } catch (error) {
    console.error('Assign bus error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default router;
