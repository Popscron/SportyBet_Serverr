const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../../models/1win/User');
const PromoCode = require('../../models/1win/PromoCode');
const Transaction = require('../../models/1win/Transaction');
const Stats = require('../../models/1win/Stats');
const { generateToken } = require('../../config/1win/jwt');
const { protect } = require('../../middleware/1win/auth');
const router = express.Router();

// @route   POST /api/1win/auth/register
// @desc    Register a new user
// @access  Public
router.post(
  '/register',
  [
    body('email').optional().isEmail().normalizeEmail(),
    body('phone').optional().isMobilePhone(),
    body('accountId').optional().isLength({ min: 8, max: 8 }).withMessage('Account ID must be exactly 8 characters'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('currency').optional().isIn(['GHS', 'PKR', 'USD', 'EUR', 'NGN', 'INR']),
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

      const { email, phone, accountId, password, name, currency, promoCode } = req.body;

      // Validate that at least email, phone, or accountId is provided
      if (!email && !phone && !accountId) {
        return res.status(400).json({
          success: false,
          message: 'Either email, phone number, or account ID is required',
        });
      }

      // Check if user already exists
      const queryConditions = [];
      if (email) queryConditions.push({ email: email.toLowerCase() });
      if (phone) queryConditions.push({ phone });
      if (accountId) queryConditions.push({ accountId });
      
      const existingUser = queryConditions.length > 0 
        ? await User.findOne({ $or: queryConditions })
        : null;

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User already exists with this email or phone',
        });
      }

      // Validate promo code if provided
      let bonusAmount = 0;
      if (promoCode) {
        try {
          const promo = await PromoCode.findOne({
            code: promoCode.toUpperCase(),
            isActive: true,
            $or: [{ validUntil: { $gte: new Date() } }, { validUntil: null }],
          });

          if (promo && (promo.maxUses === null || promo.usedCount < promo.maxUses)) {
            if (promo.isPercentage) {
              bonusAmount = (promo.value / 100) * 0; // Will be applied on first deposit
            } else {
              bonusAmount = promo.value;
            }
            promo.usedCount += 1;
            await promo.save();
          }
        } catch (promoError) {
          console.error('Promo code validation error:', promoError);
          // Don't fail registration if promo code lookup fails, just skip bonus
        }
      }

      // Create user
      const userData = {
        password,
        currency: currency || 'GHS',
      };
      
      // Only add fields that are provided
      if (email) userData.email = email.toLowerCase();
      if (phone) userData.phone = phone;
      if (accountId) userData.accountId = accountId;
      if (name) userData.name = name;
      if (promoCode) userData.promoCode = promoCode.toUpperCase();
      
      const user = await User.create(userData);

      // Add bonus if promo code was valid
      if (bonusAmount > 0) {
        user.balance += bonusAmount;
        await user.save();

        await Transaction.create({
          userId: user._id,
          type: 'bonus',
          amount: bonusAmount,
          currency: user.currency,
          status: 'completed',
          description: `Welcome bonus from promo code: ${promoCode}`,
          balanceBefore: 0,
          balanceAfter: bonusAmount,
        });
      }

      const token = generateToken(user._id);

      res.status(201).json({
        success: true,
        data: {
          user: {
            id: user._id,
            email: user.email,
            phone: user.phone,
            name: user.name,
            currency: user.currency,
            balance: user.balance,
          },
          token,
        },
      });
    } catch (error) {
      console.error('Registration error:', error);
      console.error('Error stack:', error.stack);
      
      // Handle duplicate key errors (MongoDB unique constraint violations)
      if (error.code === 11000 || error.name === 'MongoServerError') {
        const field = Object.keys(error.keyPattern || {})[0];
        return res.status(400).json({
          success: false,
          message: `User already exists with this ${field}`,
        });
      }
      
      // Handle validation errors
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: Object.values(error.errors).map(err => ({
            field: err.path,
            message: err.message,
          })),
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Server error during registration',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
);

