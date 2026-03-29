const mongoose = require("mongoose");
const User = require("../../../models/user");

async function updateGrandAuditLimit(body) {
  try {
    console.log("Received request body:", body);

    const { userId, grandAuditLimit } = body;

    if (!userId) {
      console.log("Validation failed: userId is missing");
      return { status: 400, json: { message: "userId is required" } };
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      console.log("Validation failed: Invalid userId format:", userId);
      return { status: 400, json: { message: "Invalid userId format" } };
    }

    if (grandAuditLimit === undefined || grandAuditLimit === null) {
      console.log("Validation failed: grandAuditLimit is undefined or null");
      return {
        status: 400,
        json: {
          message: "grandAuditLimit is required and cannot be empty",
        },
      };
    }

    let parsedLimit;

    if (typeof grandAuditLimit === "number") {
      parsedLimit = grandAuditLimit;
    } else if (typeof grandAuditLimit === "string") {
      const trimmed = grandAuditLimit.trim();
      if (
        trimmed === "" ||
        trimmed === "null" ||
        trimmed === "undefined" ||
        trimmed === "NaN"
      ) {
        console.log(
          "Validation failed: grandAuditLimit is empty or invalid string:",
          trimmed
        );
        return {
          status: 400,
          json: {
            message: "grandAuditLimit is required and cannot be empty",
          },
        };
      }
      parsedLimit = Number(trimmed);
    } else {
      parsedLimit = Number(grandAuditLimit);
    }

    if (Number.isNaN(parsedLimit) || !isFinite(parsedLimit)) {
      console.log(
        "Validation failed: grandAuditLimit is not a valid number:",
        grandAuditLimit
      );
      return {
        status: 400,
        json: { message: "grandAuditLimit must be a valid number" },
      };
    }

    if (parsedLimit < 0) {
      console.log("Validation failed: grandAuditLimit is negative:", parsedLimit);
      return {
        status: 400,
        json: { message: "grandAuditLimit must be a non-negative number" },
      };
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: { grandAuditLimit: parsedLimit } },
      { new: true, runValidators: false }
    );

    if (!updatedUser) {
      console.log("Validation failed: User not found with userId:", userId);
      return { status: 404, json: { message: "User not found" } };
    }

    console.log(
      "Successfully updated grand audit limit for user:",
      userId,
      "to:",
      parsedLimit
    );
    return {
      status: 200,
      json: {
        message: "Grand audit limit updated",
        grandAuditLimit: updatedUser.grandAuditLimit,
      },
    };
  } catch (error) {
    console.error("Error updating grand audit limit:", error);
    if (error.name === "ValidationError") {
      return {
        status: 400,
        json: { message: "Validation error", error: error.message },
      };
    }
    return {
      status: 500,
      json: { message: "Server error", error: error.message },
    };
  }
}

module.exports = { updateGrandAuditLimit };
