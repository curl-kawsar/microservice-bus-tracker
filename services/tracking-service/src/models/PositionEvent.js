import mongoose from 'mongoose';

const positionEventSchema = new mongoose.Schema({
  busId: {
    type: String,
    required: true,
    index: true,
  },
  trackerId: {
    type: String,
    required: true,
  },
  lat: {
    type: Number,
    required: true,
  },
  lng: {
    type: Number,
    required: true,
  },
  speedKmh: {
    type: Number,
    default: 0,
  },
  fuelLevelPercent: {
    type: Number,
    default: null,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

// Compound index for efficient queries
positionEventSchema.index({ busId: 1, timestamp: -1 });

const PositionEvent = mongoose.model('PositionEvent', positionEventSchema);

export default PositionEvent;
