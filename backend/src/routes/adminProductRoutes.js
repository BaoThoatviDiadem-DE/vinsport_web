const express = require("express");
const router = express.Router();

const {
  getAdminProducts,
  createAdminProduct,
  updateAdminProduct,
  deleteAdminProduct,
  deleteAdminProductsBatch,
  importAdminProducts,
} = require("../controllers/adminProductController");

const { verifyToken, requireAdmin } = require("../middlewares/authMiddleware");

router.get("/", verifyToken, requireAdmin, getAdminProducts);
router.post("/", verifyToken, requireAdmin, createAdminProduct);
router.post("/import", verifyToken, requireAdmin, importAdminProducts);
router.post("/batch-delete", verifyToken, requireAdmin, deleteAdminProductsBatch);
router.put("/:id", verifyToken, requireAdmin, updateAdminProduct);
router.delete("/:id", verifyToken, requireAdmin, deleteAdminProduct);

module.exports = router;
