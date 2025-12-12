const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../../models/1win/User');
const PaymentTransaction = require('../../models/1win/PaymentTransaction');
const { adminAuth, mainAdminAuth } = require('../../middleware/1win/admin');
const { generateUniqueInviteCode } = require('../../utils/inviteCodeGenerator');
const router = express.Router();

// All admin routes require admin authentication
router.use(adminAuth);

// @route   GET /api/1win/admin/users
// @desc    Get all users
// @access  Private (Admin)
router.get('/users', async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching users',
    });
  }
});

// @route   GET /api/1win/admin/users/website
// @desc    Get all users registered from website
// @access  Private (Admin)
router.get('/users/website', async (req, res) => {
  try {
    const users = await User.find({ registeredFromWebsite: true })
      .select('-password')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error('Get website users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching website users',
    });
  }
});

// @route   GET /api/1win/admin/users/:id
// @desc    Get single user
// @access  Private (Admin)
router.get('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }
    
    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching user',
    });
  }
});

// @route   POST /api/1win/admin/users
// @desc    Create new user (Admin)
// @access  Private (Admin)
router.post(
  '/users',
  [
    body('email').optional().isEmail().normalizeEmail(),
    body('phone').optional().isMobilePhone(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('name').optional().trim(),
    body('currency').optional().isIn(['GHS', 'PKR', 'USD', 'EUR', 'NGN', 'INR']),
    body('balance').optional().isFloat({ min: 0 }),
    body('subscriptionType').optional().isIn(['1month', '3months']),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const { email, phone, password, name, currency, balance, subscriptionType, subscriptionExpiry, role } = req.body;

      // Validate that at least email or phone is provided
      if (!email && !phone) {
        return res.status(400).json({
          success: false,
          message: 'Either email or phone number is required',
        });
      }

      // Validate role
      const userRole = role === 'admin' ? 'admin' : 'user';
      
      // If role is admin, also set isAdmin to true
      const isAdmin = userRole === 'admin';

      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [{ email: email?.toLowerCase() }, { phone }],
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User already exists with this email or phone',
        });
      }

      // Create user
      const user = await User.create({
        email: email?.toLowerCase(),
        phone,
        password,
        name,
        currency: currency || 'GHS',
        balance: balance || 0,
        subscriptionType: subscriptionType || null,
        subscriptionExpiry: subscriptionExpiry || null,
        role: userRole,
        isAdmin: isAdmin,
      });

      const userResponse = await User.findById(user._id).select('-password');

      res.status(201).json({
        success: true,
        data: userResponse,
        message: 'User created successfully',
      });
    } catch (error) {
      console.error('Create user error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error creating user',
      });
    }
  }
);

// @route   PUT /api/1win/admin/users/:id
// @desc    Update user
// @access  Private (Admin)
router.put(
  '/users/:id',
  [
    body('email').optional().isEmail().normalizeEmail(),
    body('phone').optional().custom((value) => {
      // Allow empty string, null, undefined, or valid phone number
      if (value === '' || value === null || value === undefined) return true;
      // If value is provided, validate it as a phone number
      const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/;
      return phoneRegex.test(value) || value.length >= 7; // Basic phone validation
    }).withMessage('Invalid phone number'),
    body('name').optional().trim(),
    body('currency').optional().isIn(['GHS', 'PKR', 'USD', 'EUR', 'NGN', 'INR']),
    body('balance').optional().isFloat({ min: 0 }),
    body('subscriptionType').optional().custom((value) => {
      if (value === '' || value === null || value === undefined) return true;
      return ['1month', '3months'].includes(value);
    }),
    body('role').optional().isIn(['admin', 'user']).withMessage('Invalid role'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.error('Validation errors:', errors.array());
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
      }

      const { email, phone, name, currency, balance, subscriptionType, subscriptionExpiry, subscriptionExpiresAt, isActive, role } = req.body;
      
      // Normalize subscriptionType - convert empty string to null
      const normalizedSubscriptionType = subscriptionType === '' ? null : subscriptionType;

      const user = await User.findById(req.params.id);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      // Update fields
      if (email !== undefined) user.email = email?.toLowerCase();
      if (phone !== undefined) {
        // Convert empty string to null for optional phone field
        user.phone = phone === '' ? null : phone;
      }
      if (name !== undefined) user.name = name;
      if (currency !== undefined) user.currency = currency;
      if (balance !== undefined) user.balance = parseFloat(balance);
      if (normalizedSubscriptionType !== undefined) user.subscriptionType = normalizedSubscriptionType;
      
      // Handle subscription expiry - support both field names for backward compatibility
      const expiryValue = subscriptionExpiresAt !== undefined ? subscriptionExpiresAt : subscriptionExpiry;
      if (expiryValue !== undefined) {
        user.subscriptionExpiresAt = expiryValue === '' || expiryValue === null ? null : expiryValue;
      }
      
      if (isActive !== undefined) user.isActive = isActive;
      
      // Update role and isAdmin
      if (role !== undefined) {
        user.role = role === 'admin' ? 'admin' : 'user';
        user.isAdmin = role === 'admin';
      }

      await user.save();

      const userResponse = await User.findById(user._id).select('-password');

      res.json({
        success: true,
        data: userResponse,
        message: 'User updated successfully',
      });
    } catch (error) {
      console.error('Update user error:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
      res.status(500).json({
        success: false,
        message: error.message || 'Server error updating user',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
);

// @route   DELETE /api/1win/admin/users/:id
// @desc    Delete user
// @access  Private (Admin)
router.delete('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    await User.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting user',
    });
  }
});

