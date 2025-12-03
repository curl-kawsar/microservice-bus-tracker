import mongoose from 'mongoose';

const trackerSchema = new mongoose.Schema({
  deviceId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  busId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bus',
    required: true,
  },
}, {
  timestamps: true,
});

// Index for faster lookups by deviceId
trackerSchema.index({ deviceId: 1 });

const Tracker = mongoose.model('Tracker', trackerSchema);

export default Tracker;
