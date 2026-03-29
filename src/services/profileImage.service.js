const Image = require("../../models/Image");

async function createMany(body) {
  try {
    const images = body;

    if (!Array.isArray(images) || images.length === 0) {
      return {
        status: 400,
        json: { message: "An array of image objects is required." },
      };
    }

    const invalid = images.some((img) => !img.imageUrl);
    if (invalid) {
      return {
        status: 400,
        json: { message: 'Each image must have an "imageUrl".' },
      };
    }

    const savedImages = await Image.insertMany(images);
    return { status: 201, json: savedImages };
  } catch (error) {
    console.error(error);
    return { status: 500, json: { message: "Server Error", error } };
  }
}

async function listAll() {
  try {
    const images = await Image.find().sort({ createdAt: -1 });
    return { status: 200, json: images };
  } catch (error) {
    return { status: 500, json: { message: "Server Error", error } };
  }
}

module.exports = { createMany, listAll };
