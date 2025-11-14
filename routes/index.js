const express = require("express");
const router = express.Router();
const occupiedSeatsRoutes = require("./occupiedSeats.routes");
const paymentRoutes = require("./payment.routes");
const bookingRoutes = require("./booking.routes");

router.use("/occupiedSeats", occupiedSeatsRoutes);
router.use("/payments", paymentRoutes);
router.use("/bookings", bookingRoutes);

module.exports = router;
