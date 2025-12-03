import { Hono } from 'hono';
import PositionEvent from '../models/PositionEvent.js';
import { publishPositionEvent } from '../lib/rabbitmq.js';

const router = new Hono();

const BUS_SERVICE_URL = process.env.BUS_SERVICE_URL || 'http://localhost:4002';

// POST /tracking/ingest - Ingest GPS data from tracker
router.post('/ingest', async (c) => {
  try {
    const { trackerIp, lat, lng, speedKmh, fuelLevelPercent } = await c.req.json();

    if (!trackerIp || lat === undefined || lng === undefined) {
      return c.json({ error: 'trackerIp, lat, and lng are required' }, 400);
    }

    // Resolve tracker by IP using bus-service
    let trackerInfo;
    try {
      const response = await fetch(`${BUS_SERVICE_URL}/trackers/by-ip/${encodeURIComponent(trackerIp)}`);
      if (!response.ok) {
        return c.json({ error: 'Tracker not found' }, 404);
      }
      const data = await response.json();
      trackerInfo = data.tracker;
    } catch (err) {
      console.error('Failed to resolve tracker:', err);
      return c.json({ error: 'Failed to resolve tracker' }, 500);
    }

    if (!trackerInfo || !trackerInfo.busId) {
      return c.json({ error: 'Tracker not associated with any bus' }, 400);
    }

    // Create position event
    const positionEvent = new PositionEvent({
      busId: trackerInfo.busId.toString(),
      trackerId: trackerInfo.id.toString(),
      lat,
      lng,
      speedKmh: speedKmh || 0,
      fuelLevelPercent: fuelLevelPercent || null,
      timestamp: new Date(),
    });

    await positionEvent.save();

    // Publish to RabbitMQ
    await publishPositionEvent({
      busId: positionEvent.busId,
      trackerId: positionEvent.trackerId,
      lat: positionEvent.lat,
      lng: positionEvent.lng,
      speedKmh: positionEvent.speedKmh,
      fuelLevelPercent: positionEvent.fuelLevelPercent,
      timestamp: positionEvent.timestamp.toISOString(),
    });

    return c.json({
      success: true,
      message: 'Position ingested',
      position: {
        id: positionEvent._id,
        busId: positionEvent.busId,
        lat: positionEvent.lat,
        lng: positionEvent.lng,
        timestamp: positionEvent.timestamp,
      },
    });
  } catch (error) {
    console.error('Ingest error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// POST /tracking/ingest-batch - Ingest multiple GPS points
router.post('/ingest-batch', async (c) => {
  try {
    const { positions } = await c.req.json();

    if (!Array.isArray(positions) || positions.length === 0) {
      return c.json({ error: 'positions array is required' }, 400);
    }

    const results = [];
    for (const pos of positions) {
      const { trackerIp, lat, lng, speedKmh, fuelLevelPercent } = pos;

      if (!trackerIp || lat === undefined || lng === undefined) {
        results.push({ error: 'Missing required fields', position: pos });
        continue;
      }

      try {
        // Resolve tracker
        const response = await fetch(`${BUS_SERVICE_URL}/trackers/by-ip/${encodeURIComponent(trackerIp)}`);
        if (!response.ok) {
          results.push({ error: 'Tracker not found', trackerIp });
          continue;
        }
        const data = await response.json();
        const trackerInfo = data.tracker;

        // Create and save position
        const positionEvent = new PositionEvent({
          busId: trackerInfo.busId.toString(),
          trackerId: trackerInfo.id.toString(),
          lat,
          lng,
          speedKmh: speedKmh || 0,
          fuelLevelPercent: fuelLevelPercent || null,
          timestamp: new Date(),
        });

        await positionEvent.save();
        await publishPositionEvent({
          busId: positionEvent.busId,
          trackerId: positionEvent.trackerId,
          lat: positionEvent.lat,
          lng: positionEvent.lng,
          speedKmh: positionEvent.speedKmh,
          fuelLevelPercent: positionEvent.fuelLevelPercent,
          timestamp: positionEvent.timestamp.toISOString(),
        });

        results.push({ success: true, busId: positionEvent.busId });
      } catch (err) {
        results.push({ error: err.message, trackerIp });
      }
    }

    return c.json({ results });
  } catch (error) {
    console.error('Batch ingest error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default router;
