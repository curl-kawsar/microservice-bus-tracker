import { Hono } from 'hono';
import { cors } from 'hono/cors';
import mongoose from 'mongoose';
import busRoutes from './routes/buses.js';
import trackerRoutes from './routes/trackers.js';

const app = new Hono();

// Middleware
app.use('*', cors());

// Health check
app.get('/health', (c) => c.json({ status: 'ok', service: 'bus-service' }));

// Routes
app.route('/admin/buses', busRoutes);
app.route('/trackers', trackerRoutes);

// Connect to MongoDB
const MONGO_URI = process.env.BUS_MONGO_URI || 'mongodb://localhost:27017/bus_db';

mongoose.connect(MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

const port = 4002;
console.log(`Bus service running on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
