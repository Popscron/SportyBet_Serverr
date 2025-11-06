const express = require('express');
const router = express.Router();
const ManualCard = require('../models/ManualCard');

// Create a new manual card
router.post('/manual-cards', async (req, res) => {
  try {
    const { phone, amount, minute, sport = 'Sports', duration } = req.body;

    // Validation
    if (!phone || !amount || !minute || !duration) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: phone, amount, minute, duration'
      });
    }

    // Validate data types
    const amountNum = parseFloat(amount);
    const minuteNum = parseInt(minute);
    const durationNum = parseInt(duration);

    if (isNaN(amountNum) || amountNum <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be a positive number'
      });
    }

    if (isNaN(minuteNum) || minuteNum < 0) {
      return res.status(400).json({
        success: false,
        message: 'Minute must be a non-negative number'
      });
    }

    if (isNaN(durationNum) || durationNum <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Duration must be a positive number'
      });
    }

    // Calculate expiration time
    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationNum * 60 * 1000); // Convert minutes to milliseconds

    // Create manual card
    const manualCard = new ManualCard({
      phone: phone.trim(),
      amount: amountNum,
      minute: minuteNum,
      sport: sport.trim(),
      duration: durationNum,
      timeAgo: `${minuteNum} minutes ago`,
      expiresAt: expiresAt
    });

    await manualCard.save();

    res.status(201).json({
      success: true,
      message: 'Manual card created successfully',
      data: manualCard
    });

  } catch (error) {
    console.error('Error creating manual card:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get all active manual cards
router.get('/manual-cards', async (req, res) => {
  try {
    const now = new Date();
    
    // Get active cards (not expired and isActive = true)
    const activeCards = await ManualCard.find({
      expiresAt: { $gt: now },
      isActive: true
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: activeCards,
      count: activeCards.length
    });

  } catch (error) {
    console.error('Error fetching manual cards:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get manual cards for broadcast (combined with API data)
router.get('/manual-cards/broadcast', async (req, res) => {
  try {
    const now = new Date();
    
    // Get active cards
    const activeCards = await ManualCard.find({
      expiresAt: { $gt: now },
      isActive: true
    }).sort({ createdAt: -1 });

    // Format for broadcast display
    const formattedCards = activeCards.map(card => ({
      phone: card.phone,
      amount: card.amount.toFixed(2),
      timeAgo: card.timeAgo,
      sport: card.sport,
      isManual: true
    }));

    res.status(200).json({
      success: true,
      data: formattedCards,
      count: formattedCards.length
    });

  } catch (error) {
    console.error('Error fetching broadcast cards:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Update manual card
router.put('/manual-cards/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Remove fields that shouldn't be updated
    delete updateData.createdAt;
    delete updateData._id;

    const updatedCard = await ManualCard.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedCard) {
      return res.status(404).json({
        success: false,
        message: 'Manual card not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Manual card updated successfully',
      data: updatedCard
    });

  } catch (error) {
    console.error('Error updating manual card:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Delete manual card
router.delete('/manual-cards/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const deletedCard = await ManualCard.findByIdAndDelete(id);

    if (!deletedCard) {
      return res.status(404).json({
        success: false,
        message: 'Manual card not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Manual card deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting manual card:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Soft delete (deactivate) manual card
router.patch('/manual-cards/:id/deactivate', async (req, res) => {
  try {
    const { id } = req.params;

    const updatedCard = await ManualCard.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );

    if (!updatedCard) {
      return res.status(404).json({
        success: false,
        message: 'Manual card not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Manual card deactivated successfully',
      data: updatedCard
    });

  } catch (error) {
    console.error('Error deactivating manual card:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Clean up expired cards (utility endpoint)
router.post('/manual-cards/cleanup', async (req, res) => {
  try {
    const now = new Date();
    
    // Find and deactivate expired cards
    const result = await ManualCard.updateMany(
      {
        expiresAt: { $lte: now },
        isActive: true
      },
      { isActive: false }
    );

    res.status(200).json({
      success: true,
      message: `Cleaned up ${result.modifiedCount} expired cards`,
      modifiedCount: result.modifiedCount
    });

  } catch (error) {
    console.error('Error cleaning up expired cards:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

module.exports = router;

