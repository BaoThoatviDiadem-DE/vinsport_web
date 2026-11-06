const express = require("express");
const router = express.Router();

const { verifyToken, requireAdmin } = require("../middlewares/authMiddleware");
const {
  getAdminUsers,
  updateAdminUser,
  deleteAdminUser,
  deleteAdminUsersBatch,
} = require("../controllers/adminUserController");

router.get("/", verifyToken, requireAdmin, getAdminUsers);
router.post("/batch-delete", verifyToken, requireAdmin, deleteAdminUsersBatch);
router.put("/:id", verifyToken, requireAdmin, updateAdminUser);
router.delete("/:id", verifyToken, requireAdmin, deleteAdminUser);

module.exports = router;