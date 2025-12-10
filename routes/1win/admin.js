const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../../models/1win/User');
const { adminAuth } = require('../../middleware/1win/admin');
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

      const { email, phone, password, name, currency, balance, subscriptionType, subscriptionExpiry } = req.body;

      // Validate that at least email or phone is provided
      if (!email && !phone) {
        return res.status(400).json({
          success: false,
          message: 'Either email or phone number is required',
        });
      }

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
    body('phone').optional().isMobilePhone(),
    body('name').optional().trim(),
    body('currency').optional().isIn(['GHS', 'PKR', 'USD', 'EUR', 'NGN', 'INR']),
    body('balance').optional().isFloat({ min: 0 }),
    body('subscriptionType').optional().custom((value) => {
      if (value === '' || value === null || value === undefined) return true;
      return ['1month', '3months'].includes(value);
    }),
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

      const { email, phone, name, currency, balance, subscriptionType, subscriptionExpiry, isActive } = req.body;
      
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
      if (phone !== undefined) user.phone = phone;
      if (name !== undefined) user.name = name;
      if (currency !== undefined) user.currency = currency;
      if (balance !== undefined) user.balance = parseFloat(balance);
      if (normalizedSubscriptionType !== undefined) user.subscriptionType = normalizedSubscriptionType;
      if (subscriptionExpiry !== undefined) {
        user.subscriptionExpiry = subscriptionExpiry === '' || subscriptionExpiry === null ? null : subscriptionExpiry;
      }
      if (isActive !== undefined) user.isActive = isActive;

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

module.exports = router;

