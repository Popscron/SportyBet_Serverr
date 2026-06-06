const AppUpdateConfig = require("../../models/AppUpdateConfig");
const { DEFAULT_UPDATE_MESSAGE } = require("../../models/AppUpdateConfig");

function parseVersionParts(version) {
  const raw = String(version || "0").trim();
  const core = raw.split(/[-+]/)[0];
  return core
    .split(".")
    .map((part) => {
      const n = parseInt(String(part).replace(/[^\d]/g, ""), 10);
      return Number.isFinite(n) ? n : 0;
    });
}

/** Returns true when `current` is strictly older than `latest`. */
function isVersionOlder(current, latest) {
  const a = parseVersionParts(current);
  const b = parseVersionParts(latest);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av < bv) return true;
    if (av > bv) return false;
  }
  return false;
}

function normalizeVersionInput(value) {
  const v = String(value || "").trim();
  if (!v) return null;
  if (!/^\d+(\.\d+){0,3}$/.test(v)) return null;
  return v;
}

async function getPublicConfig(clientVersion) {
  try {
    const doc = await AppUpdateConfig.getOrCreate();
    const latestVersion = doc.latestVersion || "1.0.0";
    const enabled = doc.enabled === true;
    const client = String(clientVersion || "").trim();
    const updateRequired =
      enabled &&
      client &&
      normalizeVersionInput(client) &&
      isVersionOlder(client, latestVersion);

    return {
      status: 200,
      json: {
        success: true,
        enabled,
        latestVersion,
        updateRequired: Boolean(updateRequired),
        message: doc.message || DEFAULT_UPDATE_MESSAGE,
        downloadUrl: doc.downloadUrl || "",
      },
    };
  } catch (error) {
    console.error("Error fetching app update config:", error);
    return {
      status: 500,
      json: {
        success: false,
        message: "Error fetching app update config",
        error: error.message,
      },
    };
  }
}

async function getAdminConfig() {
  try {
    const doc = await AppUpdateConfig.getOrCreate();
    return {
      status: 200,
      json: {
        success: true,
        config: {
          enabled: doc.enabled === true,
          latestVersion: doc.latestVersion || "1.0.0",
          downloadUrl: doc.downloadUrl || "",
          message: doc.message || DEFAULT_UPDATE_MESSAGE,
          updatedAt: doc.updatedAt,
        },
      },
    };
  } catch (error) {
    console.error("Error fetching admin app update config:", error);
    return {
      status: 500,
      json: {
        success: false,
        message: "Error fetching app update config",
        error: error.message,
      },
    };
  }
}

async function updateAdminConfig(body) {
  try {
    const { enabled, latestVersion, downloadUrl, message } = body || {};
    const doc = await AppUpdateConfig.getOrCreate();

    if (enabled !== undefined) {
      doc.enabled = enabled === true || enabled === "true";
    }

    if (latestVersion !== undefined) {
      const normalized = normalizeVersionInput(latestVersion);
      if (!normalized) {
        return {
          status: 400,
          json: {
            success: false,
            message: "latestVersion must be numeric semver like 1.0.0 or 1.7.2",
          },
        };
      }
      doc.latestVersion = normalized;
    }

    if (downloadUrl !== undefined) {
      const url = String(downloadUrl || "").trim();
      if (doc.enabled && !url) {
        return {
          status: 400,
          json: {
            success: false,
            message: "downloadUrl is required when update notifications are enabled",
          },
        };
      }
      doc.downloadUrl = url;
    }

    if (message !== undefined) {
      const msg = String(message || "").trim();
      doc.message = msg || DEFAULT_UPDATE_MESSAGE;
    }

    if (doc.enabled && !String(doc.downloadUrl || "").trim()) {
      return {
        status: 400,
        json: {
          success: false,
          message: "downloadUrl is required when update notifications are enabled",
        },
      };
    }

    await doc.save();

    return {
      status: 200,
      json: {
        success: true,
        message: "App update settings saved",
        config: {
          enabled: doc.enabled === true,
          latestVersion: doc.latestVersion,
          downloadUrl: doc.downloadUrl || "",
          message: doc.message || DEFAULT_UPDATE_MESSAGE,
          updatedAt: doc.updatedAt,
        },
      },
    };
  } catch (error) {
    console.error("Error updating app update config:", error);
    return {
      status: 500,
      json: {
        success: false,
        message: "Error saving app update config",
        error: error.message,
      },
    };
  }
}

module.exports = {
  isVersionOlder,
  getPublicConfig,
  getAdminConfig,
  updateAdminConfig,
};
