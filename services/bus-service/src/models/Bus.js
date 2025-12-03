import mongoose from 'mongoose';

const busSchema = new mongoose.Schema({
  busNo: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  trackerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tracker',
    default: null,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

const Bus = mongoose.model('Bus', busSchema);

export default Bus;
