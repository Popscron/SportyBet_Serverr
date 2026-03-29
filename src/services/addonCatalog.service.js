const Addon = require("../../models/Addon");

async function bulkCreate(body) {
  try {
    const addons = body.addons;

    if (!Array.isArray(addons) || addons.length === 0) {
      return { status: 400, json: { message: "No addons provided" } };
    }

    const insertedAddons = await Addon.insertMany(addons, { ordered: false });
    return {
      status: 201,
      json: {
        message: "Addons created successfully",
        data: insertedAddons,
      },
    };
  } catch (error) {
    console.error(error);
    return {
      status: 500,
      json: { message: "Failed to create addons", error },
    };
  }
}

async function listAll() {
  try {
    const addons = await Addon.find();
    return { status: 200, json: addons };
  } catch (err) {
    return { status: 500, json: { message: "Failed to load addons" } };
  }
}

module.exports = { bulkCreate, listAll };
