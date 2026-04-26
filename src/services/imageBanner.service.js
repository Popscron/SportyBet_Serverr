const path = require("path");
const fs = require("fs");
const sharp = require("sharp");
const ImageModel = require("../../models/ImagesModel");

/** Output size for home banner tiles (square, cover-cropped). */
const BANNER_OUTPUT_PX = 640;

/** Max banners (append + replace). */
const MAX_HOME_BANNERS = 24;

function compactBannerList(images) {
  if (!Array.isArray(images)) return [];
  return images
    .map((x) => {
      if (x == null) return null;
      if (typeof x === "string") {
        const s = x.trim();
        return s || null;
      }
      return null;
    })
    .filter(Boolean);
}

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

/**
 * Center-crop to square and resize for banner strip (any aspect ratio).
 * Replaces the raw multer file with a JPEG under a new name; deletes the original upload.
 */
async function normalizeBannerSquareFromUpload(file) {
  if (!file?.destination || !file?.filename) {
    throw new Error("Missing upload file path");
  }
  const absIn = path.join(file.destination, file.filename);
  if (!fs.existsSync(absIn)) {
    throw new Error("Uploaded file not found on disk");
  }
  const outName = `banner-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`;
  const absOut = path.join(file.destination, outName);
  await sharp(absIn)
    .rotate()
    .resize(BANNER_OUTPUT_PX, BANNER_OUTPUT_PX, {
      fit: "cover",
      position: "center",
    })
    .jpeg({ quality: 88, mozjpeg: true })
    .toFile(absOut);
  try {
    fs.unlinkSync(absIn);
  } catch (e) {
    console.warn("Could not delete pre-process banner temp:", e?.message);
  }
  return `/uploads/${outName}`;
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
      existingImages.images = imageUrls.slice(0, MAX_HOME_BANNERS);
      await existingImages.save();
      return {
        status: 200,
        json: {
          message: "Images updated successfully!",
          data: existingImages,
        },
      };
    }

    const newImages = new ImageModel({ images: imageUrls.slice(0, MAX_HOME_BANNERS) });
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

function isAppendRequest(body) {
  if (!body || typeof body !== "object") return false;
  const mode = String(body.mode || "").toLowerCase();
  if (mode === "append") return true;
  const a = body.append;
  if (a === true || a === 1) return true;
  const s = String(a ?? "").toLowerCase();
  return s === "true" || s === "1" || s === "yes";
}

async function uploadSingleImage(file, body) {
  try {
    const append = isAppendRequest(body);

    console.log("Upload request received:", {
      hasFile: !!file,
      bannerIndex: body?.bannerIndex,
      mode: body?.mode,
      appendRaw: body?.append,
      append,
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

    let imageUrl;
    try {
      imageUrl = await normalizeBannerSquareFromUpload(file);
    } catch (procErr) {
      console.error("Banner image processing failed:", procErr);
      try {
        deleteLocalFile(`/uploads/${file.filename}`);
      } catch (_) {}
      return {
        status: 400,
        json: {
          message: "Could not process image. Use JPG or PNG.",
          error: procErr.message,
        },
      };
    }

    let existingImages = await ImageModel.findOne();

    if (!existingImages) {
      const newDoc = new ImageModel({ images: [imageUrl] });
      await newDoc.save();
      return {
        status: 201,
        json: {
          message: "Banner image uploaded successfully!",
          imageUrl,
          append: true,
          index: 0,
          data: newDoc,
        },
      };
    }

    let arr = compactBannerList(existingImages.images || []);

    if (append) {
      if (arr.length >= MAX_HOME_BANNERS) {
        return {
          status: 400,
          json: {
            message: `Maximum ${MAX_HOME_BANNERS} banners reached. Remove one before adding.`,
          },
        };
      }
      arr.push(imageUrl);
    } else {
      const idx = parseInt(body?.bannerIndex, 10);
      if (Number.isNaN(idx) || idx < 0 || idx >= arr.length) {
        return {
          status: 400,
          json: {
            message: `Invalid bannerIndex. Use 0–${
              Math.max(0, arr.length - 1)
            } to replace an image, or append=true to add a new banner.`,
          },
        };
      }
      const oldUrl = arr[idx];
      if (oldUrl) {
        try {
          deleteLocalFile(oldUrl);
        } catch (delErr) {
          console.warn("Could not delete old banner file:", delErr.message);
        }
      }
      arr[idx] = imageUrl;
    }

    existingImages.images = arr;
    existingImages.markModified("images");
    await existingImages.save();

    const outIndex = append ? arr.length - 1 : parseInt(body?.bannerIndex, 10);

    return {
      status: 200,
      json: {
        message: "Banner image updated successfully!",
        imageUrl,
        append,
        index: outIndex,
        data: existingImages,
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

    const payload =
      typeof images.toObject === "function" ? images.toObject() : images;
    payload.images = compactBannerList(payload.images || []);

    return {
      status: 200,
      json: {
        message: "Images retrieved successfully",
        data: payload,
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
