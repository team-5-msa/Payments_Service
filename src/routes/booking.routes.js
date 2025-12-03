const express = require("express");
const router = express.Router();
const {
  createBooking,
  getMyBookings,
  cancelBooking,
} = require("../modules/booking/booking.controller");

// 모든 예매 관련 라우트에 인증 미들웨어 적용
const authMiddleware = require("../middlewares/authMiddleware");
router.use(authMiddleware);

router.post("/", createBooking);
router.get("/my", getMyBookings);
router.delete("/my", cancelBooking);

module.exports = router;