// @route   POST /api/1win/auth/login
// @desc    Login user
// @access  Public
router.post(
  '/login',
  [
    body('emailOrPhone').notEmpty().withMessage('Email or phone is required'),
    body('password').notEmpty().withMessage('Password is required'),
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

      const { emailOrPhone, password } = req.body;

      console.log('Login attempt:', { emailOrPhone, passwordLength: password?.length });

      // Find user by email, phone, or accountId
      const user = await User.findOne({
        $or: [
          { email: emailOrPhone.toLowerCase() },
          { phone: emailOrPhone },
          { accountId: emailOrPhone },
        ],
      });

      if (!user) {
        console.log('User not found for:', emailOrPhone);
        return res.status(401).json({
          success: false,
          message: 'User does not exist',
        });
      }

      console.log('User found:', { email: user.email, accountId: user.accountId, name: user.name });

      // Check password
      const isMatch = await user.comparePassword(password);
      console.log('Password match:', isMatch);
      
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Credentials wrong',
        });
      }

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      const token = generateToken(user._id);

      res.json({
        success: true,
        data: {
          user: {
            id: user._id,
            email: user.email,
            phone: user.phone,
            name: user.name,
            currency: user.currency,
            balance: user.balance,
            isAdmin: user.isAdmin || false,
            subscriptionType: user.subscriptionType,
            subscriptionExpiresAt: user.subscriptionExpiresAt,
            hasActiveSubscription: user.isSubscriptionActive(),
            accountId: user.accountId,
          },
          token,
        },
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error during login',
      });
    }
  }
);

// @route   GET /api/1win/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');

      res.json({
        success: true,
        data: {
          user: {
            id: user._id,
            email: user.email,
            phone: user.phone,
            name: user.name,
            currency: user.currency,
            balance: user.balance,
            isAdmin: user.isAdmin || false,
            subscriptionType: user.subscriptionType,
            subscriptionExpiresAt: user.subscriptionExpiresAt,
            hasActiveSubscription: user.isSubscriptionActive(),
            accountId: user.accountId,
          },
        },
      });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

// @route   POST /api/1win/auth/admin/login
// @desc    Admin login (same as regular login but checks for admin status)
// @access  Public
router.post(
  '/admin/login',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
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

      const { email, password } = req.body;

      // Find user by email
      const user = await User.findOne({
        email: email.toLowerCase(),
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User does not exist',
        });
      }

      // Check if user is admin
      if (!user.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Admin privileges required.',
        });
      }

      // Check password
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Credentials wrong',
        });
      }

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      const token = generateToken(user._id);

      res.json({
        success: true,
        data: {
          user: {
            id: user._id,
            email: user.email,
            name: user.name,
            isAdmin: true,
          },
          token,
        },
      });
    } catch (error) {
      console.error('Admin login error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error during login',
      });
    }
  }
);

