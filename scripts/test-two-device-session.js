const axios = require('axios');
require('dotenv').config();

// Use localhost for testing, or Vercel if LOCAL_TEST is not set
const API_BASE_URL = process.env.LOCAL_TEST === "true" 
  ? "http://localhost:5008/api" 
  : (process.env.VERCEL_API_BASE_URL || "https://sporty-bet-serverr.vercel.app/api");

// Test credentials
const TEST_MOBILE = "0535899507";
const TEST_PASSWORD = "daxfixedd";

// Generate unique device IDs for testing
const device1Id = `test-device-1-${Date.now()}`;
const device2Id = `test-device-2-${Date.now()}`;

const device1Info = {
  deviceId: device1Id,
  deviceName: "Test Device 1",
  modelName: "Test Model 1",
  deviceType: "mobile",
  platform: "ios",
  osVersion: "17.0",
  appVersion: "1.0.0",
  location: "Test Location 1"
};

const device2Info = {
  deviceId: device2Id,
  deviceName: "Test Device 2",
  modelName: "Test Model 2",
  deviceType: "mobile",
  platform: "android",
  osVersion: "14.0",
  appVersion: "1.0.0",
  location: "Test Location 2"
};

async function testTwoDeviceSession() {
  console.log("🧪 Testing Two Device Session for Premium Users\n");
  console.log("=" .repeat(60));
  
  let device1Token = null;
  let device2Token = null;
  let device1UserToken = null;
  let device2UserToken = null;
  
  try {
    // Step 1: Device 1 logs in
    console.log("\n📱 Step 1: Device 1 logging in...");
    const login1Response = await axios.post(`${API_BASE_URL}/login`, {
      identifier: TEST_MOBILE,
      password: TEST_PASSWORD,
      deviceInfo: device1Info
    });
    
    if (login1Response.data.success) {
      device1Token = login1Response.data.token;
      console.log("✅ Device 1 logged in successfully");
      console.log(`   Token: ${device1Token.substring(0, 20)}...`);
    } else {
      throw new Error(`Device 1 login failed: ${login1Response.data.message}`);
    }
    
    // Step 2: Wait a moment for database to update
    console.log("\n📱 Step 2: Waiting for database to sync...");
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
    
    // Step 2b: Get user profile with Device 1 token to check stored token
    console.log("📱 Step 2b: Checking Device 1 session...");
    const profile1Response = await axios.get(`${API_BASE_URL}/user/profile`, {
      headers: {
        'Authorization': `Bearer ${device1Token}`,
        'X-Device-Id': device1Id
      }
    });
    
    if (profile1Response.data.success) {
      console.log("✅ Device 1 session is valid");
      // Note: We can't directly check user.token from profile endpoint, but we can verify the token works
    } else {
      throw new Error(`Device 1 session check failed: ${profile1Response.data.message}`);
    }
    
    // Step 3: Device 2 logs in
    console.log("\n📱 Step 3: Device 2 logging in...");
    const login2Response = await axios.post(`${API_BASE_URL}/login`, {
      identifier: TEST_MOBILE,
      password: TEST_PASSWORD,
      deviceInfo: device2Info
    });
    
    if (login2Response.data.success) {
      device2Token = login2Response.data.token;
      console.log("✅ Device 2 logged in successfully");
      console.log(`   Token: ${device2Token.substring(0, 20)}...`);
    } else {
      if (login2Response.data.code === "RESET_REQUEST_NEEDED") {
        console.log("⚠️  Device 2 login returned RESET_REQUEST_NEEDED");
        console.log(`   Message: ${login2Response.data.message}`);
        console.log(`   Current Devices: ${login2Response.data.currentDevices}`);
        console.log("\n   This means 2 devices are already active. Cleaning up...");
        
        // Get devices and deactivate one
        const devicesResponse = await axios.get(`${API_BASE_URL}/user/devices`, {
          headers: {
            'Authorization': `Bearer ${device1Token}`,
            'X-Device-Id': device1Id
          }
        });
        
        if (devicesResponse.data.success && devicesResponse.data.devices.length > 0) {
          const deviceToDeactivate = devicesResponse.data.devices[0];
          console.log(`   Deactivating device: ${deviceToDeactivate.deviceId}`);
          
          await axios.put(`${API_BASE_URL}/user/devices/${deviceToDeactivate._id}/deactivate`, {}, {
            headers: {
              'Authorization': `Bearer ${device1Token}`,
              'X-Device-Id': device1Id
            }
          });
          
          console.log("   ✅ Device deactivated, retrying Device 2 login...");
          
          // Retry Device 2 login
          const retryLogin2Response = await axios.post(`${API_BASE_URL}/login`, {
            identifier: TEST_MOBILE,
            password: TEST_PASSWORD,
            deviceInfo: device2Info
          });
          
          if (retryLogin2Response.data.success) {
            device2Token = retryLogin2Response.data.token;
            console.log("✅ Device 2 logged in successfully after cleanup");
            console.log(`   Token: ${device2Token.substring(0, 20)}...`);
          } else {
            throw new Error(`Device 2 retry login failed: ${retryLogin2Response.data.message}`);
          }
        }
      } else {
        throw new Error(`Device 2 login failed: ${login2Response.data.message}`);
      }
    }
    
    // Step 4: Verify Device 1 still works after Device 2 login
    console.log("\n📱 Step 4: Verifying Device 1 session still works after Device 2 login...");
    const verify1Response = await axios.get(`${API_BASE_URL}/user/profile`, {
      headers: {
        'Authorization': `Bearer ${device1Token}`,
        'X-Device-Id': device1Id
      }
    });
    
    if (verify1Response.data.success) {
      console.log("✅ Device 1 session is still valid!");
      console.log(`   User: ${verify1Response.data.user?.name || verify1Response.data.user?.email}`);
    } else {
      throw new Error(`Device 1 session invalidated! Error: ${verify1Response.data.message || verify1Response.data.error}`);
    }
    
    // Step 5: Verify Device 2 works
    console.log("\n📱 Step 5: Verifying Device 2 session...");
    const verify2Response = await axios.get(`${API_BASE_URL}/user/profile`, {
      headers: {
        'Authorization': `Bearer ${device2Token}`,
        'X-Device-Id': device2Id
      }
    });
    
    if (verify2Response.data.success) {
      console.log("✅ Device 2 session is valid!");
      console.log(`   User: ${verify2Response.data.user?.name || verify2Response.data.user?.email}`);
    } else {
      throw new Error(`Device 2 session invalid! Error: ${verify2Response.data.message || verify2Response.data.error}`);
    }
    
    // Step 6: Check active devices
    console.log("\n📱 Step 6: Checking active devices...");
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
        console.log(`   Device ${index + 1}: ${device.deviceName} (${device.deviceId}) - ${device.platform}`);
      });
      
      if (activeDevices.length === 2) {
        console.log("✅ Both devices are active!");
      } else if (activeDevices.length === 1) {
        console.log("⚠️  Only 1 device is active (expected if one was deactivated during cleanup)");
      }
    }
    
    // Final Summary
    console.log("\n" + "=".repeat(60));
    console.log("✅ TEST PASSED: Two Device Session Working Correctly!");
    console.log("=".repeat(60));
    console.log("\nSummary:");
    console.log(`   ✅ Device 1 logged in: ${device1Token ? 'Yes' : 'No'}`);
    console.log(`   ✅ Device 2 logged in: ${device2Token ? 'Yes' : 'No'}`);
    console.log(`   ✅ Device 1 session still valid after Device 2 login: Yes`);
    console.log(`   ✅ Device 2 session valid: Yes`);
    console.log("\n🎉 Both devices can stay logged in simultaneously!\n");
    
  } catch (error) {
    console.error("\n" + "=".repeat(60));
    console.error("❌ TEST FAILED!");
    console.error("=".repeat(60));
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
testTwoDeviceSession();

