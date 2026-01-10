const mongoose = require('mongoose');
const User = require('../models/user');
const Device = require('../models/Device');

// MongoDB connection URL
const mongoUrl = process.env.MONGO_URL || 'mongodb+srv://1win_db_user:Fiifi9088.@1win.abmb1za.mongodb.net/1win_db?retryWrites=true&w=majority&appName=1win';

async function cleanupTestDevices() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoUrl, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log('✅ Connected to MongoDB\n');

    const username = 'user_0535899507';
    const user = await User.findOne({ username: username });
    
    if (!user) {
      console.error(`❌ User not found: ${username}`);
      process.exit(1);
    }

    console.log(`✅ Found user: ${user.name}`);
    console.log(`   User ID: ${user._id}\n`);

    // Get all active devices
    const activeDevices = await Device.find({
      userId: user._id,
      isActive: true
    });

    console.log(`📱 Found ${activeDevices.length} active device(s):\n`);
    activeDevices.forEach((device, index) => {
      console.log(`   Device ${index + 1}:`);
      console.log(`      Name: ${device.deviceName}`);
      console.log(`      Device ID: ${device.deviceId}`);
      console.log(`      Platform: ${device.platform}`);
      console.log(`      Created: ${device.createdAt}`);
      console.log(`      Last Login: ${device.lastLoginAt || 'N/A'}`);
      console.log('');
    });

    // Deactivate ALL devices for testing (we'll test fresh login flow)
    if (activeDevices.length > 0) {
      console.log(`⚠️  User has ${activeDevices.length} active device(s)`);
      console.log('   Deactivating ALL devices for fresh test...\n');
      
      for (const device of activeDevices) {
        device.isActive = false;
        await device.save();
        console.log(`   ✅ Deactivated: ${device.deviceName} (${device.deviceId})`);
      }
      console.log('');

      // Verify
      const remainingActiveDevices = await Device.find({
        userId: user._id,
        isActive: true
      });

      console.log(`✅ Cleanup complete!`);
      console.log(`   Active devices remaining: ${remainingActiveDevices.length}`);
      console.log('   Ready for fresh device login test!');
    } else {
      console.log('✅ User has no active devices (ready for testing)');
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ CLEANUP COMPLETE');
    console.log('='.repeat(70));
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed');
    process.exit(0);
  }
}

cleanupTestDevices();

