const express = require("express");
const { body } = require("express-validator");
const { protect } = require("../../middleware/1win/auth");
const authController = require("../../src/controllers/1win/auth.controller");

const router = express.Router();

router.post(
  "/register",
  [
    body("email").optional().isEmail().normalizeEmail(),
    body("phone").optional().isMobilePhone(),
    body("accountId")
      .optional()
      .isLength({ min: 8, max: 10 })
      .withMessage("Account ID must be 8 to 10 digits"),
    body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
    body("currency").optional().isIn(["GHS", "PKR", "USD", "EUR", "NGN", "INR"]),
  ],
  authController.register
);

router.post(
  "/login",
  [
    body("emailOrPhone").notEmpty().withMessage("Email or phone is required"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  authController.login
);

router.get("/me", protect, authController.me);

router.post(
  "/admin/login",
  [
    body("email").isEmail().normalizeEmail().withMessage("Valid email is required"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  authController.adminLogin
);

router.get("/mine-pattern", protect, authController.getMinePattern);

router.post("/generate-mine-pattern", protect, authController.generateMinePattern);

router.get("/transactions", protect, authController.getTransactions);

router.put(
  "/update-account-id",
  protect,
  [
    body("accountId")
      .isLength({ min: 8, max: 10 })
      .withMessage("Account ID must be 8 to 10 digits")
      .matches(/^\d+$/)
      .withMessage("Account ID must contain only numbers"),
  ],
  authController.updateAccountId
);

router.get("/stats", authController.getStats);

router.get("/invite/:code", authController.validateInvite);

router.post("/logout", protect, authController.logout);

module.exports = router;
