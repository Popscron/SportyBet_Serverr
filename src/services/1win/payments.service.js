const User = require("../../../models/1win/User");
const PendingPayment = require("../../../models/1win/PendingPayment");
const PaymentTransaction = require("../../../models/1win/PaymentTransaction");
const Transaction = require("../../../models/1win/Transaction");
const { sendPaymentConfirmationEmail } = require("../../../utils/emailService");

function generateReference() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

function parseMobileMoneySMS(message) {
  try {
    const isMTN = /Payment received/i.test(message) || /MTN/i.test(message);
    const isMTNFormat = /MTN|Dear Customer/i.test(message);

    const amountMatch =
      message.match(/GHS\s*([\d,]+\.?\d{2})/i) || message.match(/for\s*GHS\s*([\d,]+\.?\d{2})/i);

    let transactionId = null;
    let reference = null;
    let senderPhone = null;
    let recipientPhone = null;
    let senderName = null;
    let isReceived = false;
    let isSent = false;

    if (isMTN) {
      isReceived = /Payment received/i.test(message);
      isSent = /Payment sent/i.test(message);

      const transIdMatch = message.match(/[Tt]ransaction\s*[Ii][Dd][:\s]+([0-9]+)/i);
      transactionId = transIdMatch ? transIdMatch[1].trim() : null;

      const refMatch = message.match(/[Rr]eference[:\s]+([A-Z0-9.]+)/i);
      reference = refMatch ? refMatch[1].trim().replace(/\.$/, "") : null;

      const nameMatch = message.match(/from\s+([A-Z\s]+?)(?:\s+Current|$)/i);
      senderName = nameMatch ? nameMatch[1].trim() : null;
    } else if (isMTNFormat) {
      isReceived = /received/i.test(message);
      isSent = /sent/i.test(message);

      const transIdMatch = message.match(/[Tt]rans\s*[Ii][Dd][:\s]+([A-Z0-9.]+)/i);
      transactionId = transIdMatch ? transIdMatch[1].trim() : null;

      if (isReceived) {
        const senderMatch =
          message.match(/from\s*(\+?233\d{9}|\d{10})/i) || message.match(/(\+?233\d{9}|\d{10})/);
        senderPhone = senderMatch ? senderMatch[1].replace(/^\+233/, "0") : null;
      } else if (isSent) {
        const recipientMatch =
          message.match(/mobile\s*money\s*wallet\s*(\+?233\d{9}|\d{10})/i) ||
          message.match(/to\s+[^,]+,\s*mobile\s*money\s*wallet\s*(\+?233\d{9}|\d{10})/i);
        recipientPhone = recipientMatch ? recipientMatch[1].replace(/^\+233/, "0") : null;
      }

      reference = transactionId;
    }

    const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, "")) : null;

    return {
      amount,
      senderPhoneNumber: senderPhone,
      recipientPhoneNumber: recipientPhone,
      senderName,
      transactionId,
      reference: reference || transactionId,
      isReceived,
      isSent,
      provider: isMTN ? "MTN" : isMTNFormat ? "MTN" : "Unknown",
      isValid: !!(amount && transactionId && isReceived),
    };
  } catch (error) {
    console.error("Error parsing SMS:", error);
    return { isValid: false };
  }
}

async function createPayment(userId, body) {
  try {
    const { planType, amount } = body;

    const user = await User.findById(userId);
    if (!user) {
      return { status: 404, json: { success: false, message: "User not found" } };
    }

    let reference;
    let isUnique = false;
    while (!isUnique) {
      reference = generateReference();
      const existing = await PendingPayment.findOne({ reference });
      if (!existing) isUnique = true;
    }

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const phoneNumber = process.env.MOBILE_MONEY_PHONE || "+233539769182";
    const recipientName = process.env.MOBILE_MONEY_NAME || "Agyman alex";

    const pendingPayment = await PendingPayment.create({
      userId,
      planType,
      amount,
      currency: user.currency || "GHS",
      reference,
      phoneNumber,
      expiresAt,
      status: "pending",
    });

    await Transaction.create({
      userId: user._id,
      type: "payment",
      amount: amount,
      currency: user.currency || "GHS",
      status: "pending",
      description: `Payment for ${planType} subscription - Reference: ${reference}`,
      reference: reference,
      metadata: {
        planType: planType,
        pendingPaymentId: pendingPayment._id,
      },
    });

    return {
      status: 200,
      json: {
        success: true,
        data: {
          payment: {
            id: pendingPayment._id,
            planType: pendingPayment.planType,
            amount: pendingPayment.amount,
            currency: pendingPayment.currency,
            reference: pendingPayment.reference,
            phoneNumber: pendingPayment.phoneNumber,
            recipientName: recipientName,
            expiresAt: pendingPayment.expiresAt,
            instructions: `Send ${pendingPayment.currency} ${pendingPayment.amount} to ${recipientName} (${pendingPayment.phoneNumber}) with reference: ${pendingPayment.reference}`,
          },
        },
      },
    };
  } catch (error) {
    console.error("Create payment error:", error);
    return {
      status: 500,
      json: { success: false, message: "Server error creating payment" },
    };
  }
}

