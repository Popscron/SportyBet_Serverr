const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
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

    // Test user data
    const testUser = {
      name: "Test User",
      username: "testuser",
      email: "test@example.com",
      mobileNumber: "1234567890",
      password: "test123", // Will be hashed
      subscription: "Premium",
      expiry: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
      expiryPeriod: "3 Months",
      role: "user",
      accountStatus: "Active",
    };

    try {
      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [
          { username: testUser.username },
          { email: testUser.email },
          { mobileNumber: testUser.mobileNumber },
        ],
      });

      if (existingUser) {
        console.log("❌ User already exists!");
        console.log("Existing user:", {
          username: existingUser.username,
          email: existingUser.email,
          mobileNumber: existingUser.mobileNumber,
        });
        process.exit(1);
      }

      // Hash password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(testUser.password, saltRounds);

      // Create new user
      const newUser = new User({
        ...testUser,
        password: hashedPassword,
      });

      await newUser.save();

      console.log("✅ Test user created successfully!");
      console.log("\n📋 Login Credentials:");
      console.log("Username:", testUser.username);
      console.log("Email:", testUser.email);
      console.log("Mobile Number:", testUser.mobileNumber);
      console.log("Password:", testUser.password);
      console.log("\nYou can login with any of these identifiers (username, email, or mobile number)");

      process.exit(0);
    } catch (error) {
      console.error("❌ Error creating user:", error.message);
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error("❌ Error connecting to MongoDB:", error.message);
    process.exit(1);
  });

