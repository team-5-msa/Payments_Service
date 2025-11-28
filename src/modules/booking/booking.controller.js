const { db } = require("../../config/firebase");
const bookingService = require("./booking.service");
const {
  BadRequestError,
  UnauthorizedError,
} = require("../../utils/errorHandler");
const logger = require("../../utils/logger");

/**
 * 1. 예매 생성 API
 * 클라이언트에서 받은 요청 데이터를 검증하고, 예매 생성을 처리합니다.
 */
const createBooking = async (req, res) => {
  try {
    const userId = req.headers["x-user-id"];
    const { performanceId, quantity, paymentMethod } = req.body;

    if (!userId)
      throw new UnauthorizedError("User identification is missing in headers.");
    if (!performanceId || !quantity || !paymentMethod)
      throw new BadRequestError(
        "performanceId, quantity, paymentMethod are required."
      );
    // Service 호출
    const result = await bookingService.createBooking(
      userId,
      performanceId,
      quantity,
      paymentMethod
    );

    res.status(201).send({
      message:
        "Booking and payment intent created. Please proceed to payment execution.",
      ...result,
    });
  } catch (error) {
    logger.exception("[BookingController:createBooking]", error);
    res.status(error.status || 500).send({ error: error.message });
  }
};

/**
 * 2. 사용자의 모든 예매 내역 조회 API
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
    logger.exception("[BookingController:getMyBookings]", error);
    res.status(error.status || 500).send({ error: error.message });
  }
};

/**
 * 3. 예매 취소 API
 * 사용자의 예매 취소 요청을 처리합니다.
 */
const cancelBooking = async (req, res) => {
  try {
    const userId = req.headers["x-user-id"];
    const { bookingId } = req.body;

    // 1. 필수 입력값 검증
    if (!userId || !bookingId) {
      return res
        .status(400)
        .send({ error: "Both userId and bookingId are required." });
    }

    // 2. 예매 취소 서비스 호출
    const result = await bookingService.cancelBooking(userId, bookingId);
    res.status(200).send(result);
  } catch (error) {
    logger.exception("[BookingController:cancelBooking]", error);
    res.status(error.status || 500).send({ error: error.message });
  }
};

module.exports = {
  createBooking,
  getMyBookings,
  cancelBooking,
};
