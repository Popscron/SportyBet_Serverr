const ManualCard = require("../../models/ManualCard");

async function create(body) {
  try {
    const { phone, amount, minute, sport = "Sports", duration } = body;

    if (!phone || !amount || !minute || !duration) {
      return {
        status: 400,
        json: {
          success: false,
          message: "Missing required fields: phone, amount, minute, duration",
        },
      };
    }

    const amountNum = parseFloat(amount);
    const minuteNum = parseInt(minute, 10);
    const durationNum = parseInt(duration, 10);

    if (isNaN(amountNum) || amountNum <= 0) {
      return {
        status: 400,
        json: { success: false, message: "Amount must be a positive number" },
      };
    }

    if (isNaN(minuteNum) || minuteNum < 0) {
      return {
        status: 400,
        json: {
          success: false,
          message: "Minute must be a non-negative number",
        },
      };
    }

    if (isNaN(durationNum) || durationNum <= 0) {
      return {
        status: 400,
        json: {
          success: false,
          message: "Duration must be a positive number",
        },
      };
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationNum * 60 * 1000);

    const manualCard = new ManualCard({
      phone: phone.trim(),
      amount: amountNum,
      minute: minuteNum,
      sport: sport.trim(),
      duration: durationNum,
      timeAgo: `${minuteNum} minutes ago`,
      expiresAt,
    });

    await manualCard.save();

    return {
      status: 201,
      json: {
        success: true,
        message: "Manual card created successfully",
        data: manualCard,
      },
    };
  } catch (error) {
    console.error("Error creating manual card:", error);
    return {
      status: 500,
      json: {
        success: false,
        message: "Internal server error",
        error: error.message,
      },
    };
  }
}

async function listActive() {
  try {
    const now = new Date();

    const activeCards = await ManualCard.find({
      expiresAt: { $gt: now },
      isActive: true,
    }).sort({ createdAt: -1 });

    return {
      status: 200,
      json: {
        success: true,
        data: activeCards,
        count: activeCards.length,
      },
    };
  } catch (error) {
    console.error("Error fetching manual cards:", error);
    return {
      status: 500,
      json: {
        success: false,
        message: "Internal server error",
        error: error.message,
      },
    };
  }
}

async function listForBroadcast() {
  try {
    const now = new Date();

    const activeCards = await ManualCard.find({
      expiresAt: { $gt: now },
      isActive: true,
    }).sort({ createdAt: -1 });

    const formattedCards = activeCards.map((card) => ({
      phone: card.phone,
      amount: card.amount.toFixed(2),
      timeAgo: card.timeAgo,
      sport: card.sport,
      isManual: true,
    }));

    return {
      status: 200,
      json: {
        success: true,
        data: formattedCards,
        count: formattedCards.length,
      },
    };
  } catch (error) {
    console.error("Error fetching broadcast cards:", error);
    return {
      status: 500,
      json: {
        success: false,
        message: "Internal server error",
        error: error.message,
      },
    };
  }
}

async function update(id, body) {
  try {
    const updateData = { ...body };
    delete updateData.createdAt;
    delete updateData._id;

    const updatedCard = await ManualCard.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!updatedCard) {
      return {
        status: 404,
        json: { success: false, message: "Manual card not found" },
      };
    }

    return {
      status: 200,
      json: {
        success: true,
        message: "Manual card updated successfully",
        data: updatedCard,
      },
    };
  } catch (error) {
    console.error("Error updating manual card:", error);
    return {
      status: 500,
      json: {
        success: false,
        message: "Internal server error",
        error: error.message,
      },
    };
  }
}

async function remove(id) {
  try {
    const deletedCard = await ManualCard.findByIdAndDelete(id);

    if (!deletedCard) {
      return {
        status: 404,
        json: { success: false, message: "Manual card not found" },
      };
    }

    return {
      status: 200,
      json: {
        success: true,
        message: "Manual card deleted successfully",
      },
    };
  } catch (error) {
    console.error("Error deleting manual card:", error);
    return {
      status: 500,
      json: {
        success: false,
        message: "Internal server error",
        error: error.message,
      },
    };
  }
}

async function deactivate(id) {
  try {
    const updatedCard = await ManualCard.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );

    if (!updatedCard) {
      return {
        status: 404,
        json: { success: false, message: "Manual card not found" },
      };
    }

    return {
      status: 200,
      json: {
        success: true,
        message: "Manual card deactivated successfully",
        data: updatedCard,
      },
    };
  } catch (error) {
    console.error("Error deactivating manual card:", error);
    return {
      status: 500,
      json: {
        success: false,
        message: "Internal server error",
        error: error.message,
      },
    };
  }
}

async function cleanupExpired() {
  try {
    const now = new Date();

    const result = await ManualCard.updateMany(
      {
        expiresAt: { $lte: now },
        isActive: true,
      },
      { isActive: false }
    );

    return {
      status: 200,
      json: {
        success: true,
        message: `Cleaned up ${result.modifiedCount} expired cards`,
        modifiedCount: result.modifiedCount,
      },
    };
  } catch (error) {
    console.error("Error cleaning up expired cards:", error);
    return {
      status: 500,
      json: {
        success: false,
        message: "Internal server error",
        error: error.message,
      },
    };
  }
}

module.exports = {
  create,
  listActive,
  listForBroadcast,
  update,
  remove,
  deactivate,
  cleanupExpired,
};
