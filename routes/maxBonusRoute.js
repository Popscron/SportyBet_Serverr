const express = require("express");
const router = express.Router();
const MaxBonus = require("../models/MaxBonus");

// GET /api/max-bonus - Get all max bonuses for a user
router.get("/max-bonus", async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "userId is required",
      });
    }

    const maxBonuses = await MaxBonus.find({ userId })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: maxBonuses,
      count: maxBonuses.length,
    });
  } catch (error) {
    console.error("Error fetching max bonuses:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch max bonuses",
      message: error.message,
    });
  }
});

// GET /api/max-bonus/by-booking-code - Get max bonus for a specific booking code
router.get("/max-bonus/by-booking-code", async (req, res) => {
  try {
    const { userId, bookingCode } = req.query;

    if (!userId || !bookingCode) {
      return res.status(400).json({
        success: false,
        error: "userId and bookingCode are required",
      });
    }

    const maxBonus = await MaxBonus.findOne({
      userId,
      bookingCode: bookingCode.trim(),
    });

    if (!maxBonus) {
      return res.status(200).json({
        success: true,
        data: null,
        message: "No max bonus found for this booking code",
      });
    }

    res.status(200).json({
      success: true,
      data: maxBonus,
    });
  } catch (error) {
    console.error("Error fetching max bonus by booking code:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch max bonus",
      message: error.message,
    });
  }
});

// POST /api/max-bonus - Create a new max bonus
router.post("/max-bonus", async (req, res) => {
  try {
    const { userId, bookingCode, maxBonusPercentage } = req.body;

    if (!userId || !bookingCode || maxBonusPercentage === undefined) {
      return res.status(400).json({
        success: false,
        error: "userId, bookingCode, and maxBonusPercentage are required",
      });
    }

    if (maxBonusPercentage < 0 || maxBonusPercentage > 100) {
      return res.status(400).json({
        success: false,
        error: "maxBonusPercentage must be between 0 and 100",
      });
    }

    // Check if max bonus already exists for this booking code
    const existing = await MaxBonus.findOne({
      userId,
      bookingCode: bookingCode.trim(),
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        error: "Max bonus already exists for this booking code",
      });
    }

    const maxBonus = new MaxBonus({
      userId,
      bookingCode: bookingCode.trim(),
      maxBonusPercentage,
    });

    await maxBonus.save();

    res.status(201).json({
      success: true,
      data: maxBonus,
      message: "Max bonus created successfully",
    });
  } catch (error) {
    console.error("Error creating max bonus:", error);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: "Max bonus already exists for this booking code",
      });
    }
    res.status(500).json({
      success: false,
      error: "Failed to create max bonus",
      message: error.message,
    });
  }
});

// PUT /api/max-bonus/:id - Update a max bonus
router.put("/max-bonus/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { maxBonusPercentage } = req.body;

    if (maxBonusPercentage === undefined) {
      return res.status(400).json({
        success: false,
        error: "maxBonusPercentage is required",
      });
    }

    if (maxBonusPercentage < 0 || maxBonusPercentage > 100) {
      return res.status(400).json({
        success: false,
        error: "maxBonusPercentage must be between 0 and 100",
      });
    }

    const maxBonus = await MaxBonus.findByIdAndUpdate(
      id,
      { maxBonusPercentage, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );

    if (!maxBonus) {
      return res.status(404).json({
        success: false,
        error: "Max bonus not found",
      });
    }

    res.status(200).json({
      success: true,
      data: maxBonus,
      message: "Max bonus updated successfully",
    });
  } catch (error) {
    console.error("Error updating max bonus:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update max bonus",
      message: error.message,
    });
  }
});

// DELETE /api/max-bonus/:id - Delete a max bonus
router.delete("/max-bonus/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const maxBonus = await MaxBonus.findByIdAndDelete(id);

    if (!maxBonus) {
      return res.status(404).json({
        success: false,
        error: "Max bonus not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Max bonus deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting max bonus:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete max bonus",
      message: error.message,
    });
  }
});

module.exports = router;

