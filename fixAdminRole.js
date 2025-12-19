const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/1win/User');

const mongoUrl = process.env.MONGO_URL || 'mongodb+srv://1win_db_user:Fiifi9088.@1win.abmb1za.mongodb.net/1win_db?retryWrites=true&w=majority&appName=1win';

mongoose.connect(mongoUrl)
  .then(async () => {
    console.log('✓ Connected to MongoDB');

    const adminEmail = process.argv[2] || 'capsiteafrica@gmail.com';

    const user = await User.findOne({ email: adminEmail.toLowerCase() });

    if (!user) {
      console.log(`❌ User with email ${adminEmail} not found.`);
      process.exit(1);
    }

    console.log(`\n📋 User found: ${user.email}`);
    console.log(`   Current role: ${user.role}`);
    console.log(`   Current isAdmin: ${user.isAdmin}`);
    console.log(`   Current inviteCode: ${user.inviteCode || 'NONE'}`);

    // Update to admin
    user.role = 'admin';
    user.isAdmin = true;
    // Main admin should have no invite code
    if (!user.inviteCode) {
      user.inviteCode = null;
    }

    await user.save();

    console.log('\n✅ User updated successfully!\n');
    console.log('=== Updated User Details ===');
    console.log('Email:', user.email);
    console.log('Role:', user.role);
    console.log('isAdmin:', user.isAdmin);
    console.log('Invite Code:', user.inviteCode || 'NONE (Main Admin)');
    console.log('\nUser can now access admin routes!');

    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error:', error.message);
    process.exit(1);
  });





