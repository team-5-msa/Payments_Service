const bookingService = require("./booking.service");

<<<<<<< HEAD
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

=======
// (가정) req.user는 인증 미들웨어를 통해 주입됩니다.
const mockAuth = (req, res, next) => {
  req.user = { id: "user_123" }; // 테스트용 사용자 ID
  next();
};

const createBooking = async (req, res) => {
  try {
    const userId = req.user.id;
    // (수정) 클라이언트로부터 paymentMethod를 추가로 받음
    const { performanceId, seatIds, paymentMethod } = req.body;

    // (수정) 서비스 함수에 paymentMethod 인자 추가 전달
>>>>>>> parent of 3accf10 (Add occupiedSeats API and refactor booking/payment flows)
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
<<<<<<< HEAD
    const userId = req.headers["x-user-id"];
    if (!userId) {
      return res
        .status(401)
        .send({ error: "User identification is missing in headers." });
    }
=======
    const userId = req.user.id;
>>>>>>> parent of 3accf10 (Add occupiedSeats API and refactor booking/payment flows)
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
<<<<<<< HEAD
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

=======
    const userId = req.user.id;
    const { id: bookingId } = req.params;
>>>>>>> parent of 3accf10 (Add occupiedSeats API and refactor booking/payment flows)
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
<<<<<<< HEAD
=======
  mockAuth, // 라우터에서 사용
>>>>>>> parent of 3accf10 (Add occupiedSeats API and refactor booking/payment flows)
};
