// booking.service.js (performanceService와 에러 핸들링을 동기화)

const bookingRepository = require("./booking.repository");
const paymentService = require("../payment/payment.service");
const performanceService = require("../mocks/mockPerformance.service"); // Mock Performance Service
const scheduleBookingExpiration = require("./booking.helper");
const {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  BadRequestError,
} = require("../../utils/errorHandler");
const logger = require("../../utils/logger");

// ✨ 예매 한도 상수
const MAX_TICKETS_PER_USER = 10;

/**
 * 내부적으로 Booking 상태 업데이트를 처리
 */
const updateBookingStatus = async (bookingId, status) => {
  await bookingRepository.updateBookingStatus(bookingId, status);
  logger.info(
    "[BookingService]",
    `Booking ${bookingId} status updated to ${status}`
  );
};

/**
 * 1. 예매 생성 및 결제 의향 생성
 */
const createBooking = async (
  userId,
  performanceId,
  quantity,
  paymentMethod
) => {
  performanceService.seedPerformance(performanceId);

  // 1. 기존 예매 수량 확인
  const existingTickets = await bookingRepository.getActiveTicketCount(
    userId,
    performanceId
  );

  // 2. 예매 한도 검사
  if (existingTickets + quantity > MAX_TICKETS_PER_USER) {
    const error = new ConflictError(
      `You cannot book more than ${MAX_TICKETS_PER_USER} tickets. Already booked: ${existingTickets}.`
    );
    throw error;
  }

  // 3. 공연 정보 조회
  const performanceData = await performanceService.getPerformanceById(
    performanceId
  );

  const totalAmount = performanceData.price * quantity;
  const seatIds = Array.from({ length: quantity }, (_, i) => `A${i + 1}`);

  // 4. 예매 문서 생성
  const bookingId = await bookingRepository.createBooking({
    userId,
    performanceId,
    quantity,
    totalAmount,
    seatIds,
  });

  // 5. 예매 만료 스케줄링 시작
  // Service는 DB Snapshot이 아닌 ID만 넘깁니다. (결합도 낮춤)
  scheduleBookingExpiration(bookingId);
  logger.info(
    "[BookingService]",
    `Expiration timer scheduled for Booking ID: ${bookingId}`
  );

  try {
    // 6. 재고 차감
    await performanceService.reserveTickets(performanceId, quantity);

    // 7. 결제 의향 생성
    await paymentService.createPaymentIntent(
      bookingId,
      userId,
      totalAmount,
      paymentMethod,
      performanceId
    );

    return { bookingId, totalAmount };
  } catch (error) {
    // 8. 보상 트랜잭션 (롤백)
    logger.exception("[BookingService]", error);
    await updateBookingStatus(bookingId, "FAILED");

    try {
      await performanceService.cancelTickets(performanceId, quantity);
    } catch (stockError) {
      logger.error(
        "[BookingService]",
        `Stock restore failed: ${stockError.message}`
      );
    }

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

  if (!booking) {
    throw new NotFoundError("Booking not found.");
  }
  if (booking.userId !== userId) {
    throw new UnauthorizedError("Booking not owned by user.");
  }

  // Case A: 결제 전 (PENDING) -> 단순 취소
  if (booking.status === "PENDING") {
    // 1. Booking 상태 취소
    await updateBookingStatus(bookingId, "CANCELLED");

    // 2. PaymentIntent 상태 취소 요청 (PaymentService에 위임)
    await paymentService.updateIntentStatusForCancellation(bookingId);

    // 3. 재고 복구
    await performanceService.cancelTickets(
      booking.performanceId,
      booking.quantity
    );

    return { message: "Booking cancelled successfully before payment." };
  }

  // Case B: 결제 완료 (PAID) -> 환불 프로세스
  if (booking.status === "PAID") {
    logger.info(
      "[BookingService]",
      `Initiating refund for Booking ${bookingId}`
    );

    // 1. PaymentService에 환불 요청 (금융 처리 위임)
    // 이제 refundPayment는 Booking 상태를 건드리지 않고 결과만 반환합니다.
    const refundResult = await paymentService.refundPayment(bookingId, userId);

    // 2. 환불 성공 시, BookingService가 자신의 상태를 업데이트 (책임 회수)
    if (refundResult.success) {
      await updateBookingStatus(bookingId, "REFUNDED"); // 혹은 CANCELLED

      // 3. 재고 복구 (BookingService의 책임)
      await performanceService.cancelTickets(
        booking.performanceId,
        booking.quantity
      );

      logger.info("[BookingService]", `Refund complete. Stock restored.`);
    }

    return {
      message: "Booking refunded successfully.",
      refundId: refundResult.refundId,
    };
  }

  throw new BadRequestError("Booking cannot be cancelled in current status.");
};

/**
 * 결제 전 Booking이 유효한지 검증 (PaymentService가 호출)
 */
const validateBookingForPayment = async (bookingId, userId) => {
  const booking = await bookingRepository.getBookingById(bookingId);
  if (!booking) throw new NotFoundError("Booking not found");
  if (booking.userId !== userId) throw new UnauthorizedError("User mismatch");
  if (booking.status !== "PENDING")
    throw new BadRequestError("Booking is not pending");

  return booking;
};

/**
 * 결제 성공 시 Booking 상태 확정 (PaymentService가 호출)
 */
const confirmBookingPayment = async (bookingId) => {
  await updateBookingStatus(bookingId, "PAID");
  console.log(`[BookingService] Booking ${bookingId} confirmed as PAID.`);
};

/**
 * 결제 실패 시 Booking 상태 처리 (PaymentService가 호출)
 */
const failBookingPayment = async (bookingId) => {
  await updateBookingStatus(bookingId, "PAYMENT_FAILED");
  console.log(
    `[BookingService] Booking ${bookingId} marked as PAYMENT_FAILED.`
  );
};

module.exports = {
  createBooking,
  getMyBookings,
  cancelBooking,
  validateBookingForPayment,
  confirmBookingPayment,
  failBookingPayment,
};
