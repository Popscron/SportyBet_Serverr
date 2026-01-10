const mongoose = require('mongoose');
const User = require('../models/user');

// MongoDB connection URL
const mongoUrl = process.env.MONGO_URL || 'mongodb+srv://1win_db_user:Fiifi9088.@1win.abmb1za.mongodb.net/1win_db?retryWrites=true&w=majority&appName=1win';

async function updateSubscription() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoUrl, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log('✅ Connected to MongoDB\n');

    const username = 'user_0535899507';
    const newSubscription = 'Premium Plus';

    console.log(`🔍 Looking for user: ${username}`);
    const user = await User.findOne({ username: username });

    if (!user) {
      console.error('❌ User not found!');
      process.exit(1);
    }

    console.log('✅ User Found:');
    console.log(`   Name: ${user.name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Username: ${user.username}`);
    console.log(`   Current Subscription: ${user.subscription}`);
    console.log(`   User ID (_id): ${user._id}\n`);

    // Update subscription
    user.subscription = newSubscription;
    await user.save();

    console.log(`✅ Successfully updated subscription to: ${newSubscription}`);
    console.log(`\n📋 Updated User Details:`);
    console.log(`   Subscription: ${user.subscription}`);
    console.log(`   User ID: ${user._id}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 MongoDB connection closed');
    process.exit(0);
  }
}

updateSubscription();

