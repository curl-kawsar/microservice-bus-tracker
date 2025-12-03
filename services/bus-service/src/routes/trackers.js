import { Hono } from 'hono';
import Tracker from '../models/Tracker.js';

const router = new Hono();

// GET /trackers/by-device/:deviceId - Get tracker and bus info by device ID
router.get('/by-device/:deviceId', async (c) => {
  try {
    const { deviceId } = c.req.param();
    
    const tracker = await Tracker.findOne({ deviceId }).populate('busId');

    if (!tracker) {
      return c.json({ error: 'Tracker not found' }, 404);
    }

    return c.json({
      tracker: {
        id: tracker._id,
        deviceId: tracker.deviceId,
        busId: tracker.busId?._id,
        busNo: tracker.busId?.busNo,
      },
    });
  } catch (error) {
    console.error('Get tracker by device ID error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /trackers/by-bus/:busId - Get tracker by bus ID
router.get('/by-bus/:busId', async (c) => {
  try {
    const { busId } = c.req.param();
    
    const tracker = await Tracker.findOne({ busId }).populate('busId');

    if (!tracker) {
      return c.json({ error: 'Tracker not found' }, 404);
    }

    return c.json({
      tracker: {
        id: tracker._id,
        deviceId: tracker.deviceId,
        busId: tracker.busId?._id,
        busNo: tracker.busId?.busNo,
      },
    });
  } catch (error) {
    console.error('Get tracker by bus ID error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /trackers - Get all trackers
router.get('/', async (c) => {
  try {
    const trackers = await Tracker.find().populate('busId');
    
    const result = trackers.map((tracker) => ({
      id: tracker._id,
      deviceId: tracker.deviceId,
      busId: tracker.busId?._id,
      busNo: tracker.busId?.busNo,
    }));

    return c.json({ trackers: result });
  } catch (error) {
    console.error('Get trackers error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default router;
