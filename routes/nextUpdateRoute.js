const express = require('express');
const router = express.Router();
const NextUpdateDate = require('../models/NextUpdateDate');

// GET current next update date
router.get('/next-update-date', async (req, res) => {
  try {
    let doc = await NextUpdateDate.getOrCreate();
    
    // Recalculate if needed (check if more than 1 day has passed since last calculation)
    const now = new Date();
    const lastCalc = new Date(doc.lastCalculated);
    const daysSinceLastCalc = (now - lastCalc) / (1000 * 60 * 60 * 24);
    
    if (daysSinceLastCalc >= 1) {
      // Recalculate the current month
      doc.currentMonth = doc.calculateCurrentMonth();
      doc.lastCalculated = now;
      await doc.save();
    }
    
    res.json({
      success: true,
      nextUpdateDate: doc.currentMonth
    });
  } catch (error) {
    console.error('Error fetching next update date:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching next update date',
      error: error.message
    });
  }
});

// POST to set initial date (admin only - optional)
router.post('/next-update-date/initialize', async (req, res) => {
  try {
    const { initialDate } = req.body;
    
    let doc = await NextUpdateDate.getOrCreate();
    
    if (initialDate) {
      doc.initialDate = new Date(initialDate);
    }
    
    doc.currentMonth = doc.calculateCurrentMonth();
    doc.lastCalculated = new Date();
    await doc.save();
    
    res.json({
      success: true,
      message: 'Next update date initialized',
      nextUpdateDate: doc.currentMonth,
      initialDate: doc.initialDate
    });
  } catch (error) {
    console.error('Error initializing next update date:', error);
    res.status(500).json({
      success: false,
      message: 'Error initializing next update date',
      error: error.message
    });
  }
});

module.exports = router;

