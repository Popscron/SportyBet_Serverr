const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/1win/User');

// Connect to MongoDB
const mongoUrl = process.env.MONGO_URL || 'mongodb+srv://1win_db_user:Fiifi9088.@1win.abmb1za.mongodb.net/1win_db?retryWrites=true&w=majority&appName=1win';

mongoose
  .connect(mongoUrl, {
    // useNewUrlParser: true,
    // useUnifiedTopology: true,
  })
  .then(async () => {
    console.log('✓ Connected to MongoDB');

    // Admin user credentials
    const adminUser = {
      email: 'Capsiteafrica@gmail.com',
      name: 'Admin User',
      password: 'Fiifi9088.',
      currency: 'GHS',
      isAdmin: true,
      role: 'admin', // Main admin has 'admin' role
      isActive: true,
    };

    try {
      // Check if user already exists
      const existingUser = await User.findOne({
        email: adminUser.email.toLowerCase(),
      });

      if (existingUser) {
        // Update existing user to be main admin (no invite code = main admin)
        existingUser.isAdmin = true;
        existingUser.role = 'admin';
        existingUser.password = adminUser.password; // Will be hashed by pre-save hook
        existingUser.name = adminUser.name;
        existingUser.inviteCode = null; // Main admin has no invite code
        await existingUser.save();
        console.log('✓ Admin user updated successfully!');
        console.log('\n=== Admin Account Credentials ===');
        console.log('Email:', adminUser.email);
        console.log('Password:', adminUser.password);
        console.log('Admin Status: ✓');
        console.log('\nYou can now login at http://localhost:5173/1win/login');
        process.exit(0);
      }

      // Create admin user
      const user = await User.create(adminUser);
      console.log('✓ Admin user created successfully!');
      console.log('\n=== Admin Account Credentials ===');
      console.log('Email:', adminUser.email);
      console.log('Password:', adminUser.password);
      console.log('Admin Status: ✓');
      console.log('\nYou can now login at http://localhost:5173/1win/login');
      process.exit(0);
    } catch (error) {
      console.error('Error creating admin user:', error.message);
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('Error connecting to MongoDB:', error.message);
    process.exit(1);
  });

