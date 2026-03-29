const express = require("express");
const { body } = require("express-validator");
const { adminAuth, mainAdminAuth } = require("../../middleware/1win/admin");
const adminController = require("../../src/controllers/1win/admin.controller");

const router = express.Router();

router.use(adminAuth);

router.get("/users", adminController.getUsers);
router.get("/users/website", adminController.getWebsiteUsers);
router.get("/users/expired", adminController.getExpiredUsers);
router.get("/users/disabled", adminController.getDisabledUsers);
router.get("/users/:id", adminController.getUserById);

router.post(
  "/users",
  [
    body("email").optional().isEmail().normalizeEmail(),
    body("phone").optional().isMobilePhone(),
    body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
    body("name").optional().trim(),
    body("currency").optional().isIn(["GHS", "PKR", "USD", "EUR", "NGN", "INR"]),
    body("balance").optional().isFloat({ min: 0 }),
    body("subscriptionType").optional().isIn(["1month", "3months"]),
  ],
  adminController.createUser
);

router.put(
  "/users/:id",
  [
    body("email").optional().isEmail().normalizeEmail(),
    body("phone")
      .optional()
      .custom((value) => {
        if (value === "" || value === null || value === undefined) return true;
        const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/;
        return phoneRegex.test(value) || value.length >= 7;
      })
      .withMessage("Invalid phone number"),
    body("name").optional().trim(),
    body("currency").optional().isIn(["GHS", "PKR", "USD", "EUR", "NGN", "INR"]),
    body("balance").optional().isFloat({ min: 0 }),
    body("subscriptionType")
      .optional()
      .custom((value) => {
        if (value === "" || value === null || value === undefined) return true;
        return ["1month", "3months"].includes(value);
      }),
    body("role").optional().isIn(["admin", "user"]).withMessage("Invalid role"),
  ],
  adminController.updateUser
);

router.delete("/users/:id", adminController.deleteUser);
router.patch("/users/:id/status", adminController.toggleUserStatus);

router.get("/admins-list", adminController.getAdminsList);

router.get("/admins", mainAdminAuth, adminController.getAdminsWithStats);

router.post(
  "/admins",
  mainAdminAuth,
  [
    body("email").isEmail().normalizeEmail().withMessage("Valid email is required"),
    body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
    body("name").optional().trim(),
  ],
  adminController.createAdmin
);

router.post(
  "/admins/generate-all-invite-codes",
  adminController.generateAllInviteCodes
);

router.put(
  "/admins/:id/role",
  mainAdminAuth,
  [body("role").isIn(["admin"]).withMessage("Role must be admin")],
  adminController.updateAdminRole
);

router.post(
  "/admins/:id/invite-code",
  mainAdminAuth,
  adminController.generateAdminInviteCode
);

router.get("/admins/:id/stats", mainAdminAuth, adminController.getAdminStats);

router.get("/my-invite-link", adminController.getMyInviteLink);
router.get("/my-earnings", adminController.getMyEarnings);
router.get("/my-referred-users", adminController.getMyReferredUsers);

module.exports = router;