async function smsWebhook(body) {
  try {
    const { message, sender, phoneNumber } = body;

    console.log("SMS received:", { message, sender, phoneNumber });

    const parsed = parseMobileMoneySMS(message);

    if (!parsed.isValid) {
      console.log("Invalid SMS format or not a payment message");
      return {
        status: 200,
        json: {
          success: false,
          message: "Invalid SMS format",
        },
      };
    }

    console.log("Parsed transaction:", {
      amount: parsed.amount,
      transactionId: parsed.transactionId,
      provider: parsed.provider,
      isReceived: parsed.isReceived,
      senderName: parsed.senderName,
    });

    const mobileMoneyPhone = process.env.MOBILE_MONEY_PHONE || "+233539769182";

    if (parsed.isSent) {
      console.log("SMS is for money sent, not received. Ignoring.");
      return {
        status: 200,
        json: {
          success: false,
          message: "This is a sent payment SMS, not a received payment",
        },
      };
    }

    const pendingPayment = await PendingPayment.findOne({
      amount: parsed.amount,
      phoneNumber: mobileMoneyPhone,
      status: "pending",
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!pendingPayment) {
      console.log("No pending payment found matching:", {
        amount: parsed.amount,
        phoneNumber: mobileMoneyPhone,
      });

      console.log("Unmatched payment transaction detected:", {
        amount: parsed.amount,
        transactionId: parsed.transactionId,
        provider: parsed.provider,
        senderName: parsed.senderName,
        reason: "No matching pending payment found",
      });

      return {
        status: 200,
        json: {
          success: false,
          message: "No pending payment found matching this transaction",
        },
      };
    }

    if (pendingPayment.isExpired()) {
      pendingPayment.status = "expired";
      await pendingPayment.save();
      return {
        status: 200,
        json: {
          success: false,
          message: "Payment request has expired",
        },
      };
    }

    const amountDifference = Math.abs(pendingPayment.amount - parsed.amount);
    if (amountDifference > 0.01) {
      console.log("Amount mismatch:", {
        expected: pendingPayment.amount,
        received: parsed.amount,
      });
      return {
        status: 200,
        json: {
          success: false,
          message: "Amount mismatch",
        },
      };
    }

    pendingPayment.status = "completed";
    pendingPayment.transactionId = parsed.transactionId;
    pendingPayment.detectedAt = new Date();
    await pendingPayment.save();

    const user = await User.findById(pendingPayment.userId);
    if (!user) {
      return { status: 404, json: { success: false, message: "User not found" } };
    }

    const planDurations = {
      gold: 30,
      diamond: 90,
      platinum: 180,
    };

    const subscriptionExpiresAt = new Date();
    subscriptionExpiresAt.setDate(
      subscriptionExpiresAt.getDate() + planDurations[pendingPayment.planType]
    );

    user.subscriptionType = pendingPayment.planType;
    user.subscriptionExpiresAt = subscriptionExpiresAt;
    await user.save();

    let referringAdminId = null;
    let mainAdminShare = 0;
    let referringAdminShare = 0;

    if (user.referredBy) {
      const referringAdmin = await User.findById(user.referredBy);
      if (referringAdmin && referringAdmin.isAdmin) {
        referringAdminId = referringAdmin._id;
        const splitAmount = pendingPayment.amount / 2;
        mainAdminShare = splitAmount;
        referringAdminShare = splitAmount;

        referringAdmin.totalEarnings = (referringAdmin.totalEarnings || 0) + referringAdminShare;
        await referringAdmin.save();
      }
    }

    await PaymentTransaction.create({
      userId: user._id,
      pendingPaymentId: pendingPayment._id,
      planType: pendingPayment.planType,
      amount: pendingPayment.amount,
      currency: pendingPayment.currency,
      status: "completed",
      reference: pendingPayment.reference,
      smsMessage: message,
      smsSender: sender || phoneNumber,
      detectedAmount: parsed.amount,
      detectedReference: parsed.transactionId,
      senderPhoneNumber: parsed.senderPhoneNumber,
      processedAt: new Date(),
      referringAdminId,
      mainAdminShare,
      referringAdminShare,
    });

    await Transaction.updateOne(
      { reference: pendingPayment.reference, userId: user._id },
      {
        status: "completed",
        description: `Payment completed for ${pendingPayment.planType} subscription`,
      }
    );

    console.log("Payment processed successfully for user:", user.email);

    if (user.email) {
      try {
        await sendPaymentConfirmationEmail(
          user.email,
          user.name || "Valued Customer",
          pendingPayment.planType,
          pendingPayment.amount,
          pendingPayment.currency,
          parsed.transactionId || pendingPayment.reference,
          pendingPayment.reference,
          subscriptionExpiresAt
        );
      } catch (emailError) {
        console.error("Failed to send payment confirmation email:", emailError);
      }
    }

    return {
      status: 200,
      json: {
        success: true,
        message: "Payment processed successfully",
        data: {
          userId: user._id,
          planType: pendingPayment.planType,
          subscriptionExpiresAt,
        },
      },
    };
  } catch (error) {
    console.error("SMS webhook error:", error);
    return {
      status: 500,
      json: {
        success: false,
        message: "Server error processing payment",
      },
    };
  }
}

async function getPaymentStatus(userId, reference) {
  try {
    const pendingPayment = await PendingPayment.findOne({
      reference,
      userId,
    });

    if (!pendingPayment) {
      return {
        status: 404,
        json: { success: false, message: "Payment not found" },
      };
    }

    const now = new Date();
    const expiresAt = new Date(pendingPayment.expiresAt);
    const timeRemaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
    const isExpired = timeRemaining === 0;

    if (isExpired && pendingPayment.status === "pending") {
      pendingPayment.status = "expired";
      await pendingPayment.save();

      await Transaction.updateOne(
        { reference: pendingPayment.reference, userId },
        {
          status: "failed",
          description: `Payment expired after 10 minutes - ${pendingPayment.planType} subscription`,
        }
      );
    }

    const recipientName = process.env.MOBILE_MONEY_NAME || "Agyman alex";

    return {
      status: 200,
      json: {
        success: true,
        data: {
          payment: {
            id: pendingPayment._id,
            planType: pendingPayment.planType,
            amount: pendingPayment.amount,
            currency: pendingPayment.currency,
            reference: pendingPayment.reference,
            phoneNumber: pendingPayment.phoneNumber,
            recipientName: recipientName,
            status: pendingPayment.status,
            expiresAt: pendingPayment.expiresAt,
            timeRemaining,
            isExpired,
            detectedAt: pendingPayment.detectedAt,
            transactionId: pendingPayment.transactionId,
            manualTransactionId: pendingPayment.manualTransactionId,
          },
        },
      },
    };
  } catch (error) {
    console.error("Check payment status error:", error);
    return { status: 500, json: { success: false, message: "Server error" } };
  }
}

async function verifyTransaction(userId, body) {
  try {
    const { reference, transactionId } = body;

    const pendingPayment = await PendingPayment.findOne({
      reference,
      userId,
    });

    if (!pendingPayment) {
      return {
        status: 404,
        json: { success: false, message: "Payment not found" },
      };
    }

    if (pendingPayment.status === "completed") {
      return {
        status: 200,
        json: {
          success: true,
          message: "Payment already verified",
          data: {
            payment: pendingPayment,
          },
        },
      };
    }

    pendingPayment.manualTransactionId = transactionId.trim();

    if (pendingPayment.isExpired()) {
      pendingPayment.status = "expired";
      await pendingPayment.save();

      await Transaction.updateOne(
        { reference: pendingPayment.reference, userId },
        {
          status: "failed",
          description: `Payment expired - ${pendingPayment.planType} subscription`,
        }
      );

      return {
        status: 200,
        json: {
          success: false,
          message: "Payment has expired. Please create a new payment.",
        },
      };
    }

    await pendingPayment.save();

    await Transaction.updateOne(
      { reference: pendingPayment.reference, userId },
      {
        status: "failed",
        description: `Payment verification pending - Transaction ID: ${transactionId.trim()} - ${pendingPayment.planType} subscription`,
      }
    );

    return {
      status: 200,
      json: {
        success: true,
        message: "Transaction ID submitted. Our team will verify it shortly.",
        data: {
          payment: {
            id: pendingPayment._id,
            reference: pendingPayment.reference,
            transactionId: pendingPayment.manualTransactionId,
            status: "failed",
          },
        },
      },
    };
  } catch (error) {
    console.error("Verify transaction error:", error);
    return { status: 500, json: { success: false, message: "Server error" } };
  }
}

async function completePayment(userId, body) {
  try {
    const { reference } = body;

    const pendingPayment = await PendingPayment.findOne({
      reference,
      userId,
      status: "pending",
    });

    if (!pendingPayment) {
      return {
        status: 404,
        json: { success: false, message: "Pending payment not found" },
      };
    }

    if (pendingPayment.isExpired()) {
      pendingPayment.status = "expired";
      await pendingPayment.save();

      await Transaction.updateOne(
        { reference: pendingPayment.reference, userId },
        {
          status: "failed",
          description: `Payment expired - ${pendingPayment.planType} subscription`,
        }
      );

      return {
        status: 400,
        json: {
          success: false,
          message: "Payment has expired. Please create a new payment.",
        },
      };
    }

    const user = await User.findById(userId);
    if (!user) {
      return { status: 404, json: { success: false, message: "User not found" } };
    }

    const planDurations = {
      gold: 30,
      diamond: 30,
      platinum: 30,
    };

    const subscriptionExpiresAt = new Date();
    subscriptionExpiresAt.setDate(
      subscriptionExpiresAt.getDate() + planDurations[pendingPayment.planType]
    );

    pendingPayment.status = "completed";
    pendingPayment.detectedAt = new Date();
    await pendingPayment.save();

    user.subscriptionType = pendingPayment.planType;
    user.subscriptionExpiresAt = subscriptionExpiresAt;
    await user.save();

    let referringAdminId = null;
    let mainAdminShare = 0;
    let referringAdminShare = 0;

    if (user.referredBy) {
      const referringAdmin = await User.findById(user.referredBy);
      if (referringAdmin && referringAdmin.isAdmin) {
        referringAdminId = referringAdmin._id;
        const splitAmount = pendingPayment.amount / 2;
        mainAdminShare = splitAmount;
        referringAdminShare = splitAmount;

        referringAdmin.totalEarnings = (referringAdmin.totalEarnings || 0) + referringAdminShare;
        await referringAdmin.save();
      }
    }

    await Transaction.updateOne(
      { reference: pendingPayment.reference, userId },
      {
        status: "completed",
        description: `Payment completed manually for ${pendingPayment.planType} subscription`,
      }
    );

    await PaymentTransaction.create({
      userId: user._id,
      pendingPaymentId: pendingPayment._id,
      planType: pendingPayment.planType,
      amount: pendingPayment.amount,
      currency: pendingPayment.currency,
      status: "completed",
      reference: pendingPayment.reference,
      processedAt: new Date(),
      referringAdminId,
      mainAdminShare,
      referringAdminShare,
    });

    return {
      status: 200,
      json: {
        success: true,
        message: "Payment marked as completed. Your subscription is now active.",
        data: {
          payment: {
            id: pendingPayment._id,
            reference: pendingPayment.reference,
            status: "completed",
          },
        },
      },
    };
  } catch (error) {
    console.error("Complete payment error:", error);
    return { status: 500, json: { success: false, message: "Server error" } };
  }
}

async function getMyPayments(userId) {
  try {
    const payments = await PaymentTransaction.find({ userId })
      .sort({ createdAt: -1 })
      .limit(50);

    return {
      status: 200,
      json: {
        success: true,
        data: payments,
      },
    };
  } catch (error) {
    console.error("Get payments error:", error);
    return { status: 500, json: { success: false, message: "Server error" } };
  }
}

async function cancelPayment(userId, reference) {
  try {
    const pendingPayment = await PendingPayment.findOne({
      reference,
      userId,
      status: "pending",
    });

    if (!pendingPayment) {
      return {
        status: 404,
        json: { success: false, message: "Pending payment not found" },
      };
    }

    pendingPayment.status = "failed";
    await pendingPayment.save();

    await Transaction.updateOne(
      { reference: pendingPayment.reference, userId },
      {
        status: "cancelled",
        description: `Payment cancelled by user - ${pendingPayment.planType} subscription`,
      }
    );

    return {
      status: 200,
      json: {
        success: true,
        message: "Payment cancelled successfully",
        data: {
          payment: {
            id: pendingPayment._id,
            reference: pendingPayment.reference,
            status: "failed",
          },
        },
      },
    };
  } catch (error) {
    console.error("Cancel payment error:", error);
    return { status: 500, json: { success: false, message: "Server error" } };
  }
}

module.exports = {
  createPayment,
  smsWebhook,
  getPaymentStatus,
  verifyTransaction,
  completePayment,
  getMyPayments,
  cancelPayment,
};
