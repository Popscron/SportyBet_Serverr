const axios = require('axios');
require('dotenv').config();

// Use Vercel API for testing
const API_BASE_URL = process.env.VERCEL_API_BASE_URL || "https://sporty-bet-serverr.vercel.app/api";

// Test credentials
const TEST_MOBILE = "0535899507";
const TEST_PASSWORD = "daxfixedd";

// Generate unique device IDs for testing
const device1Id = `test-premium-device-1-${Date.now()}`;
const device2Id = `test-premium-device-2-${Date.now()}`;
const device3Id = `test-premium-device-3-${Date.now()}`;

const device1Info = {
  deviceId: device1Id,
  deviceName: "Premium Test Device 1",
  modelName: "Test Model 1",
  deviceType: "mobile",
  platform: "ios",
  osVersion: "17.0",
  appVersion: "1.0.0",
  location: "Test Location 1"
};

const device2Info = {
  deviceId: device2Id,
  deviceName: "Premium Test Device 2",
  modelName: "Test Model 2",
  deviceType: "mobile",
  platform: "android",
  osVersion: "14.0",
  appVersion: "1.0.0",
  location: "Test Location 2"
};

const device3Info = {
  deviceId: device3Id,
  deviceName: "Premium Test Device 3",
  modelName: "Test Model 3",
  deviceType: "mobile",
  platform: "ios",
  osVersion: "17.0",
  appVersion: "1.0.0",
  location: "Test Location 3"
};

