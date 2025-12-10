const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../../models/1win/User');
const PendingPayment = require('../../models/1win/PendingPayment');
const PaymentTransaction = require('../../models/1win/PaymentTransaction');
const Transaction = require('../../models/1win/Transaction');
const { protect } = require('../../middleware/1win/auth');
const { sendPaymentConfirmationEmail } = require('../../utils/emailService');
const router = express.Router();

// Helper function to generate unique reference
const generateReference = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let reference = '';
  for (let i = 0; i < 8; i++) {
    reference += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return reference;
};

// Helper function to parse Mobile Money SMS (supports AirtelTigo and MTN)
const parseMobileMoneySMS = (message) => {
  try {
    // MTN SMS format example:
    // "Payment received for GHS 100.00 from ENOCK WORNAME Current Balance: GHS 1067.59 . Available Balance: GHS 1067.59. Reference: Q. Transaction ID: 70514217857. TRANSACTION FEE: 0.00"
    
    // AirtelTigo SMS format examples:
    // SENT: "Dear Customer, you have sent GHS 550.00 to PHILIP FIIFI HANSON ,mobile money wallet 0535899507..."
    // RECEIVED: "Dear Customer, you have received GHS 29.99 from 0244123456. Trans ID: GM251127.0930.C09997..."
    
    // Detect provider
    // MTN payment SMS starts with "Payment received for GHS"
    const isMTN = /Payment received/i.test(message) || /MTN/i.test(message);
    const isAirtelTigo = /AirtelTigo|Dear Customer/i.test(message);
    
    // Extract amount (GHS X.XX format) - works for both
    const amountMatch = message.match(/GHS\s*([\d,]+\.?\d{2})/i) || 
                       message.match(/for\s*GHS\s*([\d,]+\.?\d{2})/i);
    
    let transactionId = null;
    let reference = null;
    let senderPhone = null;
    let recipientPhone = null;
    let senderName = null;
    let isReceived = false;
    let isSent = false;
    
    if (isMTN) {
      // MTN Format
      isReceived = /Payment received/i.test(message);
      isSent = /Payment sent/i.test(message);
      
      // Extract Transaction ID (Transaction ID: 70514217857)
      const transIdMatch = message.match(/[Tt]ransaction\s*[Ii][Dd][:\s]+([0-9]+)/i);
      transactionId = transIdMatch ? transIdMatch[1].trim() : null;
      
      // Extract Reference (Reference: Q.)
      const refMatch = message.match(/[Rr]eference[:\s]+([A-Z0-9.]+)/i);
      reference = refMatch ? refMatch[1].trim().replace(/\.$/, '') : null; // Remove trailing dot
      
      // Extract sender name (from ENOCK WORNAME)
      const nameMatch = message.match(/from\s+([A-Z\s]+?)(?:\s+Current|$)/i);
      senderName = nameMatch ? nameMatch[1].trim() : null;
      
      // MTN doesn't always include phone number in received messages
      // We'll match by amount only
      
    } else if (isAirtelTigo) {
      // AirtelTigo Format
      isReceived = /received/i.test(message);
      isSent = /sent/i.test(message);
      
      // Extract Transaction ID (Trans ID: GM251127.0930.C09997)
      const transIdMatch = message.match(/[Tt]rans\s*[Ii][Dd][:\s]+([A-Z0-9.]+)/i);
      transactionId = transIdMatch ? transIdMatch[1].trim() : null;
      
      if (isReceived) {
        // When money is received, extract sender phone
        const senderMatch = message.match(/from\s*(\+?233\d{9}|\d{10})/i) || 
                           message.match(/(\+?233\d{9}|\d{10})/);
        senderPhone = senderMatch ? senderMatch[1].replace(/^\+233/, '0') : null;
      } else if (isSent) {
        // When money is sent, extract recipient phone
        const recipientMatch = message.match(/mobile\s*money\s*wallet\s*(\+?233\d{9}|\d{10})/i) ||
                               message.match(/to\s+[^,]+,\s*mobile\s*money\s*wallet\s*(\+?233\d{9}|\d{10})/i);
        recipientPhone = recipientMatch ? recipientMatch[1].replace(/^\+233/, '0') : null;
      }
      
      reference = transactionId; // Use transaction ID as reference for AirtelTigo
    }
    
    const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : null;
    
    return {
      amount,
      senderPhoneNumber: senderPhone,
      recipientPhoneNumber: recipientPhone,
      senderName,
      transactionId,
      reference: reference || transactionId,
      isReceived,
      isSent,
      provider: isMTN ? 'MTN' : isAirtelTigo ? 'AirtelTigo' : 'Unknown',
      // Valid if: has amount, has transaction ID, and is a received message
      isValid: !!(amount && transactionId && isReceived),
    };
  } catch (error) {
    console.error('Error parsing SMS:', error);
    return { isValid: false };
  }
};

