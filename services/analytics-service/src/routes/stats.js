import { Hono } from 'hono';
import DailyBusStats from '../models/DailyBusStats.js';

const router = new Hono();

// GET /admin/buses/:id/daily-stats - Get daily statistics for a bus
router.get('/:id/daily-stats', async (c) => {
  try {
    const { id } = c.req.param();
    const { from, to } = c.req.query();

    const query = { busId: id };

    if (from || to) {
      query.date = {};
      if (from) {
        query.date.$gte = from;
      }
      if (to) {
        query.date.$lte = to;
      }
    }

    const stats = await DailyBusStats.find(query)
      .sort({ date: -1 })
      .limit(365); // Max 1 year of data

    return c.json({
      busId: id,
      stats: stats.map((s) => ({
        date: s.date,
        totalDistanceKm: Math.round(s.totalDistanceKm * 100) / 100,
        totalRunningTimeMinutes: Math.round(s.totalRunningTimeMinutes),
        averageSpeedKmh: Math.round(s.averageSpeedKmh * 10) / 10,
        predictedFuelUsedLiters: Math.round(s.predictedFuelUsedLiters * 100) / 100,
        positionCount: s.positionCount,
        maxSpeed: s.maxSpeed,
        minFuelLevel: s.minFuelLevel,
        maxFuelLevel: s.maxFuelLevel,
      })),
    });
  } catch (error) {
    console.error('Get daily stats error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /admin/buses/:id/summary - Get summary statistics
router.get('/:id/summary', async (c) => {
  try {
    const { id } = c.req.param();
    const { days = 7 } = c.req.query();

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    const startDateStr = startDate.toISOString().split('T')[0];

    const stats = await DailyBusStats.find({
      busId: id,
      date: { $gte: startDateStr },
    });

    if (stats.length === 0) {
      return c.json({
        busId: id,
        period: `Last ${days} days`,
        summary: null,
      });
    }

    const summary = {
      totalDistanceKm: 0,
      totalRunningTimeMinutes: 0,
      totalFuelUsedLiters: 0,
      averageSpeedKmh: 0,
      maxSpeed: 0,
      daysActive: stats.length,
    };

    for (const s of stats) {
      summary.totalDistanceKm += s.totalDistanceKm;
      summary.totalRunningTimeMinutes += s.totalRunningTimeMinutes;
      summary.totalFuelUsedLiters += s.predictedFuelUsedLiters;
      summary.maxSpeed = Math.max(summary.maxSpeed, s.maxSpeed || 0);
    }

    // Calculate average speed
    if (summary.totalRunningTimeMinutes > 0) {
      summary.averageSpeedKmh = (summary.totalDistanceKm / (summary.totalRunningTimeMinutes / 60));
    }

    return c.json({
      busId: id,
      period: `Last ${days} days`,
      summary: {
        totalDistanceKm: Math.round(summary.totalDistanceKm * 100) / 100,
        totalRunningTimeHours: Math.round(summary.totalRunningTimeMinutes / 60 * 10) / 10,
        totalFuelUsedLiters: Math.round(summary.totalFuelUsedLiters * 100) / 100,
        averageSpeedKmh: Math.round(summary.averageSpeedKmh * 10) / 10,
        maxSpeed: summary.maxSpeed,
        daysActive: summary.daysActive,
      },
    });
  } catch (error) {
    console.error('Get summary error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Internal endpoint for worker to update stats
router.post('/:id/update-stats', async (c) => {
  try {
    const { id } = c.req.param();
    const data = await c.req.json();

    const {
      date,
      distanceKm,
      runningTimeMinutes,
      speedKmh,
      fuelUsedLiters,
      position,
    } = data;

    // Find or create stats for this day
    let stats = await DailyBusStats.findOne({ busId: id, date });

    if (!stats) {
      stats = new DailyBusStats({
        busId: id,
        date,
        totalDistanceKm: 0,
        totalRunningTimeMinutes: 0,
        averageSpeedKmh: 0,
        predictedFuelUsedLiters: 0,
        positionCount: 0,
      });
    }

    // Update stats
    stats.totalDistanceKm += distanceKm || 0;
    stats.totalRunningTimeMinutes += runningTimeMinutes || 0;
    stats.predictedFuelUsedLiters += fuelUsedLiters || 0;
    stats.positionCount += 1;

    if (speedKmh) {
      stats.maxSpeed = Math.max(stats.maxSpeed || 0, speedKmh);
      // Recalculate average speed
      if (stats.totalRunningTimeMinutes > 0) {
        stats.averageSpeedKmh = stats.totalDistanceKm / (stats.totalRunningTimeMinutes / 60);
      }
    }

    if (position) {
      stats.lastPosition = position;
    }

    await stats.save();

    return c.json({ success: true });
  } catch (error) {
    console.error('Update stats error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default router;
