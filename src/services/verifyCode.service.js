const VerifyModel = require("../../models/verifycode");
const bet = require("../../models/bet");
const UserBalance = require("../../models/UserBalance");

function generateVerifyCode(currencyType = "GHS") {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numbers = "0123456789";

  const numCount = Math.floor(Math.random() * 4) + 4;

  const prefix = currencyType === "NGN" ? "NG" : "GH";
  let code = prefix;

  const numberPositions = [];
  while (numberPositions.length < numCount) {
    const pos = Math.floor(Math.random() * 15);
    if (!numberPositions.includes(pos)) {
      numberPositions.push(pos);
    }
  }

  for (let i = 0; i < 15; i++) {
    if (numberPositions.includes(i)) {
      code += numbers.charAt(Math.floor(Math.random() * numbers.length));
    } else {
      code += letters.charAt(Math.floor(Math.random() * letters.length));
    }
  }

  return code;
}

async function getOrCreateByBetId(betId) {
  try {
    let verifyData = await VerifyModel.findOne({ betId });

    if (verifyData) {
      return { status: 200, json: verifyData };
    }

    const betData = await bet.findById(betId);
    if (!betData) {
      return { status: 404, json: { error: "Bet not found" } };
    }

    const userBalance = await UserBalance.findOne({ userId: betData.userId });
    const currencyType = userBalance?.currencyType || "GHS";

    let generatedCode;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      generatedCode = generateVerifyCode(currencyType);
      const existingCode = await VerifyModel.findOne({
        verifyCode: generatedCode,
      });
      if (!existingCode) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      return {
        status: 500,
        json: { error: "Failed to generate unique verify code" },
      };
    }

    const newVerify = new VerifyModel({ betId, verifyCode: generatedCode });
    await newVerify.save();

    return { status: 200, json: newVerify };
  } catch (error) {
    console.error("Error in verify-code route:", error);
    return { status: 500, json: { error: "Server error" } };
  }
}

async function upsertByBetId(betId, body) {
  try {
    const { verifyCode } = body;

    const existingVerify = await VerifyModel.findOne({ verifyCode });

    if (existingVerify) {
      existingVerify.betId = betId;
      await existingVerify.save();
      return {
        status: 200,
        json: {
          message: "Verify Code updated successfully",
          existingVerify,
        },
      };
    }

    const newVerify = new VerifyModel({ betId, verifyCode });
    await newVerify.save();
    return {
      status: 200,
      json: { message: "New Verify Code added", newVerify },
    };
  } catch (error) {
    return { status: 500, json: { error: "Error updating code" } };
  }
}

async function deleteByBetId(betId) {
  try {
    const deleted = await VerifyModel.deleteOne({ betId });

    if (deleted.deletedCount > 0) {
      return {
        status: 200,
        json: { message: "Verify code deleted successfully" },
      };
    }
    return {
      status: 200,
      json: { message: "No verify code found to delete" },
    };
  } catch (error) {
    console.error("Error deleting verify code:", error);
    return { status: 500, json: { error: "Server error" } };
  }
}

async function getMatchByVerifyCode(verifyCode) {
  try {
    const verifyRecord = await VerifyModel.findOne({ verifyCode });
    console.log(verifyRecord);

    if (!verifyRecord) {
      return { status: 404, json: { message: "Verify code not found." } };
    }

    const now = new Date();
    const expiryTime = new Date(verifyRecord.createdAt);
    expiryTime.setHours(expiryTime.getHours() + 24);

    if (now > expiryTime) {
      return { status: 400, json: { message: "Verify code expired." } };
    }

    const match = await bet.findOne({ _id: verifyRecord.betId });

    if (!match) {
      return {
        status: 404,
        json: { message: "Match not found for given verify code." },
      };
    }

    return { status: 200, json: { match } };
  } catch (err) {
    console.error("Error fetching match:", err);
    return { status: 500, json: { message: "Server error" } };
  }
}

module.exports = {
  getOrCreateByBetId,
  upsertByBetId,
  deleteByBetId,
  getMatchByVerifyCode,
};