// @route   POST /api/1win/payments/create
// @desc    Create a payment request
// @access  Private
router.post(
  '/create',
  protect,
  [
    body('planType').isIn(['gold', 'diamond', 'platinum']).withMessage('Invalid plan type'),
    body('amount').isNumeric().withMessage('Amount must be a number'),
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

      const { planType, amount } = req.body;
      const userId = req.user._id;

      // Get user
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      // Generate unique reference
      let reference;
      let isUnique = false;
      while (!isUnique) {
        reference = generateReference();
        const existing = await PendingPayment.findOne({ reference });
        if (!existing) isUnique = true;
      }

      // Payment expiration (30 minutes from now)
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

      // Mobile Money phone number (configure this in .env or database)
      const phoneNumber = process.env.MOBILE_MONEY_PHONE || '0244123456';

      // Create pending payment
      const pendingPayment = await PendingPayment.create({
        userId,
        planType,
        amount,
        currency: user.currency || 'GHS',
        reference,
        phoneNumber,
        expiresAt,
        status: 'pending',
      });

      res.json({
        success: true,
        data: {
          payment: {
            id: pendingPayment._id,
            planType: pendingPayment.planType,
            amount: pendingPayment.amount,
            currency: pendingPayment.currency,
            reference: pendingPayment.reference,
            phoneNumber: pendingPayment.phoneNumber,
            expiresAt: pendingPayment.expiresAt,
            instructions: `Send GHS ${pendingPayment.amount} to ${pendingPayment.phoneNumber} with reference: ${pendingPayment.reference}`,
          },
        },
      });
    } catch (error) {
      console.error('Create payment error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error creating payment',
      });
    }
  }
);

