const jwt = require('jsonwebtoken');

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET || process.env.JWT_SECRET_1WIN || 'your-secret-key-change-in-production', {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  });
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET || process.env.JWT_SECRET_1WIN || 'your-secret-key-change-in-production');
  } catch (error) {
    return null;
  }
};

module.exports = { generateToken, verifyToken };

