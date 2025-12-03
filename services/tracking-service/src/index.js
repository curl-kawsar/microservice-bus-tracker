import { Hono } from 'hono';
import { cors } from 'hono/cors';
import mongoose from 'mongoose';
import trackingRoutes from './routes/tracking.js';
import busPositionRoutes from './routes/busPositions.js';
import { initRabbitMQ } from './lib/rabbitmq.js';

const app = new Hono();

// Middleware
app.use('*', cors());

// Health check
app.get('/health', (c) => c.json({ status: 'ok', service: 'tracking-service' }));

// Routes
app.route('/tracking', trackingRoutes);
app.route('/buses', busPositionRoutes);

// Connect to MongoDB
const MONGO_URI = process.env.TRACKING_MONGO_URI || 'mongodb://localhost:27017/tracking_db';

mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    // Initialize RabbitMQ connection
    await initRabbitMQ();
  })
  .catch((err) => console.error('MongoDB connection error:', err));

const port = 4003;
console.log(`Tracking service running on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