// @route   PATCH /api/1win/admin/users/:id/status
// @desc    Toggle user active status
// @access  Private (Admin)
router.patch('/users/:id/status', async (req, res) => {
  try {
    const { isActive } = req.body;

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    user.isActive = isActive !== undefined ? isActive : !user.isActive;
    await user.save();

    res.json({
      success: true,
      data: user,
      message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`,
    });
  } catch (error) {
    console.error('Toggle status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating user status',
    });
  }
});

// @route   GET /api/1win/admin/users/expired
// @desc    Get expired users
// @access  Private (Admin)
router.get('/users/expired', async (req, res) => {
  try {
    const now = new Date();
    const users = await User.find({
      subscriptionExpiry: { $lte: now },
      subscriptionExpiry: { $ne: null },
    })
      .select('-password')
      .sort({ subscriptionExpiry: -1 });

    res.json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error('Get expired users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching expired users',
    });
  }
});

// @route   GET /api/1win/admin/users/disabled
// @desc    Get disabled users
// @access  Private (Admin)
router.get('/users/disabled', async (req, res) => {
  try {
    const users = await User.find({
      isActive: false,
    })
      .select('-password')
      .sort({ updatedAt: -1 });

    res.json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error('Get disabled users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching disabled users',
    });
  }
});

// @route   GET /api/1win/admin/admins-list
// @desc    Get all admin users (for regular admins to view)
// @access  Private (Admin)
router.get('/admins-list', async (req, res) => {
  try {
    console.log('📋 Fetching admins list...');
    
    // Find users where role is 'admin' OR isAdmin is true
    // This ensures we catch all admins even if there's data inconsistency
    const admins = await User.find({
      $or: [
        { role: 'admin' },
        { isAdmin: true }
      ]
    })
      .select('-password')
      .sort({ createdAt: -1 });

    console.log(`✅ Found ${admins.length} admin(s)`);
    console.log('Admin details:', admins.map(a => ({ 
      email: a.email, 
      role: a.role, 
      isAdmin: a.isAdmin 
    })));

    // Ensure data consistency: if role is 'admin', ensure isAdmin is true
    // Update any inconsistent records
    let updatedCount = 0;
    for (const admin of admins) {
      if (admin.role === 'admin' && !admin.isAdmin) {
        console.log(`🔧 Fixing: ${admin.email} - has role 'admin' but isAdmin is false`);
        admin.isAdmin = true;
        await admin.save();
        updatedCount++;
      } else if (admin.isAdmin && admin.role !== 'admin') {
        console.log(`🔧 Fixing: ${admin.email} - has isAdmin true but role is not 'admin'`);
        admin.role = 'admin';
        await admin.save();
        updatedCount++;
      }
    }

    if (updatedCount > 0) {
      console.log(`✅ Fixed ${updatedCount} inconsistent admin record(s)`);
    }

    res.json({
      success: true,
      data: admins,
    });
  } catch (error) {
    console.error('❌ Get admins list error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching admins',
      error: error.message,
    });
  }
});

// ==================== SUPER ADMIN ROUTES ====================

// @route   GET /api/1win/admin/admins
// @desc    Get all admin users (Super Admin only)
// @access  Private (Super Admin)
router.get('/admins', mainAdminAuth, async (req, res) => {
  try {
    // Find users where role is 'admin' OR isAdmin is true
    // This ensures we catch all admins even if there's data inconsistency
    const admins = await User.find({
      $or: [
        { role: 'admin' },
        { isAdmin: true }
      ]
    })
      .select('-password')
      .sort({ createdAt: -1 });

    // Ensure data consistency: if role is 'admin', ensure isAdmin is true
    // Update any inconsistent records
    for (const admin of admins) {
      if (admin.role === 'admin' && !admin.isAdmin) {
        admin.isAdmin = true;
        await admin.save();
      } else if (admin.isAdmin && admin.role !== 'admin') {
        admin.role = 'admin';
        await admin.save();
      }
    }

    // Get payment stats for each admin
    const adminsWithStats = await Promise.all(
      admins.map(async (admin) => {
        const payments = await PaymentTransaction.find({
          referringAdminId: admin._id,
          status: 'completed',
        });

        const totalAmount = payments.reduce((sum, payment) => sum + payment.amount, 0);
        const totalEarnings = payments.reduce((sum, payment) => sum + payment.referringAdminShare, 0);

        return {
          ...admin.toObject(),
          totalPayments: payments.length,
          totalAmount,
          totalEarnings,
        };
      })
    );

    res.json({
      success: true,
      data: adminsWithStats,
    });
  } catch (error) {
    console.error('Get admins error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching admins',
    });
  }
});

// @route   POST /api/1win/admin/admins
// @desc    Create new admin user (Super Admin only)
// @access  Private (Super Admin)
router.post(
  '/admins',
  mainAdminAuth,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('name').optional().trim(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const { email, password, name } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User already exists with this email',
        });
      }

      // Generate unique invite code
      const inviteCode = await generateUniqueInviteCode();

      // Create admin user
      const admin = await User.create({
        email: email.toLowerCase(),
        password,
        name: name || 'Admin User',
        isAdmin: true,
        role: 'admin', // All admins have 'admin' role
        inviteCode,
      });

      console.log('Admin created:', {
        id: admin._id,
        email: admin.email,
        isAdmin: admin.isAdmin,
        role: admin.role,
        inviteCode: admin.inviteCode,
      });

      const adminResponse = await User.findById(admin._id).select('-password');

      res.status(201).json({
        success: true,
        data: adminResponse,
        message: 'Admin user created successfully',
      });
    } catch (error) {
      console.error('Create admin error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error creating admin',
      });
    }
  }
);

// @route   PUT /api/1win/admin/admins/:id/role
// @desc    Update admin role (Super Admin only)
// @access  Private (Super Admin)
router.put(
  '/admins/:id/role',
  mainAdminAuth,
  [
    body('role').isIn(['admin']).withMessage('Role must be admin'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const { role } = req.body;
      const admin = await User.findById(req.params.id);

      if (!admin || !admin.isAdmin) {
        return res.status(404).json({
          success: false,
          message: 'Admin user not found',
        });
      }

      admin.role = role;
      await admin.save();

      const adminResponse = await User.findById(admin._id).select('-password');

      res.json({
        success: true,
        data: adminResponse,
        message: 'Admin role updated successfully',
      });
    } catch (error) {
      console.error('Update admin role error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error updating admin role',
      });
    }
  }
);

// @route   POST /api/1win/admin/admins/:id/invite-code
// @desc    Generate new invite code for admin (Super Admin only)
// @access  Private (Super Admin)
router.post('/admins/:id/invite-code', mainAdminAuth, async (req, res) => {
  try {
    const admin = await User.findById(req.params.id);

    if (!admin || !admin.isAdmin) {
      return res.status(404).json({
        success: false,
        message: 'Admin user not found',
      });
    }

    // Generate new unique invite code
    const newInviteCode = await generateUniqueInviteCode();
    admin.inviteCode = newInviteCode;
    await admin.save();

    res.json({
      success: true,
      data: {
        inviteCode: newInviteCode,
        inviteLink: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/${newInviteCode}`,
      },
      message: 'Invite code generated successfully',
    });
  } catch (error) {
    console.error('Generate invite code error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error generating invite code',
    });
  }
});

