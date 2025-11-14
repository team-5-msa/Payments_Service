const bookingService = require("./booking.service");

/**
 * 1. 예매 생성 및 결제 의향 생성 API (수량 기반)
 */
const createBooking = async (req, res) => {
  try {
    const userId = req.headers["x-user-id"];
    const { performanceId, quantity, paymentMethod } = req.body;

    if (!userId) {
      return res
        .status(401)
        .send({ error: "User identification is missing in headers." });
    }

    const result = await bookingService.createBooking(
      userId,
      performanceId,
      quantity,
      paymentMethod
    );

    res.status(201).send({
      message:
        "Booking and payment intent created. Please proceed to payment execution.",
      ...result, // bookingId 등
    });
  } catch (error) {
    res.status(error.status || 500).send({ error: error.message });
  }
};

/**
 * 2. 내 예매 내역 조회 API
 */
const getMyBookings = async (req, res) => {
  try {
    const userId = req.headers["x-user-id"];
    if (!userId) {
      return res
        .status(401)
        .send({ error: "User identification is missing in headers." });
    }
    const bookings = await bookingService.getMyBookings(userId);
    res.status(200).send(bookings);
  } catch (error) {
    res.status(error.status || 500).send({ error: error.message });
  }
};

/**
 * 3. 예매 취소 API (결제 전 'pending' 상태일 때만)
 */
const cancelBooking = async (req, res) => {
  try {
    const userId = req.headers["x-user-id"];
    const { bookingId } = req.body;

    if (!userId) {
      return res
        .status(401)
        .send({ error: "User identification is missing in headers." });
    }
    if (!bookingId) {
      return res
        .status(400)
        .send({ error: "bookingId is required in the body." });
    }

    const result = await bookingService.cancelBooking(userId, bookingId);
    res.status(200).send(result);
  } catch (error) {
    res.status(error.status || 500).send({ error: error.message });
  }
};

module.exports = {
  createBooking,
  getMyBookings,
  cancelBooking,
};
