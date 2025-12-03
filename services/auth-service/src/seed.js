import bcrypt from 'bcryptjs';
import User from './models/User.js';

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const ADMIN_NAME = process.env.ADMIN_NAME || 'System Administrator';

export async function seedAdmin() {
  try {
    // Check if admin already exists
    const existingAdmin = await User.findOne({ username: ADMIN_USERNAME });
    
    if (existingAdmin) {
      console.log('Admin user already exists');
      return;
    }

    // Create admin user
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    
    const admin = new User({
      username: ADMIN_USERNAME,
      name: ADMIN_NAME,
      role: 'ADMIN',
      passwordHash,
    });

    await admin.save();
    console.log('Admin user created successfully');
    console.log(`  Username: ${ADMIN_USERNAME}`);
    console.log(`  Password: ${ADMIN_PASSWORD}`);
  } catch (error) {
    console.error('Error seeding admin:', error);
  }
}

// Run directly if called as script
if (import.meta.main) {
  import('mongoose').then(async (mongoose) => {
    const MONGO_URI = process.env.AUTH_MONGO_URI || 'mongodb://localhost:27017/auth_db';
    await mongoose.default.connect(MONGO_URI);
    await seedAdmin();
    process.exit(0);
  });
}
