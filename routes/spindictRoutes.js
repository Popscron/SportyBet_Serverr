const express = require('express');
const router = express.Router();
const SpindictTransaction = require('../models/SpindictTransaction');
const User = require('../models/user');
const authMiddleware = require('../middleware/authMiddleware');

// Admin middleware
const adminProtect = async (req, res, next) => {
  try {
    // First verify auth
    await authMiddleware(req, res, () => {});
    
    // Then check if admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }
    next();
  } catch (error) {
    res.status(401).json({ message: 'Authentication failed' });
  }
};

// @route   POST /api/spindict/transactions
// @desc    Create a new transaction (when user selects package)
// @access  Private
router.post('/transactions', authMiddleware, async (req, res) => {
  try {
    const { amount, packageType, paymentMethod } = req.body;

    if (!amount || !packageType) {
      return res.status(400).json({ message: 'Amount and package type are required' });
    }

    const transaction = new SpindictTransaction({
      user: req.user._id,
      amount,
      packageType,
      paymentMethod: paymentMethod || 'Online',
      status: 'pending',
    });

    await transaction.save();
    await transaction.populate('user', 'name email');

    res.status(201).json({
      success: true,
      transaction,
    });
  } catch (error) {
    console.error('Create transaction error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/spindict/transactions
// @desc    Get user's transactions
// @access  Private
router.get('/transactions', authMiddleware, async (req, res) => {
  try {
    const transactions = await SpindictTransaction.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .populate('user', 'name email');

    res.json({
      success: true,
      transactions,
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/spindict/transactions/:id/status
// @desc    Update transaction status
// @access  Private (Admin)
router.put('/transactions/:id/status', adminProtect, async (req, res) => {
  try {
    const { status } = req.body;
    const { id } = req.params;

    if (!['pending', 'completed', 'failed'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const updateData = { status };
    if (status === 'completed') {
      updateData.completedAt = new Date();
    }

    const transaction = await SpindictTransaction.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).populate('user', 'name email');

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    res.json({
      success: true,
      transaction,
    });
  } catch (error) {
    console.error('Update transaction error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/spindict/admin/users
// @desc    Get all registered users (Spindict only)
// @access  Private (Admin)
router.get('/admin/users', adminProtect, async (req, res) => {
  try {
    const users = await User.find({ platform: 'spindict' })
      .select('-password -token')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      users,
      total: users.length,
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/spindict/admin/paid-users
// @desc    Get all users who have completed transactions
// @access  Private (Admin)
router.get('/admin/paid-users', adminProtect, async (req, res) => {
  try {
    const paidUserIds = await SpindictTransaction.distinct('user', {
      status: 'completed',
    });

    const paidUsers = await User.find({ _id: { $in: paidUserIds } })
      .select('-password -token')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      users: paidUsers,
      total: paidUsers.length,
    });
  } catch (error) {
    console.error('Get paid users error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/spindict/admin/statistics
// @desc    Get admin statistics (revenue, user stats, package analytics) - Spindict only
// @access  Private (Admin)
router.get('/admin/statistics', adminProtect, async (req, res) => {
  try {
    // Total registered users (Spindict only)
    const totalUsers = await User.countDocuments({ platform: 'spindict' });

    // Total paid users (users with at least one completed transaction) - Spindict only
    const paidUserIds = await SpindictTransaction.distinct('user', {
      status: 'completed',
    });
    // Filter to only count spindict users
    const spindictPaidUserIds = await User.find({
      _id: { $in: paidUserIds },
      platform: 'spindict'
    }).distinct('_id');
    const totalPaidUsers = spindictPaidUserIds.length;

    // Total revenue (sum of all completed transactions)
    const revenueResult = await SpindictTransaction.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const totalRevenue = revenueResult[0]?.total || 0;

    // Package analytics
    const packageStats = await SpindictTransaction.aggregate([
      { $match: { status: 'completed' } },
      {
        $group: {
          _id: '$packageType',
          count: { $sum: 1 },
          revenue: { $sum: '$amount' },
        },
      },
    ]);

    // Transaction status breakdown
    const statusStats = await SpindictTransaction.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    // Recent transactions (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentTransactions = await SpindictTransaction.countDocuments({
      createdAt: { $gte: thirtyDaysAgo },
    });

    res.json({
      success: true,
      statistics: {
        totalUsers,
        totalPaidUsers,
        totalRevenue,
        packageStats,
        statusStats,
        recentTransactions,
      },
    });
  } catch (error) {
    console.error('Get statistics error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/spindict/admin/transactions
// @desc    Get all transactions (admin view)
// @access  Private (Admin)
router.get('/admin/transactions', adminProtect, async (req, res) => {
  try {
    const transactions = await SpindictTransaction.find()
      .populate('user', 'name email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      transactions,
      total: transactions.length,
    });
  } catch (error) {
    console.error('Get all transactions error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
