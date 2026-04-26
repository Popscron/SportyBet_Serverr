const path = require("path");
const fs = require("fs");
const sharp = require("sharp");
const HomeBanner = require("../../models/HomeBannerModel");

/** Output size for home banner tiles (square, cover-cropped). */
const BANNER_OUTPUT_PX = 640;

/** Max banners (append + replace). */
const MAX_HOME_BANNERS = 24;

const TITLE_MAX = 120;

function sanitizeTitle(raw) {
  if (raw == null) return "";
  return String(raw)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, TITLE_MAX);
}

/** Normalize loose input (e.g. migration / bad rows) into { url, title }. */
function normalizeBannerEntry(entry) {
  if (entry == null) return null;
  if (typeof entry === "string") {
    const u = entry.trim();
    return u ? { url: u, title: "" } : null;
  }
  if (typeof entry === "object") {
    const raw = entry.url || entry.image;
    const u = raw != null ? String(raw).trim() : "";
    if (!u) return null;
    const title = sanitizeTitle(entry.title ?? entry.text ?? entry.label ?? "");
    return { url: u, title };
  }
  return null;
}

function compactBannerList(slides) {
  if (!Array.isArray(slides)) return [];
  const out = [];
  for (const x of slides) {
    const n = normalizeBannerEntry(x);
    if (n) out.push(n);
    if (out.length >= MAX_HOME_BANNERS) break;
  }
  return out;
}

function entryUrl(entry) {
  if (entry == null) return null;
  if (typeof entry === "string") return entry.trim() || null;
  if (typeof entry === "object" && entry.url) return String(entry.url).trim() || null;
  return null;
}

/** API + app still expect `data.images` as `{ url, title }[]`. */
function bannerDocToClientData(doc) {
  if (!doc) {
    return { images: [] };
  }
  const plain = typeof doc.toObject === "function" ? doc.toObject() : { ...doc };
  const images = compactBannerList(plain.slides || []);
  return {
    _id: plain._id,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
    images,
  };
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

function deleteLocalFiles(entries) {
  if (!Array.isArray(entries)) return;
  for (const e of entries) {
    const u = entryUrl(e);
    if (u) deleteLocalFile(u);
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

    const slides = files.map((file) => ({
      url: `/uploads/${file.filename}`,
      title: "",
    }));

    let doc = await HomeBanner.findOne();

    if (doc) {
      deleteLocalFiles(doc.slides);
      doc.slides = slides.slice(0, MAX_HOME_BANNERS);
      doc.markModified("slides");
      await doc.save();
      return {
        status: 200,
        json: {
          message: "Images updated successfully!",
          data: bannerDocToClientData(doc),
        },
      };
    }

    doc = new HomeBanner({ slides: slides.slice(0, MAX_HOME_BANNERS) });
    await doc.save();
    return {
      status: 201,
      json: {
        message: "Images uploaded successfully!",
        data: bannerDocToClientData(doc),
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
    const title = sanitizeTitle(body?.title ?? body?.text ?? body?.label);

    console.log("Upload request received:", {
      hasFile: !!file,
      bannerIndex: body?.bannerIndex,
      mode: body?.mode,
      append,
      titleLen: title.length,
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

    const slide = { url: imageUrl, title };

    let doc = await HomeBanner.findOne();

    if (!doc) {
      doc = new HomeBanner({ slides: [slide] });
      await doc.save();
      return {
        status: 201,
        json: {
          message: "Banner image uploaded successfully!",
          imageUrl,
          title,
          slide,
          append: true,
          index: 0,
          data: bannerDocToClientData(doc),
        },
      };
    }

    let arr = compactBannerList(doc.slides || []);

    if (append) {
      if (arr.length >= MAX_HOME_BANNERS) {
        return {
          status: 400,
          json: {
            message: `Maximum ${MAX_HOME_BANNERS} banners reached. Remove one before adding.`,
          },
        };
      }
      arr.push(slide);
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
      const oldUrl = entryUrl(arr[idx]);
      if (oldUrl) {
        try {
          deleteLocalFile(oldUrl);
        } catch (delErr) {
          console.warn("Could not delete old banner file:", delErr.message);
        }
      }
      arr[idx] = slide;
    }

    doc.slides = arr;
    doc.markModified("slides");
    await doc.save();

    const outIndex = append ? arr.length - 1 : parseInt(body?.bannerIndex, 10);

    return {
      status: 200,
      json: {
        message: "Banner image updated successfully!",
        imageUrl,
        title,
        slide,
        append,
        index: outIndex,
        data: bannerDocToClientData(doc),
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
    const doc = await HomeBanner.findOne();

    if (!doc) {
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
        data: bannerDocToClientData(doc),
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
