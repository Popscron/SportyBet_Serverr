const MaxBonus = require("../../models/MaxBonus");

async function listByUser(query) {
  try {
    const { userId } = query;

    if (!userId) {
      return {
        status: 400,
        json: {
          success: false,
          error: "userId is required",
        },
      };
    }

    const maxBonuses = await MaxBonus.find({ userId }).sort({ createdAt: -1 });

    return {
      status: 200,
      json: {
        success: true,
        data: maxBonuses,
        count: maxBonuses.length,
      },
    };
  } catch (error) {
    console.error("Error fetching max bonuses:", error);
    return {
      status: 500,
      json: {
        success: false,
        error: "Failed to fetch max bonuses",
        message: error.message,
      },
    };
  }
}

async function getByBookingCode(query) {
  try {
    const { userId, bookingCode } = query;

    if (!userId || !bookingCode) {
      return {
        status: 400,
        json: {
          success: false,
          error: "userId and bookingCode are required",
        },
      };
    }

    const maxBonus = await MaxBonus.findOne({
      userId,
      bookingCode: bookingCode.trim(),
    });

    if (!maxBonus) {
      return {
        status: 200,
        json: {
          success: true,
          data: null,
          message: "No max bonus found for this booking code",
        },
      };
    }

    return {
      status: 200,
      json: {
        success: true,
        data: maxBonus,
      },
    };
  } catch (error) {
    console.error("Error fetching max bonus by booking code:", error);
    return {
      status: 500,
      json: {
        success: false,
        error: "Failed to fetch max bonus",
        message: error.message,
      },
    };
  }
}

async function create(body) {
  try {
    const { userId, bookingCode, maxBonusPercentage } = body;

    if (!userId || !bookingCode || maxBonusPercentage === undefined) {
      return {
        status: 400,
        json: {
          success: false,
          error: "userId, bookingCode, and maxBonusPercentage are required",
        },
      };
    }

    if (maxBonusPercentage < 0 || maxBonusPercentage > 100) {
      return {
        status: 400,
        json: {
          success: false,
          error: "maxBonusPercentage must be between 0 and 100",
        },
      };
    }

    const existing = await MaxBonus.findOne({
      userId,
      bookingCode: bookingCode.trim(),
    });

    if (existing) {
      return {
        status: 400,
        json: {
          success: false,
          error: "Max bonus already exists for this booking code",
        },
      };
    }

    const maxBonus = new MaxBonus({
      userId,
      bookingCode: bookingCode.trim(),
      maxBonusPercentage,
    });

    await maxBonus.save();

    return {
      status: 201,
      json: {
        success: true,
        data: maxBonus,
        message: "Max bonus created successfully",
      },
    };
  } catch (error) {
    console.error("Error creating max bonus:", error);
    if (error.code === 11000) {
      return {
        status: 400,
        json: {
          success: false,
          error: "Max bonus already exists for this booking code",
        },
      };
    }
    return {
      status: 500,
      json: {
        success: false,
        error: "Failed to create max bonus",
        message: error.message,
      },
    };
  }
}

async function update(id, body) {
  try {
    const { maxBonusPercentage } = body;

    if (maxBonusPercentage === undefined) {
      return {
        status: 400,
        json: {
          success: false,
          error: "maxBonusPercentage is required",
        },
      };
    }

    if (maxBonusPercentage < 0 || maxBonusPercentage > 100) {
      return {
        status: 400,
        json: {
          success: false,
          error: "maxBonusPercentage must be between 0 and 100",
        },
      };
    }

    const maxBonus = await MaxBonus.findByIdAndUpdate(
      id,
      { maxBonusPercentage, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );

    if (!maxBonus) {
      return {
        status: 404,
        json: {
          success: false,
          error: "Max bonus not found",
        },
      };
    }

    return {
      status: 200,
      json: {
        success: true,
        data: maxBonus,
        message: "Max bonus updated successfully",
      },
    };
  } catch (error) {
    console.error("Error updating max bonus:", error);
    return {
      status: 500,
      json: {
        success: false,
        error: "Failed to update max bonus",
        message: error.message,
      },
    };
  }
}

async function remove(id) {
  try {
    const maxBonus = await MaxBonus.findByIdAndDelete(id);

    if (!maxBonus) {
      return {
        status: 404,
        json: {
          success: false,
          error: "Max bonus not found",
        },
      };
    }

    return {
      status: 200,
      json: {
        success: true,
        message: "Max bonus deleted successfully",
      },
    };
  } catch (error) {
    console.error("Error deleting max bonus:", error);
    return {
      status: 500,
      json: {
        success: false,
        error: "Failed to delete max bonus",
        message: error.message,
      },
    };
  }
}

module.exports = {
  listByUser,
  getByBookingCode,
  create,
  update,
  remove,
};
