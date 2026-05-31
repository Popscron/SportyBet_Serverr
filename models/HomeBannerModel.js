const mongoose = require("mongoose");

const TITLE_MAX = 120;

const bannerSlideSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      default: "",
      maxlength: TITLE_MAX,
      trim: true,
    },
  },
  { _id: false }
);

/**
 * Home hero / strip banners: one logical document holding ordered slides.
 * Stored in collection `home_banners` (separate from legacy `images` / other models).
 */
const homeBannerSchema = new mongoose.Schema(
  {
    // Singleton key: all banner reads/writes target this document.
    kind: {
      type: String,
      default: "home",
      trim: true,
      index: true,
    },
    slides: {
      type: [bannerSlideSchema],
      default: [],
    },
  },
  { collection: "home_banners", timestamps: true }
);

module.exports = mongoose.model("HomeBanner", homeBannerSchema);
