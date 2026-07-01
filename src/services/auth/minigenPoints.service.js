const User = require("../../../models/user");

const GALLERY_SAVE_COST = 0.5;

function roundPoints(value) {
  return Math.round(Number(value) * 10) / 10;
}

async function getMinigenPoints(req, res) {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const user = await User.findById(userId).select("minigenPoints").lean();
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.status(200).json({
      success: true,
      minigenPoints: roundPoints(user.minigenPoints ?? 0),
    });
  } catch (error) {
    console.error("Get MiniGen points error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

async function deductMinigenPoints(req, res) {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const count = Math.max(1, parseInt(req.body?.count, 10) || 1);
    const requestedAmount =
      req.body?.amount != null
        ? Number(req.body.amount)
        : GALLERY_SAVE_COST * count;

    const amount = roundPoints(requestedAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid deduction amount is required",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const current = roundPoints(user.minigenPoints ?? 0);
    if (current + 1e-9 < amount) {
      return res.status(402).json({
        success: false,
        message: `Not enough MiniGen points. You need ${amount} but have ${current}.`,
        minigenPoints: current,
        required: amount,
      });
    }

    user.minigenPoints = roundPoints(current - amount);
    await user.save();

    return res.status(200).json({
      success: true,
      minigenPoints: user.minigenPoints,
      deducted: amount,
      reason: req.body?.reason || "gallery_save",
    });
  } catch (error) {
    console.error("Deduct MiniGen points error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

module.exports = {
  GALLERY_SAVE_COST,
  getMinigenPoints,
  deductMinigenPoints,
};
