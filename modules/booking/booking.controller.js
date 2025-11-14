const bookingService = require("./booking.service");

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
    const result = await bookingService.createBooking(
      userId,
      performanceId,
      seatIds,
      paymentMethod
    );

    res.status(201).send({
      message: "Booking initiated. Please proceed to payment.",
      ...result,
    });
  } catch (error) {
    res.status(error.status || 500).send({ error: error.message });
  }
};

const getMyBookings = async (req, res) => {
  try {
    const userId = req.user.id;
    const bookings = await bookingService.getMyBookings(userId);
    res.status(200).send(bookings);
  } catch (error) {
    res.status(error.status || 500).send({ error: error.message });
  }
};

const cancelBooking = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id: bookingId } = req.params;
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
  mockAuth, // 라우터에서 사용
};
