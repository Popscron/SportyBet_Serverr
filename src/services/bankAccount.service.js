const mongoose = require("mongoose");
const BankAccount = require("../../models/BankAccount");
const User = require("../../models/user");

async function listByUser(userId) {
  try {
    if (!userId) {
      return {
        status: 400,
        json: { success: false, message: "User ID is required" },
      };
    }

    const user = await User.findById(userId);
    if (!user) {
      return { status: 404, json: { success: false, message: "User not found" } };
    }

    const accounts = await BankAccount.find({ userId }).sort({ createdAt: -1 });

    return {
      status: 200,
      json: { success: true, accounts },
    };
  } catch (error) {
    console.error("Error fetching bank accounts:", error);
    return {
      status: 500,
      json: { success: false, message: "Server error", error: error.message },
    };
  }
}

async function create(body) {
  try {
    const { userId, name, accountName, accountNumber, isDefault } = body;

    if (!userId || !name || !accountName || !accountNumber) {
      return {
        status: 400,
        json: {
          success: false,
          message:
            "Missing required fields: userId, name, accountName, accountNumber",
        },
      };
    }

    const user = await User.findById(userId);
    if (!user) {
      return { status: 404, json: { success: false, message: "User not found" } };
    }

    let shouldBeDefault = isDefault || false;

    if (shouldBeDefault) {
      await BankAccount.updateMany({ userId }, { isDefault: false });
    } else {
      const existingDefault = await BankAccount.findOne({ userId, isDefault: true });
      if (!existingDefault) {
        shouldBeDefault = true;
      }
    }

    const newAccount = new BankAccount({
      userId,
      name,
      accountName,
      accountNumber,
      isDefault: shouldBeDefault,
    });

    await newAccount.save();

    return {
      status: 201,
      json: {
        success: true,
        message: "Bank account created successfully",
        account: newAccount,
      },
    };
  } catch (error) {
    console.error("Error creating bank account:", error);
    return {
      status: 500,
      json: { success: false, message: "Server error", error: error.message },
    };
  }
}

async function update(accountId, body) {
  try {
    const { userId, name, accountName, accountNumber, isDefault } = body;

    if (!userId) {
      return {
        status: 400,
        json: { success: false, message: "User ID is required" },
      };
    }

    const account = await BankAccount.findById(accountId);
    if (!account) {
      return {
        status: 404,
        json: { success: false, message: "Bank account not found" },
      };
    }

    if (account.userId.toString() !== userId) {
      return { status: 403, json: { success: false, message: "Unauthorized" } };
    }

    if (isDefault) {
      await BankAccount.updateMany(
        { userId, _id: { $ne: accountId } },
        { isDefault: false }
      );
    }

    account.name = name || account.name;
    account.accountName = accountName || account.accountName;
    account.accountNumber = accountNumber || account.accountNumber;
    if (isDefault !== undefined) {
      account.isDefault = isDefault;
    }

    await account.save();

    return {
      status: 200,
      json: {
        success: true,
        message: "Bank account updated successfully",
        account,
      },
    };
  } catch (error) {
    console.error("Error updating bank account:", error);
    return {
      status: 500,
      json: { success: false, message: "Server error", error: error.message },
    };
  }
}

async function remove(accountId, body) {
  try {
    const { userId } = body;

    if (!userId) {
      return {
        status: 400,
        json: { success: false, message: "User ID is required" },
      };
    }

    if (!accountId) {
      return {
        status: 400,
        json: { success: false, message: "Account ID is required" },
      };
    }

    let account;

    if (mongoose.Types.ObjectId.isValid(accountId)) {
      account = await BankAccount.findById(accountId);
    }

    if (!account && body.accountNumber) {
      account = await BankAccount.findOne({
        userId,
        accountNumber: body.accountNumber,
      });
    }

    if (!account) {
      return {
        status: 404,
        json: {
          success: false,
          message: "Bank account not found",
          accountId,
        },
      };
    }

    const accountUserId = account.userId.toString();
    const requestUserId = userId.toString();

    if (accountUserId !== requestUserId) {
      return { status: 403, json: { success: false, message: "Unauthorized" } };
    }

    await BankAccount.findByIdAndDelete(account._id);

    return {
      status: 200,
      json: { success: true, message: "Bank account deleted successfully" },
    };
  } catch (error) {
    console.error("Error deleting bank account:", error);
    console.error("Error details:", {
      accountId: accountId,
      userId: body.userId,
      errorMessage: error.message,
      errorStack: error.stack,
    });
    return {
      status: 500,
      json: { success: false, message: "Server error", error: error.message },
    };
  }
}

async function sync(body) {
  try {
    const { userId, accounts } = body;

    if (!userId || !Array.isArray(accounts)) {
      return {
        status: 400,
        json: {
          success: false,
          message: "User ID and accounts array are required",
        },
      };
    }

    const user = await User.findById(userId);
    if (!user) {
      return { status: 404, json: { success: false, message: "User not found" } };
    }

    await BankAccount.deleteMany({ userId });

    const newAccounts = accounts.map((acc) => ({
      userId,
      name: acc.name,
      accountName: acc.accountName,
      accountNumber: acc.accountNumber,
      isDefault: acc.isDefault || false,
    }));

    const defaultCount = newAccounts.filter((acc) => acc.isDefault).length;
    if (defaultCount > 1) {
      let foundFirst = false;
      newAccounts.forEach((acc) => {
        if (acc.isDefault && !foundFirst) {
          foundFirst = true;
        } else if (acc.isDefault) {
          acc.isDefault = false;
        }
      });
    } else if (defaultCount === 0 && newAccounts.length > 0) {
      newAccounts[0].isDefault = true;
    }

    const savedAccounts = await BankAccount.insertMany(newAccounts);

    return {
      status: 200,
      json: {
        success: true,
        message: "Bank accounts synced successfully",
        accounts: savedAccounts,
      },
    };
  } catch (error) {
    console.error("Error syncing bank accounts:", error);
    return {
      status: 500,
      json: { success: false, message: "Server error", error: error.message },
    };
  }
}

module.exports = {
  listByUser,
  create,
  update,
  remove,
  sync,
};
