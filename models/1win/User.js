const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      lowercase: true,
      trim: true,
      sparse: true,
    },
    phone: {
      type: String,
      trim: true,
      sparse: true,
    },
    accountId: {
      type: String,
      unique: true,
      sparse: true,
    },
    name: {
      type: String,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    currency: {
      type: String,
      default: 'GHS',
      enum: ['GHS', 'PKR', 'USD', 'EUR', 'NGN', 'INR'],
    },
    balance: {
      type: Number,
      default: 0,
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
    role: {
      type: String,
      enum: ['admin', 'user'],
      default: 'user',
    },
    inviteCode: {
      type: String,
      unique: true,
      sparse: true,
      uppercase: true,
      match: [/^[A-Z0-9]{2}$/, 'Invite code must be exactly 2 alphanumeric characters'],
    },
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: '1WinUser',
      default: null,
    },
    totalEarnings: {
      type: Number,
      default: 0,
      comment: 'Total earnings from referrals (for admin users)',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    subscriptionType: {
      type: String,
      enum: ['gold', 'diamond', 'platinum', null],
      default: null,
    },
    subscriptionExpiresAt: {
      type: Date,
      default: null,
    },
    promoCode: {
      type: String,
      uppercase: true,
    },
    lastLogin: {
      type: Date,
    },
    minePattern: {
      type: [Number], // Array of mine positions (0-24 for 5x5 grid)
      default: null,
    },
    minePatternTraps: {
      type: Number, // Number of traps in the pattern
      default: null,
    },
    minePatternGeneratedAt: {
      type: Date, // When the pattern was generated
      default: null,
    },
    minePatternRevealedSpots: {
      type: [Number], // Array of 3 safe spot IDs to reveal (0-24 for 5x5 grid)
      default: null,
    },
    registeredFromWebsite: {
      type: Boolean,
      default: false,
      comment: 'True if user registered through the website (1win_web)',
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Check if subscription is active
userSchema.methods.isSubscriptionActive = function () {
  if (!this.subscriptionExpiresAt) return false;
  return this.subscriptionExpiresAt > new Date();
};

module.exports = mongoose.model('1WinUser', userSchema);

