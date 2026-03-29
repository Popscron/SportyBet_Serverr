const bcrypt = require("bcryptjs");
const User = require("../../../models/user");

async function register(body) {
  const { name, password, username, email, mobileNumber } = body;

  console.log("Register request:", body);

  if (!name || !password || !username || !email || !mobileNumber) {
    return {
      status: 400,
      json: {
        success: false,
        message:
          "All fields are required: name, username, email, mobile number, and password.",
      },
    };
  }

  if (password.length < 6) {
    return {
      status: 400,
      json: {
        success: false,
        message: "Password must be at least 6 characters long.",
      },
    };
  }

  try {
    const existingUser = await User.findOne({
      $or: [{ username }, { email }, { mobileNumber }],
    });

    if (existingUser) {
      return {
        status: 400,
        json: {
          success: false,
          message: "Username, email, or mobile number already exists.",
        },
      };
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const expiry = new Date();
    expiry.setMonth(expiry.getMonth() + 1);

    const newUser = new User({
      name,
      password: hashedPassword,
      username,
      email,
      mobileNumber,
      subscription: "Games",
      accountStatus: "Hold",
      role: "user",
      expiry,
      expiryPeriod: "1 Month",
    });

    await newUser.save();

    return {
      status: 201,
      json: {
        success: true,
        message:
          "Registration successful! Your account is pending admin approval. You will be able to login once approved.",
        requiresApproval: true,
        user: {
          _id: newUser._id,
          name: newUser.name,
          username: newUser.username,
          email: newUser.email,
          mobileNumber: newUser.mobileNumber,
          accountStatus: newUser.accountStatus,
        },
      },
    };
  } catch (err) {
    console.error("Error registering user:", err);
    return {
      status: 500,
      json: { success: false, message: "Internal server error" },
    };
  }
}

module.exports = { register };
