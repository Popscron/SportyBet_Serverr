const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/1win/User');

// Connect to MongoDB
const mongoUrl = process.env.MONGO_URL || 'mongodb+srv://1win_db_user:Fiifi9088.@1win.abmb1za.mongodb.net/1win_db?retryWrites=true&w=majority&appName=1win';

mongoose
  .connect(mongoUrl)
  .then(async () => {
    console.log('✓ Connected to MongoDB');

    // Get email and password from command line arguments
    const email = process.argv[2];
    const password = process.argv[3];

    if (!email || !password) {
      console.error('Please provide email and password');
      console.log('Usage: node fixAdminAccount.js <email> <password>');
      process.exit(1);
    }

    try {
      let user = await User.findOne({ email: email.toLowerCase() });
      
      if (!user) {
        console.log('❌ User not found. Creating new admin account...');
        // Create new admin
        user = await User.create({
          email: email.toLowerCase(),
          password: password,
          name: 'Admin User',
          isAdmin: true,
          role: 'admin',
        });
        console.log('✓ Admin account created');
      } else {
        console.log('✓ User found. Updating to admin...');
        // Update existing user to admin
        user.isAdmin = true;
        user.role = user.role || 'admin';
        user.password = password; // Will be hashed by pre-save hook
        await user.save();
        console.log('✓ Admin account updated');
      }

      console.log('\n=== Admin Account Details ===');
      console.log('Email:', user.email);
      console.log('Name:', user.name);
      console.log('isAdmin:', user.isAdmin);
      console.log('Role:', user.role);
      console.log('\n✓ You can now login with these credentials');

      process.exit(0);
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('Error connecting to MongoDB:', error.message);
    process.exit(1);
  });

