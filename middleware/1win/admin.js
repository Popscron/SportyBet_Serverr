const { verifyToken } = require('../../config/1win/jwt');
const User = require('../../models/1win/User');

const adminAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized. Token required.',
      });
    }

    // Verify token
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
      });
    }

    // Get user and check if admin
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check if user is admin - accept either isAdmin: true OR role: 'admin'
    // This handles data inconsistencies where role might be set but isAdmin is not
    const isAdminUser = user.isAdmin || user.role === 'admin';
    
    if (!isAdminUser) {
      console.log('Admin auth failed - user is not admin:', {
        email: user.email,
        isAdmin: user.isAdmin,
        role: user.role
      });
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.',
      });
    }

    // Fix data inconsistency: if role is 'admin' but isAdmin is false, update it
    if (user.role === 'admin' && !user.isAdmin) {
      console.log('🔧 Fixing admin data inconsistency for:', user.email);
      user.isAdmin = true;
      await user.save();
    }

    // Add user to request
    req.user = user;
    next();
  } catch (error) {
    console.error('Admin auth error:', error);
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access admin routes',
    });
  }
};

// Main admin auth - for managing other admins (first admin created)
const mainAdminAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized. Token required.',
      });
    }

    // Verify token
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
      });
    }

    // Get user and check if main admin (first admin or has no inviteCode)
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
      });
    }

    if (!user.isAdmin || user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.',
      });
    }

    // Main admin is the one without an invite code (the first admin who manages others)
    // Check if user is main admin (no invite code means they're the main admin)
    // inviteCode should be null, undefined, or empty string for main admin
    if (user.inviteCode && user.inviteCode.toString().trim() !== '') {
      console.log('Main admin check failed - user has invite code:', user.inviteCode, 'Email:', user.email);
      return res.status(403).json({
        success: false,
        message: 'Access denied. Main admin privileges required.',
      });
    }
    
    console.log('Main admin check passed - user has no invite code. Email:', user.email);

    // Add user to request
    req.user = user;
    next();
  } catch (error) {
    console.error('Main admin auth error:', error);
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access main admin routes',
    });
  }
};

module.exports = { adminAuth, mainAdminAuth };

