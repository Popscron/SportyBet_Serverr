const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const SpindictUser = require("../models/SpindictUser");
require("dotenv").config();

// Use the same MongoDB connection as the backend
const MONGODB_URI = process.env.MONGO_URL || process.env.MONGODB_URI || "mongodb+srv://1win_db_user:Fiifi9088.@1win.abmb1za.mongodb.net/1win_db?retryWrites=true&w=majority&appName=1win";

async function createDemoAccounts() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB");

    // Demo Admin Account
    const adminEmail = "admin@spindict.com";
    const adminPassword = "admin123";
    const adminHashedPassword = await bcrypt.hash(adminPassword, 10);

    // Demo User Account
    const userEmail = "User@spindict.com";
    const userPassword = "user123";
    const userHashedPassword = await bcrypt.hash(userPassword, 10);

    // Check if admin already exists
    let admin = await SpindictUser.findOne({ email: adminEmail });
    if (admin) {
      console.log("Admin account already exists. Updating password and role...");
      admin.password = adminHashedPassword;
      admin.role = "admin";
      await admin.save();
      console.log("✅ Admin account updated!");
    } else {
      admin = new SpindictUser({
        name: "Admin User",
        email: adminEmail,
        username: "admin",
        mobileNumber: "1234567890",
        password: adminHashedPassword,
        role: "admin",
        subscription: "Premium",
        expiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
        expiryPeriod: "1 Year",
        accountStatus: "Active",
      });
      await admin.save();
      console.log("✅ Admin account created!");
    }

    // Check if user already exists (by email or mobile number)
    let user = await SpindictUser.findOne({ 
      $or: [
        { email: userEmail },
        { mobileNumber: "0987654321" }
      ]
    });
    if (user) {
      console.log("User account already exists. Updating password and details...");
      user.email = userEmail;
      user.password = userHashedPassword;
      user.role = "user";
      user.mobileNumber = "0987654321";
      user.username = "demo_user";
      user.name = "Demo User";
      await user.save();
      console.log("✅ User account updated!");
    } else {
      user = new SpindictUser({
        name: "Demo User",
        email: userEmail,
        username: "demo_user",
        mobileNumber: "0987654321",
        password: userHashedPassword,
        role: "user",
        subscription: "Basic",
        expiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        expiryPeriod: "1 Month",
        accountStatus: "Active",
      });
      await user.save();
      console.log("✅ User account created!");
    }

    console.log("\n📋 Demo Account Credentials:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🔐 ADMIN ACCOUNT:");
    console.log("   Email: admin@spindict.com");
    console.log("   Password: admin123");
    console.log("   Username: admin");
    console.log("   Mobile: 1234567890");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("👤 USER ACCOUNT:");
    console.log("   Email: User@spindict.com");
    console.log("   Password: user123");
    console.log("   Username: demo_user");
    console.log("   Mobile: 0987654321");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    await mongoose.connection.close();
    console.log("✅ Demo accounts setup complete!");
  } catch (error) {
    console.error("❌ Error creating demo accounts:", error);
    process.exit(1);
  }
}

createDemoAccounts();




