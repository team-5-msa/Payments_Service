const bookingService = require("./booking.service");

const createBooking = async (req, res) => {
  try {
    const { performanceId, seatIds, paymentMethod, userId } = req.body;
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
    // [수정] URL 파라미터에서 userId를 직접 가져옵니다.
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).send({ error: "User ID is required in the URL." });
    }

    const bookings = await bookingService.getMyBookings(userId);
    res.status(200).send(bookings);
  } catch (error) {
    res.status(error.status || 500).send({ error: error.message });
  }
};

const cancelBooking = async (req, res) => {
  try {
    // [수정] URL 파라미터에서 userId를 가져옵니다.
    const { userId } = req.params;
    // [수정] Request Body에서 bookingId를 가져옵니다.
    const { bookingId } = req.body;

    if (!userId || !bookingId) {
      return res
        .status(400)
        .send({ error: "User ID in URL and bookingId in body are required." });
    }

    const result = await bookingService.cancelBooking(userId, bookingId);
    res.status(200).send(result);
  } catch (error) {
    // 서비스 로직에서 발생하는 '권한 없음' 등의 에러를 그대로 전달
    res.status(error.status || 500).send({ error: error.message });
  }
};

// (참고) 이 미들웨어는 현재 createBooking에서 사용되지 않습니다.
// 나중에 실제 인증을 구현할 때 다시 사용될 것입니다
const mockAuth = (req, res, next) => {
  req.user = { id: "user_123" };
  next();
};

module.exports = {
  createBooking,
  getMyBookings,
  cancelBooking,
  mockAuth,
};
