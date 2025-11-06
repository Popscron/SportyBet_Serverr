const mongoose = require('mongoose');
const ManualCard = require('./models/ManualCard');

// Test script for manual cards functionality
async function testManualCards() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URL);
    console.log('Connected to MongoDB');

    // Test 1: Create a manual card
    console.log('\n=== Test 1: Creating a manual card ===');
    const testCard = new ManualCard({
      phone: '+233123456789',
      amount: 150.50,
      minute: 5,
      sport: 'Sports',
      duration: 10, // 10 minutes
      timeAgo: '5 minutes ago',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes from now
    });

    const savedCard = await testCard.save();
    console.log('✅ Manual card created:', savedCard);

    // Test 2: Get active cards
    console.log('\n=== Test 2: Getting active cards ===');
    const activeCards = await ManualCard.find({
      expiresAt: { $gt: new Date() },
      isActive: true
    });
    console.log('✅ Active cards found:', activeCards.length);

    // Test 3: Get broadcast format
    console.log('\n=== Test 3: Broadcast format ===');
    const broadcastCards = activeCards.map(card => ({
      phone: card.phone,
      amount: card.amount.toFixed(2),
      timeAgo: card.timeAgo,
      sport: card.sport,
      isManual: true
    }));
    console.log('✅ Broadcast format:', broadcastCards);

    // Test 4: Clean up test data
    console.log('\n=== Test 4: Cleaning up ===');
    await ManualCard.deleteMany({
      phone: '+233123456789'
    });
    console.log('✅ Test data cleaned up');

    console.log('\n🎉 All tests passed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the test
testManualCards();


