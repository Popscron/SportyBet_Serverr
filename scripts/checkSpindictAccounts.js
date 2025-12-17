const mongoose = require("mongoose");
const User = require("../models/user");
require("dotenv").config();

// Use the same MongoDB connection as the backend
const MONGODB_URI = process.env.MONGO_URL || process.env.MONGODB_URI || "mongodb+srv://1win_db_user:Fiifi9088.@1win.abmb1za.mongodb.net/1win_db?retryWrites=true&w=majority&appName=1win";

async function checkSpindictAccounts() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB\n");

    // Find all spindict users
    const spindictUsers = await SpindictUser.find({}).select("name email username mobileNumber role accountStatus createdAt");
    
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`📊 Found ${spindictUsers.length} Spindict account(s) in database:`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    if (spindictUsers.length === 0) {
      console.log("❌ No Spindict accounts found in the database.");
      console.log("💡 Run 'npm run create-demo' to create the demo accounts.\n");
    } else {
      spindictUsers.forEach((user, index) => {
        console.log(`Account ${index + 1}:`);
        console.log(`  Name: ${user.name || "N/A"}`);
        console.log(`  Email: ${user.email || "N/A"}`);
        console.log(`  Username: ${user.username || "N/A"}`);
        console.log(`  Mobile: ${user.mobileNumber || "N/A"}`);
        console.log(`  Role: ${user.role || "N/A"}`);
        console.log(`  Platform: ${user.platform || "N/A"}`);
        console.log(`  Status: ${user.accountStatus || "N/A"}`);
        console.log(`  Created: ${user.createdAt || "N/A"}`);
        console.log("");
      });

      // Check specifically for the demo accounts
      const adminAccount = await SpindictUser.findOne({ email: "admin@spindict.com" });
      const userAccount = await SpindictUser.findOne({ email: "User@spindict.com" });

      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("🔍 Demo Account Status:");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log(`Admin Account (admin@spindict.com): ${adminAccount ? "✅ Found" : "❌ Not Found"}`);
      console.log(`User Account (User@spindict.com): ${userAccount ? "✅ Found" : "❌ Not Found"}`);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    }

    await mongoose.connection.close();
    console.log("✅ Check complete!");
  } catch (error) {
    console.error("❌ Error checking accounts:", error);
    process.exit(1);
  }
}

checkSpindictAccounts();




