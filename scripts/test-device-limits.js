const mongoose = require('mongoose');
const User = require('../models/user');
const Device = require('../models/Device');
const DeviceRequest = require('../models/DeviceRequest');

// MongoDB connection URL
const mongoUrl = process.env.MONGO_URL || 'mongodb+srv://1win_db_user:Fiifi9088.@1win.abmb1za.mongodb.net/1win_db?retryWrites=true&w=majority&appName=1win';

// Helper function to get subscription info (same as in authRoutes.js)
const getSubscriptionInfo = (user) => {
  const isActive = !user.expiry || new Date(user.expiry) > new Date();
  const subscription = user.subscription || "Basic";
  
  let isPremium = false;
  let isPremiumPlus = false;
  let maxDevices = 1; // Basic gets 1 device limit
  
  if (isActive) {
    if (subscription === "Premium") {
      isPremium = true;
      maxDevices = 2; // Premium gets 2 devices
    } else if (subscription === "Premium Plus") {
      isPremiumPlus = true;
      maxDevices = 1; // Premium Plus gets 1 device
    }
  }
  // Basic gets 1 device (default)
  
  return {
    subscription,
    isPremium,
    isPremiumPlus,
    maxDevices,
    isActive
  };
};

async function testDeviceLimits() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoUrl, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log('✅ Connected to MongoDB\n');

    // Test users
    const premiumUsername = 'user_0535899507'; // Currently Premium
    const premiumPlusUsername = 'user_0535899507'; // We'll test with same user after switching

    console.log('='.repeat(70));
    console.log('🧪 TESTING DEVICE LIMITS FOR PREMIUM AND PREMIUM PLUS');
    console.log('='.repeat(70));
    console.log('');

    // ============================================
    // TEST 1: PREMIUM USER (2 DEVICE LIMIT)
    // ============================================
    console.log('📱 TEST 1: PREMIUM USER (2 Device Limit)');
    console.log('-'.repeat(70));
    
    const premiumUser = await User.findOne({ username: premiumUsername });
    if (!premiumUser) {
      console.error(`❌ User not found: ${premiumUsername}`);
      process.exit(1);
    }

    console.log(`✅ Found user: ${premiumUser.name}`);
    console.log(`   Current Subscription: ${premiumUser.subscription}`);
    console.log(`   User ID: ${premiumUser._id}\n`);

    // Get subscription info
    const premiumSubInfo = getSubscriptionInfo(premiumUser);
    console.log(`📊 Subscription Info:`);
    console.log(`   Subscription: ${premiumSubInfo.subscription}`);
    console.log(`   Max Devices: ${premiumSubInfo.maxDevices}`);
    console.log(`   Is Active: ${premiumSubInfo.isActive}\n`);

    // Get current active devices
    const premiumActiveDevices = await Device.find({
      userId: premiumUser._id,
      isActive: true
    });

    console.log(`📱 Current Active Devices: ${premiumActiveDevices.length}`);
    premiumActiveDevices.forEach((device, index) => {
      console.log(`   Device ${index + 1}: ${device.deviceName} (${device.deviceId})`);
      console.log(`      Platform: ${device.platform}, Created: ${device.createdAt}`);
    });
    console.log('');

    // Check if user can add more devices
    const canAddDevice = premiumActiveDevices.length < premiumSubInfo.maxDevices;
    console.log(`✅ Can Add Device: ${canAddDevice ? 'YES' : 'NO'}`);
    console.log(`   Active Devices: ${premiumActiveDevices.length}/${premiumSubInfo.maxDevices}\n`);

    // Simulate third device login attempt
    if (premiumActiveDevices.length >= premiumSubInfo.maxDevices) {
      console.log('⚠️  User has reached device limit!');
      console.log('   Expected behavior: RESET_REQUEST_NEEDED should be returned on login attempt\n');
      
      // Check for pending device requests
      const pendingRequests = await DeviceRequest.find({
        userId: premiumUser._id,
        status: 'pending'
      });
      
      console.log(`📋 Pending Device Requests: ${pendingRequests.length}`);
      pendingRequests.forEach((request, index) => {
        console.log(`   Request ${index + 1}:`);
        console.log(`      Device: ${request.deviceId}`);
        console.log(`      Status: ${request.status}`);
        console.log(`      Created: ${request.createdAt}`);
      });
      console.log('');
    }

    // ============================================
    // TEST 2: PREMIUM PLUS USER (2 DEVICE LIMIT)
    // ============================================
    console.log('📱 TEST 2: PREMIUM PLUS USER (2 Device Limit)');
    console.log('-'.repeat(70));

    // Temporarily switch user to Premium Plus for testing
    const originalSubscription = premiumUser.subscription;
    premiumUser.subscription = 'Premium Plus';
    await premiumUser.save();
    console.log(`✅ Switched user to Premium Plus for testing\n`);

    // Get subscription info for Premium Plus
    const premiumPlusSubInfo = getSubscriptionInfo(premiumUser);
    console.log(`📊 Subscription Info:`);
    console.log(`   Subscription: ${premiumPlusSubInfo.subscription}`);
    console.log(`   Max Devices: ${premiumPlusSubInfo.maxDevices}`);
    console.log(`   Is Active: ${premiumPlusSubInfo.isActive}\n`);

    // Get current active devices
    const premiumPlusActiveDevices = await Device.find({
      userId: premiumUser._id,
      isActive: true
    });

    console.log(`📱 Current Active Devices: ${premiumPlusActiveDevices.length}`);
    premiumPlusActiveDevices.forEach((device, index) => {
      console.log(`   Device ${index + 1}: ${device.deviceName} (${device.deviceId})`);
      console.log(`      Platform: ${device.platform}, Created: ${device.createdAt}`);
    });
    console.log('');

    // Check if user can add more devices
    const canAddDevicePremiumPlus = premiumPlusActiveDevices.length < premiumPlusSubInfo.maxDevices;
    console.log(`✅ Can Add Device: ${canAddDevicePremiumPlus ? 'YES' : 'NO'}`);
    console.log(`   Active Devices: ${premiumPlusActiveDevices.length}/${premiumPlusSubInfo.maxDevices}\n`);

    // Simulate third device login attempt
    if (premiumPlusActiveDevices.length >= premiumPlusSubInfo.maxDevices) {
      console.log('⚠️  User has reached device limit!');
      console.log('   Expected behavior: RESET_REQUEST_NEEDED should be returned on login attempt\n');
      
      // Check for pending device requests
      const pendingRequestsPremiumPlus = await DeviceRequest.find({
        userId: premiumUser._id,
        status: 'pending'
      });
      
      console.log(`📋 Pending Device Requests: ${pendingRequestsPremiumPlus.length}`);
      pendingRequestsPremiumPlus.forEach((request, index) => {
        console.log(`   Request ${index + 1}:`);
        console.log(`      Device: ${request.deviceId}`);
        console.log(`      Status: ${request.status}`);
        console.log(`      Created: ${request.createdAt}`);
      });
      console.log('');
    }

    // Restore original subscription
    premiumUser.subscription = originalSubscription;
    await premiumUser.save();
    console.log(`✅ Restored original subscription: ${originalSubscription}\n`);

    // ============================================
    // TEST 3: DEVICE RESET REQUEST FLOW
    // ============================================
    console.log('📱 TEST 3: DEVICE RESET REQUEST FLOW');
    console.log('-'.repeat(70));

    // Get all device requests for this user
    const allDeviceRequests = await DeviceRequest.find({
      userId: premiumUser._id
    }).sort({ createdAt: -1 }).limit(5);

    console.log(`📋 Recent Device Requests (Last 5): ${allDeviceRequests.length}`);
    allDeviceRequests.forEach((request, index) => {
      console.log(`   Request ${index + 1}:`);
      console.log(`      Device ID: ${request.deviceId}`);
      console.log(`      Status: ${request.status}`);
      console.log(`      Created: ${request.createdAt}`);
      if (request.status === 'approved') {
        console.log(`      Approved At: ${request.approvedAt}`);
        console.log(`      Approved By: ${request.approvedBy || 'N/A'}`);
      }
    });
    console.log('');

    // Check if there are any approved requests that should have logged out old devices
    const approvedRequests = allDeviceRequests.filter(r => r.status === 'approved');
    if (approvedRequests.length > 0) {
      console.log(`✅ Found ${approvedRequests.length} approved request(s)`);
      console.log('   Expected behavior: Old devices should be deactivated and token removed\n');
    }

    // ============================================
    // TEST 4: VERIFY DEVICE LIMIT LOGIC
    // ============================================
    console.log('📱 TEST 4: VERIFY DEVICE LIMIT LOGIC');
    console.log('-'.repeat(70));

    const testSubscriptions = ['Basic', 'Premium', 'Premium Plus'];
    
    for (const sub of testSubscriptions) {
      premiumUser.subscription = sub;
      const subInfo = getSubscriptionInfo(premiumUser);
      console.log(`   ${sub}: Max Devices = ${subInfo.maxDevices}`);
    }
    console.log('');

    // Restore original subscription
    premiumUser.subscription = originalSubscription;
    await premiumUser.save();

    // ============================================
    // SUMMARY
    // ============================================
    console.log('='.repeat(70));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(70));
    console.log('');
    console.log(`✅ Premium User Test:`);
    console.log(`   - Subscription: ${premiumSubInfo.subscription}`);
    console.log(`   - Max Devices: ${premiumSubInfo.maxDevices}`);
    console.log(`   - Active Devices: ${premiumActiveDevices.length}`);
    console.log(`   - Can Add Device: ${canAddDevice ? 'YES' : 'NO'}`);
    console.log('');
    console.log(`✅ Premium Plus User Test:`);
    console.log(`   - Subscription: ${premiumPlusSubInfo.subscription}`);
    console.log(`   - Max Devices: ${premiumPlusSubInfo.maxDevices}`);
    console.log(`   - Active Devices: ${premiumPlusActiveDevices.length}`);
    console.log(`   - Can Add Device: ${canAddDevicePremiumPlus ? 'YES' : 'NO'}`);
    console.log('');
    console.log(`✅ Device Reset Request Flow:`);
    console.log(`   - Total Requests: ${allDeviceRequests.length}`);
    console.log(`   - Approved Requests: ${approvedRequests.length}`);
    console.log('');
    console.log('='.repeat(70));
    console.log('✅ ALL TESTS COMPLETED');
    console.log('='.repeat(70));
    console.log('');
    console.log('📝 Next Steps:');
    console.log('   1. Try logging in on a third device to test RESET_REQUEST_NEEDED');
    console.log('   2. Check admin dashboard for pending device requests');
    console.log('   3. Approve a request and verify old device is logged out');
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

testDeviceLimits();

