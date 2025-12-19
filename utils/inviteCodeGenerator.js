const User = require('../models/1win/User');

/**
 * Generate a unique 2-character alphanumeric invite code
 * @returns {Promise<string>} Unique invite code
 */
async function generateUniqueInviteCode() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let attempts = 0;
  const maxAttempts = 1000; // Prevent infinite loop

  while (attempts < maxAttempts) {
    // Generate random 2-character code
    let code = '';
    for (let i = 0; i < 2; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    // Check if code already exists
    const existingUser = await User.findOne({ inviteCode: code });
    if (!existingUser) {
      return code;
    }

    attempts++;
  }

  throw new Error('Failed to generate unique invite code after maximum attempts');
}

module.exports = { generateUniqueInviteCode };





