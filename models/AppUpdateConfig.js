const mongoose = require("mongoose");

const DEFAULT_MESSAGE =
  "A new version of the app is available. Please update to enjoy the latest features, improvements, and smoother performance.";

const appUpdateConfigSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    latestVersion: { type: String, default: "1.0.0" },
    downloadUrl: { type: String, default: "" },
    message: { type: String, default: DEFAULT_MESSAGE },
  },
  { timestamps: true }
);

appUpdateConfigSchema.statics.getOrCreate = async function () {
  let doc = await this.findOne();
  if (!doc) {
    doc = await this.create({
      enabled: false,
      latestVersion: "1.0.0",
      downloadUrl: "",
      message: DEFAULT_MESSAGE,
    });
  }
  return doc;
};

const AppUpdateConfig = mongoose.model("AppUpdateConfig", appUpdateConfigSchema);

module.exports = AppUpdateConfig;
module.exports.DEFAULT_UPDATE_MESSAGE = DEFAULT_MESSAGE;
