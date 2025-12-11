const mongoose = require('mongoose');

// Test different password variations for 1win
const connectionStrings = [
  // Option 1: Password with .me (as in your code)
  'mongodb+srv://1win_db_user:Fiifi9088.me@1win.abmb1za.mongodb.net/1win_db?retryWrites=true&w=majority&appName=1win',
  
  // Option 2: Password with just dot (Fiifi9088.)
  'mongodb+srv://1win_db_user:Fiifi9088.@1win.abmb1za.mongodb.net/1win_db?retryWrites=true&w=majority&appName=1win',
  
  // Option 3: Password without dot (Fiifi9088)
  'mongodb+srv://1win_db_user:Fiifi9088@1win.abmb1za.mongodb.net/1win_db?retryWrites=true&w=majority&appName=1win',
  
  // Option 4: Original format you provided (no database name)
  'mongodb+srv://1win_db_user:Fiifi9088.@1win.abmb1za.mongodb.net/?appName=1win',
  
  // Option 5: With .me and no database name
  'mongodb+srv://1win_db_user:Fiifi9088.me@1win.abmb1za.mongodb.net/?appName=1win',
];

async function testConnection(connectionString, index) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing Connection String #${index + 1}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Connection String: ${connectionString.replace(/:[^:@]+@/, ':****@')}`); // Hide password
  
  try {
    // Close any existing connection
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    
    console.log('⏳ Connecting...');
    
    // Try to connect with 10 second timeout
    await mongoose.connect(connectionString, {
      serverSelectionTimeoutMS: 10000,
    });
    
    console.log('✅ SUCCESS! Connection established!\n');
    console.log(`📊 Database: ${mongoose.connection.db.databaseName}`);
    console.log(`🌐 Host: ${mongoose.connection.host}`);
    
    // Test if we can access 1win collections
    try {
      const userModel = mongoose.connection.db.collection('1winusers');
      const count = await userModel.countDocuments();
      console.log(`👥 1Win Users collection: ${count} documents found`);
    } catch (err) {
      console.log('⚠️  1Win Users collection not found or not accessible');
    }
    
    // List some collections
    try {
      const collections = await mongoose.connection.db.listCollections().toArray();
      console.log(`\n📁 Found ${collections.length} collections (showing first 10):`);
      collections.slice(0, 10).forEach(col => {
        console.log(`   ✓ ${col.name}`);
      });
    } catch (err) {
      console.log('⚠️  Could not list collections');
    }
    
    await mongoose.disconnect();
    console.log('\n✅ Connection test completed successfully!');
    console.log('\n' + '='.repeat(60));
    console.log('✅ THIS CONNECTION STRING WORKS!');
    console.log('='.repeat(60));
    console.log('\nUse this in Vercel:');
    console.log(`MONGO_URL=${connectionString}\n`);
    return true;
    
  } catch (error) {
    console.log('❌ FAILED! Connection error:');
    console.log(`   Error: ${error.message}\n`);
    
    if (error.message.includes('authentication failed') || error.message.includes('bad auth')) {
      console.log('   ⚠️  Username or password is incorrect');
    } else if (error.message.includes('timeout')) {
      console.log('   ⚠️  Connection timed out (check IP whitelist)');
    }
    
    return false;
  }
}

async function runTests() {
  console.log('\n🔍 Testing 1Win MongoDB Connection Strings...\n');
  console.log('Testing different password variations...\n');
  
  for (let i = 0; i < connectionStrings.length; i++) {
    const success = await testConnection(connectionStrings[i], i);
    if (success) {
      break; // Stop on first success
    }
    
    // Wait a bit between tests
    if (i < connectionStrings.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('Testing complete!');
  console.log('='.repeat(60) + '\n');
  
  process.exit(0);
}

runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

