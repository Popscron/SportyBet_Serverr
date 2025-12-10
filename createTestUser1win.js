const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/1win/User');

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URL || 'mongodb+srv://1win_db_user:Fiifi9088.me@1win.abmb1za.mongodb.net/1win_db?retryWrites=true&w=majority', {
    // useNewUrlParser: true,
    // useUnifiedTopology: true,
  })
  .then(async () => {
    console.log('✓ Connected to MongoDB');

    // Test user credentials
    const testUser = {
      email: 'test@1win.com',
      accountId: '12345678',
      name: 'Test User',
      password: 'test1234',
      currency: 'GHS',
      isActive: true,
    };

    try {
      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [
          { email: testUser.email },
          { accountId: testUser.accountId },
        ],
      });

      if (existingUser) {
        console.log('Test user already exists!');
        console.log('Email:', testUser.email);
        console.log('Account ID:', testUser.accountId);
        console.log('Password: test1234');
        console.log('\nYou can login with these credentials.');
        process.exit(0);
      }

      // Create test user
      const user = await User.create(testUser);
      console.log('✓ Test user created successfully!');
      console.log('\n=== Test Account Credentials ===');
      console.log('Email:', testUser.email);
      console.log('Account ID:', testUser.accountId);
      console.log('Password: test1234');
      console.log('Name:', testUser.name);
      console.log('\nYou can now login with these credentials at http://localhost:5174/login');
      process.exit(0);
    } catch (error) {
      console.error('Error creating test user:', error.message);
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('Error connecting to MongoDB:', error.message);
    process.exit(1);
  });

