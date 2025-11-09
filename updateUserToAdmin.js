const mongoose = require("mongoose");
const User = require("./models/user");
require("dotenv").config();

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URL || "mongodb://127.0.0.1:27017/sportybet", {
    // useNewUrlParser: true,
    // useUnifiedTopology: true,
  })
  .then(async () => {
    console.log("Connected to MongoDB");

    try {
      // Find the test user
      const testUser = await User.findOne({
        $or: [
          { username: "testuser" },
          { email: "test@example.com" },
          { mobileNumber: "1234567890" },
        ],
      });

      if (!testUser) {
        console.log("❌ Test user not found!");
        process.exit(1);
      }

      // Update user role to admin
      testUser.role = "admin";
      await testUser.save();

      console.log("✅ User updated to admin successfully!");
      console.log("\n📋 Updated User Info:");
      console.log("Username:", testUser.username);
      console.log("Email:", testUser.email);
      console.log("Mobile Number:", testUser.mobileNumber);
      console.log("Role:", testUser.role);

      process.exit(0);
    } catch (error) {
      console.error("❌ Error updating user:", error.message);
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error("❌ Error connecting to MongoDB:", error.message);
    process.exit(1);
  });