async function testDeviceLoginFlow() {
  console.log("🧪 Testing Device Login Flow for Premium/Premium Plus Users\n");
  console.log("=".repeat(70));
  
  let device1Token = null;
  let device2Token = null;
  let device3Response = null;
  
  try {
    // ============================================
    // TEST 1: PREMIUM USER - FIRST DEVICE LOGIN
    // ============================================
    console.log("\n📱 TEST 1: Premium User - First Device Login");
    console.log("-".repeat(70));
    
    const login1Response = await axios.post(`${API_BASE_URL}/login`, {
      identifier: TEST_MOBILE,
      password: TEST_PASSWORD,
      deviceInfo: device1Info
    });
    
    if (login1Response.data.success) {
      device1Token = login1Response.data.token;
      console.log("✅ Device 1 logged in successfully");
      console.log(`   Token: ${device1Token.substring(0, 30)}...`);
      console.log(`   User: ${login1Response.data.user?.name || login1Response.data.user?.email}`);
      console.log(`   Subscription: ${login1Response.data.user?.subscription || 'N/A'}`);
    } else {
      throw new Error(`Device 1 login failed: ${login1Response.data.message}`);
    }
    
    // Wait for database to sync
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // ============================================
    // TEST 2: PREMIUM USER - SECOND DEVICE LOGIN
    // ============================================
    console.log("\n📱 TEST 2: Premium User - Second Device Login");
    console.log("-".repeat(70));
    
    const login2Response = await axios.post(`${API_BASE_URL}/login`, {
      identifier: TEST_MOBILE,
      password: TEST_PASSWORD,
      deviceInfo: device2Info
    });
    
    if (login2Response.data.success) {
      device2Token = login2Response.data.token;
      console.log("✅ Device 2 logged in successfully");
      console.log(`   Token: ${device2Token.substring(0, 30)}...`);
      console.log(`   User: ${login2Response.data.user?.name || login2Response.data.user?.email}`);
      console.log(`   Subscription: ${login2Response.data.user?.subscription || 'N/A'}`);
    } else {
      if (login2Response.data.code === "RESET_REQUEST_NEEDED") {
        console.log("⚠️  Device 2 login returned RESET_REQUEST_NEEDED");
        console.log(`   Message: ${login2Response.data.message}`);
        console.log(`   Max Devices: ${login2Response.data.maxDevices}`);
        console.log(`   Current Devices: ${login2Response.data.currentDevices}`);
        console.log("\n   ❌ This should NOT happen for Premium users on 2nd device!");
        throw new Error("Premium users should be able to login on 2 devices");
      } else {
        throw new Error(`Device 2 login failed: ${login2Response.data.message}`);
      }
    }
    
    // Wait for database to sync
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // ============================================
    // TEST 3: PREMIUM USER - THIRD DEVICE LOGIN (SHOULD FAIL)
    // ============================================
    console.log("\n📱 TEST 3: Premium User - Third Device Login (Should Return RESET_REQUEST_NEEDED)");
    console.log("-".repeat(70));
    
    try {
      device3Response = await axios.post(`${API_BASE_URL}/login`, {
        identifier: TEST_MOBILE,
        password: TEST_PASSWORD,
        deviceInfo: device3Info
      });
      
      // If we get here, login succeeded (shouldn't happen)
      if (device3Response.data.success) {
        console.log("❌ ERROR: Device 3 logged in successfully, but it shouldn't!");
        console.log("   Premium users have a 2 device limit");
        throw new Error("Device limit not enforced correctly");
      }
    } catch (error) {
      if (error.response && error.response.data.code === "RESET_REQUEST_NEEDED") {
        console.log("✅ Device 3 login correctly returned RESET_REQUEST_NEEDED");
        console.log(`   Code: ${error.response.data.code}`);
        console.log(`   Message: ${error.response.data.message}`);
        console.log(`   Max Devices: ${error.response.data.maxDevices}`);
        console.log(`   Current Devices: ${error.response.data.currentDevices}`);
        console.log(`   Subscription Type: ${error.response.data.subscriptionType || 'N/A'}`);
        device3Response = { data: error.response.data };
      } else {
        throw error;
      }
    }
    
    // ============================================
    // TEST 4: VERIFY DEVICE 1 STILL WORKS
    // ============================================
    console.log("\n📱 TEST 4: Verify Device 1 Session Still Works");
    console.log("-".repeat(70));
    
    const profile1Response = await axios.get(`${API_BASE_URL}/user/profile`, {
      headers: {
        'Authorization': `Bearer ${device1Token}`,
        'X-Device-Id': device1Id
      }
    });
    
    if (profile1Response.data.success) {
      console.log("✅ Device 1 session is still valid!");
      console.log(`   User: ${profile1Response.data.user?.name || profile1Response.data.user?.email}`);
    } else {
      throw new Error(`Device 1 session invalidated! Error: ${profile1Response.data.message || profile1Response.data.error}`);
    }
    
    // ============================================
    // TEST 5: VERIFY DEVICE 2 STILL WORKS
    // ============================================
    console.log("\n📱 TEST 5: Verify Device 2 Session Still Works");
    console.log("-".repeat(70));
    
    const profile2Response = await axios.get(`${API_BASE_URL}/user/profile`, {
      headers: {
        'Authorization': `Bearer ${device2Token}`,
        'X-Device-Id': device2Id
      }
    });
    
    if (profile2Response.data.success) {
      console.log("✅ Device 2 session is still valid!");
      console.log(`   User: ${profile2Response.data.user?.name || profile2Response.data.user?.email}`);
    } else {
      throw new Error(`Device 2 session invalidated! Error: ${profile2Response.data.message || profile2Response.data.error}`);
    }
    
    // ============================================
    // TEST 6: CHECK ACTIVE DEVICES
    // ============================================
    console.log("\n📱 TEST 6: Check Active Devices");
    console.log("-".repeat(70));
    
    const devicesResponse = await axios.get(`${API_BASE_URL}/user/devices`, {
      headers: {
        'Authorization': `Bearer ${device1Token}`,
        'X-Device-Id': device1Id
      }
    });
    
    if (devicesResponse.data.success) {
      const activeDevices = devicesResponse.data.activeDevices || devicesResponse.data.devices || [];
      console.log(`✅ Found ${activeDevices.length} active device(s)`);
      activeDevices.forEach((device, index) => {
        console.log(`   Device ${index + 1}: ${device.deviceName} (${device.deviceId})`);
        console.log(`      Platform: ${device.platform}, Active: ${device.isActive}`);
      });
      
      if (activeDevices.length === 2) {
        console.log("\n✅ Both devices are active (as expected for Premium users)");
      } else if (activeDevices.length > 2) {
        console.log(`\n⚠️  Warning: ${activeDevices.length} devices are active (expected 2 for Premium)`);
      }
    }
    
    // ============================================
    // SUMMARY
    // ============================================
    console.log("\n" + "=".repeat(70));
    console.log("✅ TEST SUMMARY");
    console.log("=".repeat(70));
    console.log("");
    console.log("✅ Device 1 Login: SUCCESS");
    console.log("✅ Device 2 Login: SUCCESS (Premium allows 2 devices)");
    console.log("✅ Device 3 Login: RESET_REQUEST_NEEDED (Correctly blocked)");
    console.log("✅ Device 1 Session: Still Valid");
    console.log("✅ Device 2 Session: Still Valid");
    console.log("");
    console.log("🎉 Premium User Device Limit Test: PASSED!");
    console.log("");
    console.log("📝 Next Steps for Premium Plus Testing:");
    console.log("   1. Update user subscription to Premium Plus");
    console.log("   2. Run this test again");
    console.log("   3. Should see same results (2 device limit)");
    console.log("");
    
  } catch (error) {
    console.error("\n" + "=".repeat(70));
    console.error("❌ TEST FAILED!");
    console.error("=".repeat(70));
    console.error("\nError:", error.message);
    if (error.response) {
      console.error("Response Status:", error.response.status);
      console.error("Response Data:", JSON.stringify(error.response.data, null, 2));
    }
    console.error("\nStack:", error.stack);
    process.exit(1);
  }
}

// Run the test
testDeviceLoginFlow();

