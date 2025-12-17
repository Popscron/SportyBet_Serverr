const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/1win/User');

// Connect to MongoDB
const mongoUrl = process.env.MONGO_URL || 'mongodb+srv://1win_db_user:Fiifi9088.@1win.abmb1za.mongodb.net/1win_db?retryWrites=true&w=majority&appName=1win';

mongoose
  .connect(mongoUrl)
  .then(async () => {
    console.log('✓ Connected to MongoDB');

    // Get email from command line argument
    const email = process.argv[2];
    if (!email) {
      console.error('Please provide an email address as argument');
      console.log('Usage: node testAdminLogin.js <email>');
      process.exit(1);
    }

    try {
      const user = await User.findOne({ email: email.toLowerCase() });
      
      if (!user) {
        console.log('❌ User not found');
        process.exit(1);
      }

      console.log('\n=== User Details ===');
      console.log('Email:', user.email);
      console.log('Name:', user.name);
      console.log('isAdmin:', user.isAdmin);
      console.log('Role:', user.role);
      console.log('Has Password:', !!user.password);
      console.log('Password Length:', user.password?.length || 0);
      console.log('Invite Code:', user.inviteCode || 'Not set');

      // Test password comparison
      const testPassword = process.argv[3] || 'test1234';
      console.log('\n=== Testing Password ===');
      console.log('Testing with password:', testPassword);
      const isMatch = await user.comparePassword(testPassword);
      console.log('Password Match:', isMatch);

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