// @route   GET /api/1win/auth/mine-pattern
// @desc    Get user's mine pattern
// @access  Private
router.get('/mine-pattern', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('minePattern minePatternTraps minePatternGeneratedAt subscriptionType subscriptionExpiresAt');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // PAYMENT SYSTEM COMMENTED OUT - Return pattern if it exists, regardless of subscription
    // When payment system is enabled, uncomment the subscription check below
    // const hasActiveSubscription = user.subscriptionExpiresAt && user.subscriptionExpiresAt > new Date();
    // if (!hasActiveSubscription || !user.minePattern || !user.minePatternTraps) {
    //   return res.json({
    //     success: true,
    //     data: {
    //       pattern: null,
    //       traps: null,
    //       message: 'No active pattern found',
    //     },
    //   });
    // }
    
    // Return pattern if it exists
    if (!user.minePattern || !user.minePatternTraps) {
      return res.json({
        success: true,
        data: {
          pattern: null,
          traps: null,
          message: 'No pattern found',
        },
      });
    }

    res.json({
      success: true,
      data: {
        pattern: user.minePattern,
        traps: user.minePatternTraps,
        generatedAt: user.minePatternGeneratedAt,
      },
    });
  } catch (error) {
    console.error('Get mine pattern error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

// @route   POST /api/1win/auth/generate-mine-pattern
// @desc    Generate and store a new mine pattern for user
// @access  Private
router.post('/generate-mine-pattern', protect, async (req, res) => {
  try {
    const { traps, force } = req.body; // Number of traps (1, 3, 5, or 7), force = regenerate even if exists
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Validate traps first
    const validTraps = [1, 3, 5, 7];
    const numTraps = parseInt(traps) || 3;
    
    if (!validTraps.includes(numTraps)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid number of traps. Must be 1, 3, 5, or 7',
      });
    }

    // If pattern already exists and not forcing regeneration, check if trap count matches
    // If trap count doesn't match, force regeneration
    if (user.minePattern && user.minePatternTraps && !force) {
      // If the requested trap count matches existing, return existing pattern
      if (user.minePatternTraps === numTraps) {
        return res.json({
          success: true,
          data: {
            pattern: user.minePattern,
            traps: user.minePatternTraps,
            generatedAt: user.minePatternGeneratedAt,
            message: 'Using existing pattern',
          },
        });
      }
      // If trap count doesn't match, we need to regenerate (treat as force)
      console.log(`Trap count mismatch: existing=${user.minePatternTraps}, requested=${numTraps}. Regenerating pattern.`);
    }

    // Generate mine pattern (5x5 grid = 25 tiles)
    const totalTiles = 25;
    const minePositions = [];
    while (minePositions.length < numTraps) {
      const pos = Math.floor(Math.random() * totalTiles);
      if (!minePositions.includes(pos)) {
        minePositions.push(pos);
      }
    }

    // Store pattern in user document
    user.minePattern = minePositions;
    user.minePatternTraps = numTraps;
    user.minePatternGeneratedAt = new Date();
    await user.save();

    console.log(`Mine pattern generated for user ${user._id}: ${minePositions.join(', ')}`);

    res.json({
      success: true,
      data: {
        pattern: minePositions,
        traps: numTraps,
        generatedAt: user.minePatternGeneratedAt,
      },
    });
  } catch (error) {
    console.error('Generate mine pattern error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

// @route   GET /api/1win/auth/transactions
// @desc    Get user's transaction history
// @access  Private
router.get('/transactions', protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const limit = parseInt(req.query.limit) || 50;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    const transactions = await Transaction.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .select('-metadata');

    const total = await Transaction.countDocuments({ userId });

    res.json({
      success: true,
      data: {
        transactions,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

// @route   PUT /api/1win/auth/update-account-id
// @desc    Update user's 1Win Account ID
// @access  Private
router.put(
  '/update-account-id',
  protect,
  [
    body('accountId')
      .isLength({ min: 8, max: 8 })
      .withMessage('Account ID must be exactly 8 characters')
      .matches(/^\d+$/)
      .withMessage('Account ID must contain only numbers'),
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

      const { accountId } = req.body;
      const user = await User.findById(req.user._id);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      // Check if account ID is already taken by another user
      const existingUser = await User.findOne({
        accountId,
        _id: { $ne: user._id },
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'This Account ID is already registered to another user',
        });
      }

      // Update account ID
      user.accountId = accountId;
      await user.save();

      res.json({
        success: true,
        message: 'Account ID updated successfully',
        data: {
          user: {
            id: user._id,
            accountId: user.accountId,
          },
        },
      });
    } catch (error) {
      console.error('Update account ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error during account ID update',
      });
    }
  }
);

// @route   GET /api/1win/auth/stats
// @desc    Get public statistics (people played today, total people played)
// @access  Public
router.get('/stats', async (req, res) => {
  try {
    // Check and update stats if 24 hours have passed
    const stats = await Stats.checkAndUpdate();

    res.json({
      success: true,
      data: {
        playedToday: stats.playedToday,
        totalPlayed: stats.totalPlayed,
      },
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

// @route   POST /api/1win/auth/logout
// @desc    Logout user (client-side token removal, but endpoint for consistency)
// @access  Private
router.post('/logout', protect, async (req, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully',
  });
});

module.exports = router;

