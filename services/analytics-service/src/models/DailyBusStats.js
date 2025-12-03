import mongoose from 'mongoose';

const dailyBusStatsSchema = new mongoose.Schema({
  busId: {
    type: String,
    required: true,
    index: true,
  },
  date: {
    type: String, // Format: YYYY-MM-DD
    required: true,
  },
  totalDistanceKm: {
    type: Number,
    default: 0,
  },
  totalRunningTimeMinutes: {
    type: Number,
    default: 0,
  },
  averageSpeedKmh: {
    type: Number,
    default: 0,
  },
  predictedFuelUsedLiters: {
    type: Number,
    default: 0,
  },
  positionCount: {
    type: Number,
    default: 0,
  },
  lastPosition: {
    lat: Number,
    lng: Number,
    timestamp: Date,
  },
  maxSpeed: {
    type: Number,
    default: 0,
  },
  minFuelLevel: {
    type: Number,
    default: null,
  },
  maxFuelLevel: {
    type: Number,
    default: null,
  },
}, {
  timestamps: true,
});

// Compound unique index for busId and date
dailyBusStatsSchema.index({ busId: 1, date: 1 }, { unique: true });

const DailyBusStats = mongoose.model('DailyBusStats', dailyBusStatsSchema);

export default DailyBusStats;
