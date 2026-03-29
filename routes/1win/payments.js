const express = require("express");
const { body } = require("express-validator");
const { protect } = require("../../middleware/1win/auth");
const paymentsController = require("../../src/controllers/1win/payments.controller");

const router = express.Router();

router.post(
  "/create",
  protect,
  [
    body("planType").isIn(["gold", "diamond", "platinum"]).withMessage("Invalid plan type"),
    body("amount").isNumeric().withMessage("Amount must be a number"),
  ],
  paymentsController.createPayment
);

router.post(
  "/sms-webhook",
  [
    body("message").notEmpty().withMessage("Message is required"),
    body("sender").optional(),
    body("phoneNumber").optional(),
  ],
  paymentsController.smsWebhook
);

router.get("/status/:reference", protect, paymentsController.getPaymentStatus);

router.post(
  "/verify-transaction",
  protect,
  [
    body("reference").notEmpty().withMessage("Reference is required"),
    body("transactionId").notEmpty().withMessage("Transaction ID is required"),
  ],
  paymentsController.verifyTransaction
);

router.post(
  "/complete",
  protect,
  [body("reference").notEmpty().withMessage("Reference is required")],
  paymentsController.completePayment
);

router.get("/my-payments", protect, paymentsController.getMyPayments);

router.post("/cancel/:reference", protect, paymentsController.cancelPayment);

module.exports = router;
