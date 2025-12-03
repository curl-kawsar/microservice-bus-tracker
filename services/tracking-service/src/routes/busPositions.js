import { Hono } from 'hono';
import PositionEvent from '../models/PositionEvent.js';

const router = new Hono();

const BUS_SERVICE_URL = process.env.BUS_SERVICE_URL || 'http://localhost:4002';
const GPS_API_URL = process.env.GPS_API_URL || 'http://172.104.160.132/proxy/devices';

// Cache for GPS data (refresh every 5 seconds)
let gpsCache = {
  data: [],
  lastFetch: 0,
};

async function fetchGPSData() {
  const now = Date.now();
  // Use cache if less than 5 seconds old
  if (gpsCache.data.length > 0 && now - gpsCache.lastFetch < 5000) {
    return gpsCache.data;
  }

  try {
    const response = await fetch(GPS_API_URL);
    if (!response.ok) {
      console.error('GPS API error:', response.status);
      return gpsCache.data; // Return stale cache on error
    }
    const data = await response.json();
    gpsCache = { data, lastFetch: now };
    return data;
  } catch (error) {
    console.error('Failed to fetch GPS data:', error);
    return gpsCache.data;
  }
}

// GET /buses/:id/current-position - Get current position of a bus
router.get('/:id/current-position', async (c) => {
  try {
    const { id } = c.req.param();

    // First, get the device ID for this bus
    let deviceId;
    try {
      const trackerResponse = await fetch(`${BUS_SERVICE_URL}/trackers/by-bus/${id}`);
      if (!trackerResponse.ok) {
        return c.json({ error: 'Bus tracker not found' }, 404);
      }
      const trackerData = await trackerResponse.json();
      deviceId = trackerData.tracker?.deviceId;
    } catch (err) {
      console.error('Failed to get tracker:', err);
      return c.json({ error: 'Failed to resolve bus tracker' }, 500);
    }

    if (!deviceId) {
      return c.json({ error: 'No device ID configured for this bus' }, 404);
    }

    // Fetch GPS data from external API
    const gpsData = await fetchGPSData();
    const devicePosition = gpsData.find(d => d.device_id === deviceId);

    if (!devicePosition) {
      // Fallback to stored position
      const latestPosition = await PositionEvent.findOne({ busId: id })
        .sort({ timestamp: -1 })
        .limit(1);

      if (!latestPosition) {
        return c.json({ error: 'No position data found for this bus' }, 404);
      }

      return c.json({
        position: {
          busId: id,
          lat: latestPosition.lat,
          lng: latestPosition.lng,
          speedKmh: latestPosition.speedKmh,
          fuelLevelPercent: latestPosition.fuelLevelPercent,
          timestamp: latestPosition.timestamp,
        },
      });
    }

    // Return live position from GPS API
    return c.json({
      position: {
        busId: id,
        deviceId: devicePosition.device_id,
        lat: devicePosition.lat,
        lng: devicePosition.lon,
        speedKmh: 0,
        fuelLevelPercent: null,
        timestamp: devicePosition.last_ts,
      },
    });
  } catch (error) {
    console.error('Get current position error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /buses/:id/today-path - Get today's path for a bus
router.get('/:id/today-path', async (c) => {
  try {
    const { id } = c.req.param();

    // Get start of today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const positions = await PositionEvent.find({
      busId: id,
      timestamp: { $gte: today },
    })
      .sort({ timestamp: 1 })
      .select('lat lng speedKmh fuelLevelPercent timestamp');

    return c.json({
      busId: id,
      date: today.toISOString().split('T')[0],
      positions: positions.map((p) => ({
        lat: p.lat,
        lng: p.lng,
        speedKmh: p.speedKmh,
        fuelLevelPercent: p.fuelLevelPercent,
        timestamp: p.timestamp,
      })),
    });
  } catch (error) {
    console.error('Get today path error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /buses/:id/history - Get position history with date range
router.get('/:id/history', async (c) => {
  try {
    const { id } = c.req.param();
    const { from, to } = c.req.query();

    const query = { busId: id };

    if (from || to) {
      query.timestamp = {};
      if (from) {
        query.timestamp.$gte = new Date(from);
      }
      if (to) {
        query.timestamp.$lte = new Date(to);
      }
    }

    const positions = await PositionEvent.find(query)
      .sort({ timestamp: 1 })
      .limit(10000) // Limit to prevent huge responses
      .select('lat lng speedKmh fuelLevelPercent timestamp');

    return c.json({
      busId: id,
      count: positions.length,
      positions: positions.map((p) => ({
        lat: p.lat,
        lng: p.lng,
        speedKmh: p.speedKmh,
        fuelLevelPercent: p.fuelLevelPercent,
        timestamp: p.timestamp,
      })),
    });
  } catch (error) {
    console.error('Get history error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default router;
