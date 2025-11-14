const bookingRepository = require("./booking.repository");
const seatService = require("../seat/seat.service");
const paymentService = require("../payment/payment.service"); // 결제 서비스와 연동

// 고정된 좌석 가격 (실제로는 DB에서 조회)
const MOCK_SEAT_PRICE = 100000;

const createBooking = async (userId, performanceId, seatIds) => {
  if (!userId || !performanceId || !seatIds || seatIds.length === 0) {
    const error = new Error("User, performance, and seats are required.");
    error.status = 400;
    throw error;
  }

  const totalAmount = MOCK_SEAT_PRICE * seatIds.length;

  const bookingData = {
    userId,
    performanceId,
    seatIds,
    totalAmount,
  };

  // 1. 좌석 잠금 및 예매 문서 생성 (트랜잭션)
  const bookingId = await bookingRepository.createBookingWithSeatLock(
    bookingData
  );

  try {
    // 2. 결제 서비스에 결제 의향(Intent) 생성 요청
    const intentId = await paymentService.createPaymentIntent(
      bookingId,
      totalAmount
    );

    // 성공 시 bookingId와 intentId 반환
    return { bookingId, intentId, totalAmount };
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
  // 이미 확정된 예매는 취소 불가 (별도 환불 정책 필요)
  if (booking.status === "confirmed")
    throw new Error("Cannot cancel a confirmed booking.");

  // 1. 좌석 잠금 해제
  await seatService.releaseSeats(booking.performanceId, booking.seatIds);

  // 2. 예매 상태 'cancelled'로 업데이트
  await bookingRepository.updateBookingStatus(bookingId, "cancelled");

  // (개념) 만약 결제 시스템에 `cancel` API가 있다면 여기서 호출
  // await paymentService.cancelPayment(booking.paymentIntentId);

  return { message: "Booking cancelled successfully." };
};

// (개념) 결제 성공/실패 이벤트가 발생했을 때 호출될 함수
// 예: Cloud Function이나 메시지 큐 핸들러에서 호출
const handlePaymentResult = async (paymentResult) => {
  const { orderId: bookingId, status } = paymentResult;
  if (status === "SUCCESS") {
    await bookingRepository.updateBookingStatus(bookingId, "confirmed");
  } else {
    const booking = await bookingRepository.getBookingById(bookingId);
    if (booking) {
      await seatService.releaseSeats(booking.performanceId, booking.seatIds);
      await bookingRepository.updateBookingStatus(bookingId, "failed");
    }
  }
};

module.exports = {
  createBooking,
  getMyBookings,
  cancelBooking,
  handlePaymentResult, // 외부 시스템 연동을 위한 함수
};
