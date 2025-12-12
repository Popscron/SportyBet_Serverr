const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/1win/User');
const { generateUniqueInviteCode } = require('./utils/inviteCodeGenerator');

// Connect to MongoDB
const mongoUrl = process.env.MONGO_URL || 'mongodb+srv://1win_db_user:Fiifi9088.@1win.abmb1za.mongodb.net/1win_db?retryWrites=true&w=majority&appName=1win';

mongoose
  .connect(mongoUrl)
  .then(async () => {
    console.log('✓ Connected to MongoDB');

    try {
      // Get admin email from command line argument or use default
      const adminEmail = process.argv[2] || null;

      let admin;
      
      if (adminEmail) {
        // Find admin by email
        admin = await User.findOne({ 
          email: adminEmail.toLowerCase(),
          isAdmin: true 
        });
        
        if (!admin) {
          console.log(`❌ Admin with email ${adminEmail} not found or not an admin`);
          process.exit(1);
        }
      } else {
        // Find first admin without invite code
        admin = await User.findOne({ 
          isAdmin: true,
          inviteCode: { $in: [null, undefined, ''] }
        });
        
        if (!admin) {
          console.log('❌ No admin found without invite code');
          console.log('\nAll admins:');
          const allAdmins = await User.find({ isAdmin: true }).select('email name inviteCode');
          allAdmins.forEach(a => {
            console.log(`  - ${a.email} (${a.name || 'No name'}) - Invite Code: ${a.inviteCode || 'NONE'}`);
          });
          process.exit(1);
        }
      }

      console.log(`\n📋 Admin found: ${admin.email} (${admin.name || 'No name'})`);
      console.log(`   Current invite code: ${admin.inviteCode || 'NONE'}`);

      // Generate new invite code
      const newInviteCode = await generateUniqueInviteCode();
      admin.inviteCode = newInviteCode;
      await admin.save();

      const frontendUrl = process.env.ONEWIN_FRONTEND_URL || 'http://localhost:5177';
      const inviteLink = `${frontendUrl}/${newInviteCode}`;

      console.log('\n✅ Invite code generated successfully!');
      console.log('\n=== Admin Invite Details ===');
      console.log('Email:', admin.email);
      console.log('Invite Code:', newInviteCode);
      console.log('Invite Link:', inviteLink);
      console.log('\nShare this link with users to earn commissions!');
      
      process.exit(0);
    } catch (error) {
      console.error('❌ Error generating invite code:', error.message);
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('❌ Error connecting to MongoDB:', error.message);
    process.exit(1);
  });

