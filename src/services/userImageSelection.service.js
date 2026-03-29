const UserImage = require("../../models/UserImage");
const proImage = require("../../models/Image");

async function listProfileImages() {
  try {
    const images = await proImage.find().sort({ createdAt: -1 });
    return { status: 200, json: images };
  } catch (error) {
    return { status: 500, json: { message: "Server error", error } };
  }
}

async function setUserImage(userId, body) {
  try {
    const { imageId } = body;

    if (!imageId) {
      return { status: 400, json: { message: "imageId is required" } };
    }

    const foundImage = await proImage.findById(imageId);
    if (!foundImage) {
      return { status: 404, json: { message: "Image not found" } };
    }

    let userImage = await UserImage.findOne({ user: userId });

    if (userImage) {
      userImage.image = imageId;
      await userImage.save();
    } else {
      userImage = new UserImage({ user: userId, image: imageId });
      await userImage.save();
    }

    return {
      status: 200,
      json: { message: "User image updated", userImage },
    };
  } catch (error) {
    return { status: 500, json: { message: "Server error", error } };
  }
}

async function getUserImage(userId) {
  try {
    const userImage = await UserImage.findOne({ user: userId }).populate(
      "image"
    );
    if (!userImage) {
      return {
        status: 404,
        json: { message: "No image selected for user" },
      };
    }
    return { status: 200, json: userImage };
  } catch (error) {
    return { status: 500, json: { message: "Server error", error } };
  }
}

module.exports = {
  listProfileImages,
  setUserImage,
  getUserImage,
};
