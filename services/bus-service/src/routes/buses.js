import { Hono } from 'hono';
import Bus from '../models/Bus.js';
import Tracker from '../models/Tracker.js';

const router = new Hono();

// POST /admin/buses - Create a new bus with tracker
router.post('/', async (c) => {
  try {
    const { busNo, deviceId } = await c.req.json();

    if (!busNo) {
      return c.json({ error: 'Bus number is required' }, 400);
    }

    if (!deviceId) {
      return c.json({ error: 'Device ID is required' }, 400);
    }

    // Check if bus number already exists
    const existingBus = await Bus.findOne({ busNo });
    if (existingBus) {
      return c.json({ error: 'Bus number already exists' }, 400);
    }

    // Check if device ID already exists
    const existingTracker = await Tracker.findOne({ deviceId });
    if (existingTracker) {
      return c.json({ error: 'Device ID already in use' }, 400);
    }

    // Create the bus first
    const bus = new Bus({
      busNo,
      isActive: true,
    });
    await bus.save();

    // Create the tracker linked to the bus
    const tracker = new Tracker({
      deviceId,
      busId: bus._id,
    });
    await tracker.save();

    // Update bus with tracker reference
    bus.trackerId = tracker._id;
    await bus.save();

    return c.json({
      success: true,
      bus: {
        id: bus._id,
        busNo: bus.busNo,
        trackerId: tracker._id,
        deviceId: tracker.deviceId,
        isActive: bus.isActive,
        createdAt: bus.createdAt,
      },
    }, 201);
  } catch (error) {
    console.error('Create bus error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /admin/buses - Get all buses
router.get('/', async (c) => {
  try {
    const buses = await Bus.find().populate('trackerId');
    
    const result = buses.map((bus) => ({
      id: bus._id,
      busNo: bus.busNo,
      trackerId: bus.trackerId?._id,
      deviceId: bus.trackerId?.deviceId,
      isActive: bus.isActive,
      createdAt: bus.createdAt,
      updatedAt: bus.updatedAt,
    }));

    return c.json({ buses: result });
  } catch (error) {
    console.error('Get buses error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /admin/buses/:id - Get a single bus
router.get('/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const bus = await Bus.findById(id).populate('trackerId');

    if (!bus) {
      return c.json({ error: 'Bus not found' }, 404);
    }

    return c.json({
      bus: {
        id: bus._id,
        busNo: bus.busNo,
        trackerId: bus.trackerId?._id,
        deviceId: bus.trackerId?.deviceId,
        isActive: bus.isActive,
        createdAt: bus.createdAt,
        updatedAt: bus.updatedAt,
      },
    });
  } catch (error) {
    console.error('Get bus error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// PUT /admin/buses/:id - Update a bus
router.put('/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const { busNo, isActive } = await c.req.json();

    const bus = await Bus.findById(id);
    if (!bus) {
      return c.json({ error: 'Bus not found' }, 404);
    }

    if (busNo !== undefined) {
      // Check if new bus number conflicts with another bus
      const existingBus = await Bus.findOne({ busNo, _id: { $ne: id } });
      if (existingBus) {
        return c.json({ error: 'Bus number already exists' }, 400);
      }
      bus.busNo = busNo;
    }

    if (isActive !== undefined) {
      bus.isActive = isActive;
    }

    await bus.save();

    return c.json({
      success: true,
      bus: {
        id: bus._id,
        busNo: bus.busNo,
        isActive: bus.isActive,
      },
    });
  } catch (error) {
    console.error('Update bus error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// DELETE /admin/buses/:id - Delete a bus
router.delete('/:id', async (c) => {
  try {
    const { id } = c.req.param();
    
    const bus = await Bus.findById(id);
    if (!bus) {
      return c.json({ error: 'Bus not found' }, 404);
    }

    // Delete associated tracker
    if (bus.trackerId) {
      await Tracker.findByIdAndDelete(bus.trackerId);
    }

    await Bus.findByIdAndDelete(id);

    return c.json({ success: true, message: 'Bus deleted' });
  } catch (error) {
    console.error('Delete bus error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default router;
