import amqp from 'amqplib';
import mongoose from 'mongoose';
import DailyBusStats from './models/DailyBusStats.js';
import { haversineDistance } from './utils/haversine.js';

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
const MONGO_URI = process.env.ANALYTICS_MONGO_URI || 'mongodb://localhost:27017/analytics_db';
const QUEUE_NAME = 'bus_position_events';

// Cache for last positions to calculate distance
const lastPositions = new Map();

// Fuel consumption rate: liters per km (average for a bus)
const FUEL_CONSUMPTION_RATE = 0.35; // 35 liters per 100km = 0.35 liters per km

async function connectToMongoDB() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    setTimeout(connectToMongoDB, 5000);
  }
}

async function connectToRabbitMQ() {
  let connection = null;
  let retries = 10;

  while (retries > 0 && !connection) {
    try {
      connection = await amqp.connect(RABBITMQ_URL);
      console.log('Connected to RabbitMQ');
    } catch (err) {
      console.log(`RabbitMQ connection failed, retrying... (${retries} attempts left)`);
      retries--;
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  if (!connection) {
    throw new Error('Failed to connect to RabbitMQ');
  }

  return connection;
}

async function processPositionEvent(event) {
  try {
    const { busId, lat, lng, speedKmh, fuelLevelPercent, timestamp } = event;
    const eventDate = new Date(timestamp);
    const dateStr = eventDate.toISOString().split('T')[0];

    // Get last position for this bus
    const lastPos = lastPositions.get(busId);
    
    let distanceKm = 0;
    let runningTimeMinutes = 0;
    let fuelUsedLiters = 0;

    if (lastPos && lastPos.date === dateStr) {
      // Calculate distance using Haversine formula
      distanceKm = haversineDistance(lastPos.lat, lastPos.lng, lat, lng);

      // Calculate time difference in minutes
      const timeDiff = (eventDate - new Date(lastPos.timestamp)) / 1000 / 60;
      
      // Only count as running time if speed > 0 or if moved
      if (speedKmh > 0 || distanceKm > 0.01) {
        runningTimeMinutes = Math.min(timeDiff, 30); // Cap at 30 minutes per interval
      }

      // Predict fuel usage based on distance
      fuelUsedLiters = distanceKm * FUEL_CONSUMPTION_RATE;
    }

    // Update last position cache
    lastPositions.set(busId, {
      lat,
      lng,
      timestamp,
      date: dateStr,
    });

    // Update or create daily stats
    let stats = await DailyBusStats.findOne({ busId, date: dateStr });

    if (!stats) {
      stats = new DailyBusStats({
        busId,
        date: dateStr,
        totalDistanceKm: 0,
        totalRunningTimeMinutes: 0,
        averageSpeedKmh: 0,
        predictedFuelUsedLiters: 0,
        positionCount: 0,
        maxSpeed: 0,
      });
    }

    // Update stats
    stats.totalDistanceKm += distanceKm;
    stats.totalRunningTimeMinutes += runningTimeMinutes;
    stats.predictedFuelUsedLiters += fuelUsedLiters;
    stats.positionCount += 1;
    stats.maxSpeed = Math.max(stats.maxSpeed || 0, speedKmh || 0);

    // Update fuel levels
    if (fuelLevelPercent !== null && fuelLevelPercent !== undefined) {
      if (stats.minFuelLevel === null || fuelLevelPercent < stats.minFuelLevel) {
        stats.minFuelLevel = fuelLevelPercent;
      }
      if (stats.maxFuelLevel === null || fuelLevelPercent > stats.maxFuelLevel) {
        stats.maxFuelLevel = fuelLevelPercent;
      }
    }

    // Update last position
    stats.lastPosition = {
      lat,
      lng,
      timestamp: eventDate,
    };

    // Recalculate average speed
    if (stats.totalRunningTimeMinutes > 0) {
      stats.averageSpeedKmh = stats.totalDistanceKm / (stats.totalRunningTimeMinutes / 60);
    }

    await stats.save();

    console.log(`Processed event for bus ${busId}: +${distanceKm.toFixed(3)}km, ${runningTimeMinutes.toFixed(1)}min`);
  } catch (error) {
    console.error('Error processing position event:', error);
  }
}

async function startWorker() {
  try {
    // Connect to MongoDB first
    await connectToMongoDB();

    // Connect to RabbitMQ
    const connection = await connectToRabbitMQ();
    const channel = await connection.createChannel();

    // Assert queue exists
    await channel.assertQueue(QUEUE_NAME, { durable: true });

    // Prefetch 1 message at a time
    channel.prefetch(1);

    console.log(`Waiting for messages in ${QUEUE_NAME}...`);

    // Consume messages
    channel.consume(QUEUE_NAME, async (msg) => {
      if (msg !== null) {
        try {
          const event = JSON.parse(msg.content.toString());
          await processPositionEvent(event);
          channel.ack(msg);
        } catch (error) {
          console.error('Error processing message:', error);
          // Reject and don't requeue
          channel.nack(msg, false, false);
        }
      }
    });

    // Handle connection close
    connection.on('close', () => {
      console.log('RabbitMQ connection closed, reconnecting...');
      setTimeout(startWorker, 5000);
    });

    connection.on('error', (err) => {
      console.error('RabbitMQ error:', err);
    });
  } catch (error) {
    console.error('Worker error:', error);
    setTimeout(startWorker, 5000);
  }
}

// Start the worker
startWorker();

console.log('Analytics worker started');
