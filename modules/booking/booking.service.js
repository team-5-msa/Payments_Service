const bookingRepository = require("./booking.repository");
const paymentService = require("../payment/payment.service");
const performanceService = require("./performance.service");

// ✨ 예매 한도 상수를 선언합니다.
const MAX_TICKETS_PER_USER = 10;

/**
 * 1. 예매 생성 및 결제 의향 생성
 */
const createBooking = async (
  userId,
  performanceId,
  quantity,
  paymentMethod
) => {
  //사용자의 기존 예매 수량 확인
  const existingTickets = await bookingRepository.getPaidTicketCount(
    userId,
    performanceId
  );

  // 예매 한도 검사
  if (existingTickets + quantity > MAX_TICKETS_PER_USER) {
    const error = new Error(
      `You cannot book more than ${MAX_TICKETS_PER_USER} tickets for this performance. You have already booked ${existingTickets} tickets.`
    );
    error.status = 400; // Bad Request
    throw error;
  }

  // performance.service.js를 통해 공연 정보를 가져옵니다.
  const performanceData = await performanceService.getPerformanceById(
    performanceId
  );

  // 공연 정보가 없는 경우에 대한 예외 처리
  if (!performanceData) {
    const error = new Error(
      `Performance with ID '${performanceId}' not found.`
    );
    error.status = 404;
    throw error;
  }

  const totalAmount = performanceData.price * quantity;

  // 재고 확인 (Mock 데이터 기준)
  // performanceData.stock는 현재 재고 수량 quantity는 사용자가 예매하려는 수량
  if (performanceData.stock < quantity) {
    const error = new Error(
      `Not enough stock for performance '${performanceId}'.`
    );
    error.status = 409; // Conflict
    throw error;
  }

  // seatIds 배열 생성
  const seatIds = Array.from({ length: quantity }, (_, i) => `A${i + 1}`);

  // 예매 문서 생성
  const bookingId = await bookingRepository.createBooking({
    userId,
    performanceId,
    quantity,
    totalAmount,
    seatIds,
  });

  try {
    // 결제 의향 생성 (payment.service 호출)
    await paymentService.createPaymentIntent(
      bookingId,
      userId,
      totalAmount,
      paymentMethod,
      performanceId
    );

    // 클라이언트에게 결과 반환
    return { bookingId, totalAmount };
  } catch (error) {
    // 결제 의향 생성 실패 시 보상 트랜잭션
    console.error(
      `[Booking Rollback] For booking ${bookingId}, marking as failed.`
    );
    await bookingRepository.updateBookingStatus(bookingId, "failed");
    // 원래 발생한 에러를 그대로 던져주기
    throw error;
  }
};

/**
 * 2. 내 예매 내역 조회
 */
const getMyBookings = async (userId) => {
  return bookingRepository.getMyBookings(userId);
};

/**
 * 3. 예매 취소
 */
const cancelBooking = async (userId, bookingId) => {
  const booking = await bookingRepository.getBookingById(bookingId);

  if (!booking || booking.userId !== userId || booking.status !== "pending") {
    const error = new Error("Booking not found or cannot be cancelled.");
    error.status = 400;
    throw error;
  }

  await bookingRepository.updateBookingStatus(bookingId, "cancelled");
  return { message: "Booking cancelled successfully." };
};

module.exports = {
  createBooking,
  getMyBookings,
  cancelBooking,
};
