const express = require("express");
const router = express.Router();
const menuController = require("../controllers/menuController");

router.get("/", menuController.listMenu);
router.get("/:id", menuController.getMenuById);
router.post("/", menuController.createMenu);
router.put("/:id", menuController.updateMenu);
router.patch("/:id", menuController.updateMenu); // partial update ตามความหมาย REST
router.delete("/:id", menuController.deleteMenu);

module.exports = router;
