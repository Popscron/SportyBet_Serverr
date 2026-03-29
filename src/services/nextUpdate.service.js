const NextUpdateDate = require("../../models/NextUpdateDate");

async function getNextUpdateDate() {
  try {
    let doc = await NextUpdateDate.getOrCreate();

    const now = new Date();
    const lastCalc = new Date(doc.lastCalculated);
    const daysSinceLastCalc = (now - lastCalc) / (1000 * 60 * 60 * 24);

    if (daysSinceLastCalc >= 1) {
      doc.currentMonth = doc.calculateCurrentMonth();
      doc.lastCalculated = now;
      await doc.save();
    }

    return {
      status: 200,
      json: {
        success: true,
        nextUpdateDate: doc.currentMonth,
      },
    };
  } catch (error) {
    console.error("Error fetching next update date:", error);
    return {
      status: 500,
      json: {
        success: false,
        message: "Error fetching next update date",
        error: error.message,
      },
    };
  }
}

async function initialize(body) {
  try {
    const { initialDate } = body;

    let doc = await NextUpdateDate.getOrCreate();

    if (initialDate) {
      doc.initialDate = new Date(initialDate);
    }

    doc.currentMonth = doc.calculateCurrentMonth();
    doc.lastCalculated = new Date();
    await doc.save();

    return {
      status: 200,
      json: {
        success: true,
        message: "Next update date initialized",
        nextUpdateDate: doc.currentMonth,
        initialDate: doc.initialDate,
      },
    };
  } catch (error) {
    console.error("Error initializing next update date:", error);
    return {
      status: 500,
      json: {
        success: false,
        message: "Error initializing next update date",
        error: error.message,
      },
    };
  }
}

module.exports = { getNextUpdateDate, initialize };
