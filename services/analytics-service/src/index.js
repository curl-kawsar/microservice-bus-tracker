import { Hono } from 'hono';
import { cors } from 'hono/cors';
import mongoose from 'mongoose';
import statsRoutes from './routes/stats.js';

const app = new Hono();

// Middleware
app.use('*', cors());

// Health check
app.get('/health', (c) => c.json({ status: 'ok', service: 'analytics-service' }));

// Routes
app.route('/admin/buses', statsRoutes);

// Connect to MongoDB
const MONGO_URI = process.env.ANALYTICS_MONGO_URI || 'mongodb://localhost:27017/analytics_db';

mongoose.connect(MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

const port = 4004;
console.log(`Analytics service running on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
