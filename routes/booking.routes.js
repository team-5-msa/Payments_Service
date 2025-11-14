const express = require("express");
const router = express.Router();
const {
  createBooking,
  getMyBookings,
  cancelBooking,
  // mockAuth,
} = require("../modules/booking/booking.controller");

// 모든 예매 관련 라우트에 인증 미들웨어 적용
// router.use(mockAuth);

router.post("/", createBooking);
// [기존] router.get('/my', bookingController.mockAuth, bookingController.getMyBookings);
router.get("/my", getMyBookings);
router.delete("/my", cancelBooking);

module.exports = router;
