const oddModel = require("../../models/oddModel");

async function getByBetId(betId) {
  try {
    const oddData = await oddModel.findOne({ betId });

    if (oddData) {
      return { status: 200, json: oddData };
    }
    console.log("not found bet");
    return { status: 204, json: null };
  } catch (error) {
    console.log("server error");
    return { status: 500, json: { error: "Server error" } };
  }
}

async function upsertByBetId(betId, body) {
  try {
    const { odd } = body;

    if (!odd) {
      return { status: 400, json: { error: "Odd value is required" } };
    }

    const existingOdd = await oddModel.findOne({ betId });

    if (existingOdd) {
      existingOdd.odd = odd;
      await existingOdd.save();
      return {
        status: 200,
        json: {
          message: "Odd value updated successfully",
          updatedOdd: existingOdd,
        },
      };
    }

    const newOdd = new oddModel({ betId, odd });
    await newOdd.save();
    return {
      status: 200,
      json: { message: "New odd value added", newOdd },
    };
  } catch (error) {
    console.error("Error updating odd:", error);
    return {
      status: 500,
      json: { error: "Error updating odd value" },
    };
  }
}

module.exports = { getByBetId, upsertByBetId };
