const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/1win/User');
const bcrypt = require('bcryptjs');

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URL || 'mongodb+srv://1win_db_user:Fiifi9088.me@1win.abmb1za.mongodb.net/1win_db?retryWrites=true&w=majority')
  .then(async () => {
    console.log('✓ Connected to MongoDB\n');

    // Check if test user exists
    const user = await User.findOne({
      $or: [
        { email: 'test@1win.com' },
        { accountId: '12345678' },
      ],
    });

    if (!user) {
      console.log('❌ Test user NOT FOUND in database!');
      console.log('\nCreating test user now...\n');
      
      // Create the user
      const newUser = await User.create({
        email: 'test@1win.com',
        accountId: '12345678',
        name: 'Test User',
        password: 'test1234',
        currency: 'GHS',
        isActive: true,
      });
      
      console.log('✓ Test user created!');
      console.log('Email:', newUser.email);
      console.log('Account ID:', newUser.accountId);
      console.log('Password: test1234\n');
    } else {
      console.log('✓ Test user FOUND in database!');
      console.log('Email:', user.email || 'N/A');
      console.log('Account ID:', user.accountId || 'N/A');
      console.log('Name:', user.name || 'N/A');
      console.log('Is Active:', user.isActive);
      
      // Test password
      const passwordMatch = await user.comparePassword('test1234');
      console.log('Password test (test1234):', passwordMatch ? '✓ MATCH' : '❌ NO MATCH');
      
      if (!passwordMatch) {
        console.log('\n⚠️  Password mismatch! Resetting password...');
        user.password = 'test1234';
        await user.save();
        console.log('✓ Password reset to: test1234');
      }
    }

    console.log('\n=== Login Credentials ===');
    console.log('Email: test@1win.com');
    console.log('OR Account ID: 12345678');
    console.log('Password: test1234');
    console.log('\nTry logging in at: http://localhost:5174/login');
    
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error.message);
    process.exit(1);
  });

