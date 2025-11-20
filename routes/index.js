const express = require("express");
const router = express.Router();
const paymentRoutes = require("./payment.routes");
const bookingRoutes = require("./booking.routes");

// URL 경로에 '/payment'가 포함된 모든 요청을 paymentRoutes로 전달
router.use("/payment", paymentRoutes);
router.use("/bookings", bookingRoutes);

module.exports = router;
