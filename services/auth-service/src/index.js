import { Hono } from 'hono';
import { serve } from 'bun';
import { cors } from 'hono/cors';
import mongoose from 'mongoose';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import { seedAdmin } from './seed.js';

const app = new Hono();

// Middleware
app.use('*', cors());

// Health check
app.get('/health', (c) => c.json({ status: 'ok', service: 'auth-service' }));

// Routes
app.route('/auth', authRoutes);
app.route('/admin', adminRoutes);

// Connect to MongoDB
const MONGO_URI = process.env.AUTH_MONGO_URI || 'mongodb://localhost:27017/auth_db';

mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    await seedAdmin();
  })
  .catch((err) => console.error('MongoDB connection error:', err));

const port = 4001;
console.log(`Auth service running on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