// @route   POST /api/1win/payments/sms-webhook
// @desc    Receive SMS from Tasker and process payment
// @access  Public (but should be secured with API key in production)
router.post(
  '/sms-webhook',
  [
    body('message').notEmpty().withMessage('Message is required'),
    body('sender').optional(),
    body('phoneNumber').optional(),
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

      const { message, sender, phoneNumber } = req.body;

      console.log('SMS received:', { message, sender, phoneNumber });

      // Parse SMS to extract transaction details (supports MTN and AirtelTigo)
      const parsed = parseMobileMoneySMS(message);

      if (!parsed.isValid) {
        console.log('Invalid SMS format or not a payment message');
        return res.json({
          success: false,
          message: 'Invalid SMS format',
        });
      }

      console.log('Parsed transaction:', {
        amount: parsed.amount,
        transactionId: parsed.transactionId,
        provider: parsed.provider,
        isReceived: parsed.isReceived,
        senderName: parsed.senderName,
      });

      // Get mobile money phone number from environment
      const mobileMoneyPhone = process.env.MOBILE_MONEY_PHONE || '0535899507';
      
      // Check if this SMS is for money received (not sent)
      // We only process "received" messages on the business phone
      if (parsed.isSent) {
        console.log('SMS is for money sent, not received. Ignoring.');
        return res.json({
          success: false,
          message: 'This is a sent payment SMS, not a received payment',
        });
      }

      // Match pending payment by:
      // 1. Amount (must match exactly)
      // 2. Phone number (must match business phone - this is the phone receiving the SMS)
      // 3. Status (must be pending)
      // 4. Not expired
      // Note: For "received" messages, the SMS is on the business phone, so we match by amount
      const pendingPayment = await PendingPayment.findOne({
        amount: parsed.amount,
        phoneNumber: mobileMoneyPhone, // The business phone receiving the money
        status: 'pending',
        expiresAt: { $gt: new Date() }, // Not expired
      }).sort({ createdAt: -1 }); // Get most recent matching payment

      if (!pendingPayment) {
        console.log('No pending payment found matching:', {
          amount: parsed.amount,
          phoneNumber: mobileMoneyPhone,
        });
        
        // Log the unmatched transaction (without saving to DB since validation would fail)
        console.log('Unmatched payment transaction detected:', {
          amount: parsed.amount,
          transactionId: parsed.transactionId,
          provider: parsed.provider,
          senderName: parsed.senderName,
          reason: 'No matching pending payment found',
        });

        return res.json({
          success: false,
          message: 'No pending payment found matching this transaction',
        });
      }

      // Check if payment is expired
      if (pendingPayment.isExpired()) {
        pendingPayment.status = 'expired';
        await pendingPayment.save();
        return res.json({
          success: false,
          message: 'Payment request has expired',
        });
      }

      // Verify amount matches
      const amountDifference = Math.abs(pendingPayment.amount - parsed.amount);
      if (amountDifference > 0.01) {
        console.log('Amount mismatch:', {
          expected: pendingPayment.amount,
          received: parsed.amount,
        });
        return res.json({
          success: false,
          message: 'Amount mismatch',
        });
      }

      // Payment verified! Update pending payment
      pendingPayment.status = 'completed';
      pendingPayment.transactionId = parsed.transactionId; // Store AirtelTigo Transaction ID
      pendingPayment.detectedAt = new Date();
      await pendingPayment.save();

      // Get user
      const user = await User.findById(pendingPayment.userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      // Calculate subscription expiration based on plan
      const planDurations = {
        gold: 30, // 30 days
        diamond: 90, // 90 days
        platinum: 180, // 180 days
      };

      const subscriptionExpiresAt = new Date();
      subscriptionExpiresAt.setDate(subscriptionExpiresAt.getDate() + planDurations[pendingPayment.planType]);

      // Update user subscription
      user.subscriptionType = pendingPayment.planType;
      user.subscriptionExpiresAt = subscriptionExpiresAt;
      await user.save();

      // Create payment transaction record
      await PaymentTransaction.create({
        userId: user._id,
        pendingPaymentId: pendingPayment._id,
        planType: pendingPayment.planType,
        amount: pendingPayment.amount,
        currency: pendingPayment.currency,
        status: 'completed',
        reference: pendingPayment.reference, // Our generated reference
        smsMessage: message,
        smsSender: sender || phoneNumber,
        detectedAmount: parsed.amount,
        detectedReference: parsed.transactionId, // AirtelTigo Transaction ID
        senderPhoneNumber: parsed.senderPhoneNumber,
        processedAt: new Date(),
      });

      // Create transaction history entry
      await Transaction.create({
        userId: user._id,
        type: 'deposit',
        amount: pendingPayment.amount,
        currency: pendingPayment.currency,
        status: 'completed',
        description: `Payment for ${pendingPayment.planType} subscription`,
        balanceBefore: user.balance,
        balanceAfter: user.balance,
        reference: pendingPayment.reference,
      });

      console.log('Payment processed successfully for user:', user.email);

      // Send payment confirmation email
      if (user.email) {
        try {
          await sendPaymentConfirmationEmail(
            user.email,
            user.name || 'Valued Customer',
            pendingPayment.planType,
            pendingPayment.amount,
            pendingPayment.currency,
            parsed.transactionId || pendingPayment.reference,
            pendingPayment.reference,
            subscriptionExpiresAt
          );
        } catch (emailError) {
          console.error('Failed to send payment confirmation email:', emailError);
          // Don't fail the payment if email fails
        }
      }

      res.json({
        success: true,
        message: 'Payment processed successfully',
        data: {
          userId: user._id,
          planType: pendingPayment.planType,
          subscriptionExpiresAt,
        },
      });
    } catch (error) {
      console.error('SMS webhook error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error processing payment',
      });
    }
  }
);

// @route   GET /api/1win/payments/status/:reference
// @desc    Check payment status
// @access  Private
router.get('/status/:reference', protect, async (req, res) => {
  try {
    const { reference } = req.params;
    const userId = req.user._id;

    const pendingPayment = await PendingPayment.findOne({
      reference,
      userId,
    });

    if (!pendingPayment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found',
      });
    }

    res.json({
      success: true,
      data: {
        payment: {
          id: pendingPayment._id,
          planType: pendingPayment.planType,
          amount: pendingPayment.amount,
          currency: pendingPayment.currency,
          reference: pendingPayment.reference,
          status: pendingPayment.status,
          expiresAt: pendingPayment.expiresAt,
          detectedAt: pendingPayment.detectedAt,
        },
      },
    });
  } catch (error) {
    console.error('Check payment status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

// @route   GET /api/1win/payments/my-payments
// @desc    Get user's payment history
// @access  Private
router.get('/my-payments', protect, async (req, res) => {
  try {
    const userId = req.user._id;

    const payments = await PaymentTransaction.find({ userId })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      success: true,
      data: payments,
    });
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

module.exports = router;

