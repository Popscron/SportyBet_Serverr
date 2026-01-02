const mongoose = require('mongoose');

const nextUpdateDateSchema = new mongoose.Schema({
  initialDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  lastCalculated: {
    type: Date,
    default: Date.now
  },
  currentMonth: {
    type: String,
    default: '01 Jan'
  }
}, {
  timestamps: true
});

// Ensure only one document exists
nextUpdateDateSchema.statics.getOrCreate = async function() {
  let doc = await this.findOne();
  if (!doc) {
    doc = await this.create({
      initialDate: new Date(),
      currentMonth: '01 Feb'
    });
  }
  return doc;
};

// Calculate current month based on 30-day intervals
nextUpdateDateSchema.methods.calculateCurrentMonth = function() {
  const now = new Date();
  const initial = new Date(this.initialDate);
  
  // Calculate days since initial date
  const daysDiff = Math.floor((now - initial) / (1000 * 60 * 60 * 24));
  
  // Calculate how many 30-day periods have passed
  const periodsPassed = Math.floor(daysDiff / 30);
  
  // Start from January (month 0)
  const startMonth = 0; // January
  const currentMonthIndex = (startMonth + periodsPassed) % 12;
  
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthName = monthNames[currentMonthIndex];
  
  return `01 ${monthName}`;
};

const NextUpdateDate = mongoose.model('NextUpdateDate', nextUpdateDateSchema);

module.exports = NextUpdateDate;

