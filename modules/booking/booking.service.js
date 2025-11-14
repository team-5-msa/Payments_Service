const bookingRepository = require("./booking.repository");
const seatService = require("../seat/seat.service");
const paymentService = require("../payment/payment.service");

// 고정된 좌석 가격 (실제로는 공연 정보에서 좌석 등급별 가격을 조회해야 함)
const MOCK_SEAT_PRICE = 30000;
const MOCK_SEAT_TYPE = "VIP";

const createBooking = async (userId, performanceId, seatIds, paymentMethod) => {
  if (!userId || !performanceId || !seatIds || seatIds.length === 0) {
    const error = new Error("User, performance, and seats are required.");
    error.status = 400;
    throw error;
  }

  // (수정) 레포지토리에 전달할 좌석 상세 정보와 총액을 동적으로 생성
  const seatDetails = seatIds.map((id) => ({
    id,
    price: MOCK_SEAT_PRICE,
    type: MOCK_SEAT_TYPE,
  }));
  const totalAmount = seatDetails.reduce((sum, seat) => sum + seat.price, 0);

  const bookingData = {
    userId,
    performanceId,
    seatIds, // seat.repository에서 사용할 좌석 ID 목록
    seatDetails, // booking.repository에서 서브컬렉션 생성에 사용
  };

  // 1. 좌석 잠금 및 예매 문서 생성 (트랜잭션)
  // bookingId는 이 단계에서 생성됨
  const bookingId = await bookingRepository.createBookingWithSeatLock(
    bookingData
  );

  try {
    // 2. 결제 서비스에 결제 의향(Intent) 생성 요청
    // (수정) 명세서에 맞게 userId와 paymentMethod 추가 전달
    const paymentIntentId = await paymentService.createPaymentIntent(
      bookingId,
      userId,
      totalAmount,
      paymentMethod
    );

    // 성공 시 bookingId와 paymentIntentId 반환
    return { bookingId, paymentIntentId, totalAmount };
  } catch (error) {
    // 결제 의향 생성 실패 시, 잠갔던 좌석을 즉시 해제 (보상 트랜잭션)
    console.error(
      `[Booking Rollback] Failed to create payment intent for booking ${bookingId}. Releasing seats.`
    );
    await seatService.releaseSeats(performanceId, seatIds);
    await bookingRepository.updateBookingStatus(bookingId, "failed"); // 예매 상태 'failed'로 변경
    throw new Error(
      "Failed to create payment intent. Booking has been rolled back."
    );
  }
};

const getMyBookings = async (userId) => {
  return bookingRepository.getMyBookings(userId);
};

const cancelBooking = async (userId, bookingId) => {
  const booking = await bookingRepository.getBookingById(bookingId);

  if (!booking) throw new Error("Booking not found.");
  if (booking.userId !== userId)
    throw new Error("Unauthorized to cancel this booking.");
  if (booking.status === "confirmed")
    throw new Error("Cannot cancel a confirmed booking.");

  // 1. 좌석 잠금 해제
  await seatService.releaseSeats(booking.performanceId, booking.seatIds);

  // 2. 예매 상태 'cancelled'로 업데이트
  await bookingRepository.updateBookingStatus(bookingId, "cancelled");

  return { message: "Booking cancelled successfully." };
};

// 결제 성공/실패 이벤트가 발생했을 때 호출될 함수
const handlePaymentResult = async (paymentResult) => {
  const { bookingId, status } = paymentResult; // payload에 bookingId가 있다고 가정
  const booking = await bookingRepository.getBookingById(bookingId);

  if (!booking) {
    console.error(`[Payment Handler] Booking ${bookingId} not found.`);
    return;
  }

  if (status === "SUCCESS") {
    // (수정) 이미 처리된 건이 아니라면 'confirmed'로 변경
    if (booking.status !== "confirmed") {
      await bookingRepository.updateBookingStatus(bookingId, "confirmed");
    }
  } else {
    // (수정) 이미 처리된 건이 아니라면 롤백 수행
    if (booking.status !== "failed" && booking.status !== "cancelled") {
      await seatService.releaseSeats(booking.performanceId, booking.seatIds);
      await bookingRepository.updateBookingStatus(bookingId, "failed");
    }
  }
};

module.exports = {
  createBooking,
  getMyBookings,
  cancelBooking,
  handlePaymentResult,
};
