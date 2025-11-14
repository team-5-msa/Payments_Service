const express = require("express");
const router = express.Router();
const occupiedSeatsController = require("../modules/occupiedSeats/occupiedSeats.controller");

// 올바른 controller 함수 호출
router.get("/:performanceId", occupiedSeatsController.getOccupiedSeats);

module.exports = router;
