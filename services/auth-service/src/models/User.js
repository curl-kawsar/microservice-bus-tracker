import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  role: {
    type: String,
    enum: ['ADMIN', 'STUDENT'],
    required: true,
  },
  passwordHash: {
    type: String,
    required: true,
  },
  assignedBusId: {
    type: String,
    default: null,
  },
}, {
  timestamps: true,
});

// Index for faster queries
userSchema.index({ role: 1 });
userSchema.index({ assignedBusId: 1 });

const User = mongoose.model('User', userSchema);

export default User;
