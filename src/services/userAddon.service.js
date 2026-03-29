const UserAddon = require("../../models/UserAddon");
const Addon = require("../../models/Addon");

async function buyAddon(body) {
  const { userId, addonId } = body;

  try {
    const addon = await Addon.findById(addonId);
    if (!addon) return { status: 404, json: { message: "Addon not found" } };

    if (addon.price === 0) {
      return { status: 400, json: { message: "This addon is free" } };
    }

    const existing = await UserAddon.findOne({ userId, addonId });

    if (existing) {
      existing.status = existing.status === "active" ? "inactive" : "active";
      await existing.save();
      return {
        status: 200,
        json: {
          message: `Addon has been ${existing.status}`,
          addon: existing,
        },
      };
    }

    const newUserAddon = new UserAddon({
      userId,
      addonId,
      status: "active",
    });

    await newUserAddon.save();

    return {
      status: 200,
      json: {
        message: "Addon purchased and activated successfully",
        addon: newUserAddon,
      },
    };
  } catch (err) {
    console.error("Error:", err);
    return { status: 500, json: { message: "Server error" } };
  }
}

async function listAllForUser(userId) {
  try {
    const [addons, userAddons] = await Promise.all([
      Addon.find(),
      UserAddon.find({ userId }).select("addonId status"),
    ]);

    const addonStatusMap = {};
    userAddons.forEach((ua) => {
      addonStatusMap[ua.addonId.toString()] = ua.status;
    });

    const result = addons.map((addon) => {
      const status = addonStatusMap[addon._id.toString()];
      return {
        ...addon._doc,
        isActive: status === "active",
      };
    });

    return { status: 200, json: result };
  } catch (err) {
    console.error("Error:", err);
    return { status: 500, json: { message: "Server error" } };
  }
}

module.exports = { buyAddon, listAllForUser };
