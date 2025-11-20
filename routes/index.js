const express = require("express");
const router = express.Router();
<<<<<<< HEAD
// const occupiedSeatsRoutes = require("./occupiedSeats.routes");
const paymentRoutes = require("./payment.routes");
const bookingRoutes = require("./booking.routes");

// router.use("/occupiedSeats", occupiedSeatsRoutes);
router.use("/payments", paymentRoutes);
=======
const paymentRoutes = require("./payment.routes");
const bookingRoutes = require("./booking.routes");

// URL 경로에 '/payment'가 포함된 모든 요청을 paymentRoutes로 전달
router.use("/payment", paymentRoutes);
>>>>>>> parent of 3accf10 (Add occupiedSeats API and refactor booking/payment flows)
router.use("/bookings", bookingRoutes);

module.exports = router;
