const path = require("path");
const fs = require("fs");
const ImageModel = require("../../models/ImagesModel");

function deleteLocalFile(fileUrl) {
  if (!fileUrl || typeof fileUrl !== "string") return;
  try {
    const filename = path.basename(fileUrl);
    const filePath = path.join(__dirname, "..", "..", "uploads", filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error("Error deleting local file:", error);
  }
}

function deleteLocalFiles(fileUrls) {
  if (!Array.isArray(fileUrls)) return;
  for (const url of fileUrls) {
    if (url) deleteLocalFile(url);
  }
}

async function uploadImages(files) {
  try {
    if (!files || files.length === 0) {
      return {
        status: 400,
        json: { message: "Please upload at least one image." },
      };
    }

    const imageUrls = files.map((file) => `/uploads/${file.filename}`);

    let existingImages = await ImageModel.findOne();

    if (existingImages) {
      deleteLocalFiles(existingImages.images);
      existingImages.images = imageUrls;
      await existingImages.save();
      return {
        status: 200,
        json: {
          message: "Images updated successfully!",
          data: existingImages,
        },
      };
    }

    const newImages = new ImageModel({ images: imageUrls });
    await newImages.save();
    return {
      status: 201,
      json: {
        message: "Images uploaded successfully!",
        data: newImages,
      },
    };
  } catch (error) {
    return {
      status: 500,
      json: { message: "Upload failed", error: error.message },
    };
  }
}

async function uploadSingleImage(file, body) {
  try {
    console.log("Upload request received:", {
      hasFile: !!file,
      bannerIndex: body.bannerIndex,
      fileInfo: file
        ? {
            fieldname: file.fieldname,
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
          }
        : null,
    });

    if (!file) {
      console.log("No file uploaded");
      return { status: 400, json: { message: "Please upload an image." } };
    }

    const imageUrl = `/uploads/${file.filename}`;
    const bannerIndex = parseInt(body.bannerIndex, 10) || 0;

    console.log("Processing upload:", { imageUrl, bannerIndex });

    let existingImages = await ImageModel.findOne();

    if (existingImages) {
      if (!existingImages.images || existingImages.images.length === 0) {
        existingImages.images = new Array(4).fill(null);
      }

      const oldUrl = existingImages.images[bannerIndex];
      if (oldUrl) {
        try {
          deleteLocalFile(oldUrl);
        } catch (delErr) {
          console.warn("Could not delete old banner file:", delErr.message);
        }
      }

      existingImages.images[bannerIndex] = imageUrl;
      await existingImages.save();

      console.log("Banner updated successfully:", existingImages);
      return {
        status: 200,
        json: {
          message: "Banner image updated successfully!",
          imageUrl,
          data: existingImages,
        },
      };
    }

    const images = new Array(4).fill(null);
    images[bannerIndex] = imageUrl;

    const newImages = new ImageModel({ images });
    await newImages.save();

    console.log("New banner created successfully:", newImages);
    return {
      status: 201,
      json: {
        message: "Banner image uploaded successfully!",
        imageUrl,
        data: newImages,
      },
    };
  } catch (error) {
    console.error("Upload error:", error);
    return {
      status: 500,
      json: {
        message: "Upload failed",
        error: error.message,
        stack:
          process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
    };
  }
}

async function getImages() {
  try {
    const images = await ImageModel.findOne();

    if (!images) {
      return {
        status: 200,
        json: {
          message: "No images found",
          data: { images: [] },
        },
      };
    }

    return {
      status: 200,
      json: {
        message: "Images retrieved successfully",
        data: images,
      },
    };
  } catch (error) {
    return {
      status: 500,
      json: {
        message: "Failed to retrieve images",
        error: error.message,
      },
    };
  }
}

module.exports = {
  uploadImages,
  uploadSingleImage,
  getImages,
};