// @route   GET /api/1win/admin/admins/:id/stats
// @desc    Get payment stats for specific admin (Super Admin only)
// @access  Private (Super Admin)
router.get('/admins/:id/stats', mainAdminAuth, async (req, res) => {
  try {
    const admin = await User.findById(req.params.id);

    if (!admin || !admin.isAdmin) {
      return res.status(404).json({
        success: false,
        message: 'Admin user not found',
      });
    }

    const payments = await PaymentTransaction.find({
      referringAdminId: admin._id,
      status: 'completed',
    }).sort({ createdAt: -1 });

    const totalAmount = payments.reduce((sum, payment) => sum + payment.amount, 0);
    const mainAdminShare = payments.reduce((sum, payment) => sum + payment.mainAdminShare, 0);
    const referringAdminShare = payments.reduce((sum, payment) => sum + payment.referringAdminShare, 0);

    res.json({
      success: true,
      data: {
        admin: {
          id: admin._id,
          email: admin.email,
          name: admin.name,
          inviteCode: admin.inviteCode,
        },
        stats: {
          totalPayments: payments.length,
          totalAmount,
          mainAdminShare,
          referringAdminShare,
        },
        payments: payments.map((p) => ({
          id: p._id,
          amount: p.amount,
          currency: p.currency,
          planType: p.planType,
          mainAdminShare: p.mainAdminShare,
          referringAdminShare: p.referringAdminShare,
          createdAt: p.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error('Get admin stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching admin stats',
    });
  }
});

// ==================== ADMIN USER ROUTES ====================

// @route   GET /api/1win/admin/my-invite-link
// @desc    Get own invite link (Any Admin)
// @access  Private (Admin)
router.get('/my-invite-link', adminAuth, async (req, res) => {
  try {
    console.log('📞 /my-invite-link route called');
    const admin = req.user;
    console.log('Admin details:', { 
      id: admin._id, 
      email: admin.email, 
      isAdmin: admin.isAdmin, 
      inviteCode: admin.inviteCode 
    });

    if (!admin.inviteCode) {
      console.log('⚠️ Admin has no invite code');
      return res.status(404).json({
        success: false,
        message: 'Invite code not found. Please contact super admin.',
      });
    }

    // Use the correct frontend URL for 1win_web (user portal)
    const frontendUrl = process.env.ONEWIN_FRONTEND_URL || 'http://localhost:5177';
    const inviteLink = `${frontendUrl}/${admin.inviteCode}`;
    console.log('Generated invite link:', inviteLink);

    res.json({
      success: true,
      data: {
        inviteCode: admin.inviteCode,
        inviteLink,
      },
    });
  } catch (error) {
    console.error('Get invite link error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching invite link',
    });
  }
});

// @route   GET /api/1win/admin/my-earnings
// @desc    Get own earnings from referrals (Any Admin)
// @access  Private (Admin)
router.get('/my-earnings', adminAuth, async (req, res) => {
  try {
    console.log('📞 /my-earnings route called');
    const admin = req.user;
    console.log('Admin ID for earnings:', admin._id);

    const payments = await PaymentTransaction.find({
      referringAdminId: admin._id,
      status: 'completed',
    }).sort({ createdAt: -1 });

    const totalAmount = payments.reduce((sum, payment) => sum + payment.amount, 0);
    const totalEarnings = payments.reduce((sum, payment) => sum + payment.referringAdminShare, 0);

    res.json({
      success: true,
      data: {
        totalPayments: payments.length,
        totalAmount,
        totalEarnings,
        payments: payments.map((p) => ({
          id: p._id,
          amount: p.amount,
          currency: p.currency,
          planType: p.planType,
          earnings: p.referringAdminShare,
          createdAt: p.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error('Get earnings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching earnings',
    });
  }
});

// @route   POST /api/1win/admin/admins/generate-all-invite-codes
// @desc    Generate invite codes for all admins without one (Owner/Admin)
// @access  Private (Admin)
router.post('/admins/generate-all-invite-codes', adminAuth, async (req, res) => {
  try {
    // Get all admins without invite codes
    // Use flexible query to catch all admins (role: 'admin' OR isAdmin: true)
    const adminsWithoutCodes = await User.find({
      $and: [
        {
          $or: [
            { role: 'admin' },
            { isAdmin: true }
          ]
        },
        {
          $or: [
            { inviteCode: { $exists: false } },
            { inviteCode: null },
            { inviteCode: '' }
          ]
        }
      ]
    });

    if (adminsWithoutCodes.length === 0) {
      return res.json({
        success: true,
        message: 'All admins already have invite codes',
        data: { generated: 0 }
      });
    }

    // Generate invite codes for all admins without one
    const results = [];
    for (const admin of adminsWithoutCodes) {
      try {
        const newInviteCode = await generateUniqueInviteCode();
        admin.inviteCode = newInviteCode;
        await admin.save();
        results.push({
          adminId: admin._id,
          email: admin.email,
          inviteCode: newInviteCode,
          success: true
        });
      } catch (error) {
        console.error(`Error generating code for admin ${admin.email}:`, error);
        results.push({
          adminId: admin._id,
          email: admin.email,
          success: false,
          error: error.message
        });
      }
    }

    const successful = results.filter(r => r.success).length;
    const frontendUrl = process.env.ONEWIN_FRONTEND_URL || 'http://localhost:5177';

    res.json({
      success: true,
      message: `Invite codes generated for ${successful} admin(s)`,
      data: {
        generated: successful,
        total: adminsWithoutCodes.length,
        results: results.map(r => ({
          ...r,
          inviteLink: r.inviteCode ? `${frontendUrl}/${r.inviteCode}` : null
        }))
      }
    });
  } catch (error) {
    console.error('Generate all invite codes error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error generating invite codes',
    });
  }
});

// @route   GET /api/1win/admin/my-referred-users
// @desc    Get users who registered via admin's invite link and their payment status
// @access  Private (Admin)
router.get('/my-referred-users', adminAuth, async (req, res) => {
  try {
    console.log('📞 /my-referred-users route called');
    const admin = req.user;
    console.log('Admin ID for referred users:', admin._id);

    // Get all users referred by this admin
    const referredUsers = await User.find({
      referredBy: admin._id,
    })
      .select('-password')
      .sort({ createdAt: -1 });

    // Get payment transactions for these users
    const userIds = referredUsers.map(u => u._id);
    const payments = await PaymentTransaction.find({
      userId: { $in: userIds },
      status: 'completed',
    }).sort({ createdAt: -1 });

    // Create a map of user payments
    const userPaymentsMap = {};
    payments.forEach(payment => {
      const userId = payment.userId.toString();
      if (!userPaymentsMap[userId]) {
        userPaymentsMap[userId] = [];
      }
      userPaymentsMap[userId].push(payment);
    });

    // Combine user data with payment status
    const usersWithPaymentStatus = referredUsers.map(user => {
      const userPayments = userPaymentsMap[user._id.toString()] || [];
      const hasActiveSubscription = user.subscriptionExpiresAt && new Date(user.subscriptionExpiresAt) > new Date();
      const totalPaid = userPayments.reduce((sum, p) => sum + p.amount, 0);
      const lastPayment = userPayments.length > 0 ? userPayments[0] : null;

      return {
        id: user._id,
        email: user.email,
        phone: user.phone,
        name: user.name,
        accountId: user.accountId,
        registeredAt: user.createdAt,
        subscriptionType: user.subscriptionType,
        subscriptionExpiresAt: user.subscriptionExpiresAt,
        hasActiveSubscription,
        paymentStatus: hasActiveSubscription ? 'paid' : (userPayments.length > 0 ? 'expired' : 'not_paid'),
        totalPayments: userPayments.length,
        totalPaid,
        lastPayment: lastPayment ? {
          planType: lastPayment.planType,
          amount: lastPayment.amount,
          currency: lastPayment.currency,
          date: lastPayment.createdAt,
        } : null,
      };
    });

    res.json({
      success: true,
      data: {
        totalReferredUsers: referredUsers.length,
        paidUsers: usersWithPaymentStatus.filter(u => u.hasActiveSubscription).length,
        unpaidUsers: usersWithPaymentStatus.filter(u => !u.hasActiveSubscription && u.totalPayments === 0).length,
        expiredUsers: usersWithPaymentStatus.filter(u => !u.hasActiveSubscription && u.totalPayments > 0).length,
        users: usersWithPaymentStatus,
      },
    });
  } catch (error) {
    console.error('Get referred users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching referred users',
    });
  }
});

module.exports = router;

