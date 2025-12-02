// booking.service.js (performanceService와 에러 핸들링을 동기화)

const bookingRepository = require("./booking.repository");
const performanceService = require("../mocks/mockPerformance.service"); // Mock Performance Service
const scheduleBookingExpiration = require("./booking.helper");
const {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  BadRequestError,
} = require("../../utils/errorHandler");
const logger = require("../../utils/logger");
const eventBus = require("../../utils/eventBus");

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
  performanceService.seedPerformance(performanceId); // Mock 데이터 시드 생성

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

    // 7. 결제 의향 생성 이벤트 발행
    eventBus.publish("BOOKING_CREATED", {
      bookingId,
      userId,
      totalAmount,
      paymentMethod,
      performanceId,
    });

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

  if (booking.status === "PENDING") {
    await updateBookingStatus(bookingId, "CANCELLED");

    // 결제 취소 이벤트 발행
    eventBus.publish("BOOKING_CANCELLED", { bookingId });

    await performanceService.cancelTickets(
      booking.performanceId,
      booking.quantity
    );

    return { message: "Booking cancelled successfully before payment." };
  }

  if (booking.status === "PAID") {
    logger.info(
      "[BookingService]",
      `Initiating refund for Booking ${bookingId}`
    );

    // 환불 요청 이벤트 발행
    eventBus.publish("REFUND_REQUESTED", { bookingId, userId });

    return {
      message: "Refund process initiated.",
    };
  }

  throw new BadRequestError("Booking cannot be cancelled in current status.");
};

/**
 * 환불 완료 처리 (Subscriber가 호출)
 */
const completeBookingRefund = async (bookingId) => {
  const booking = await bookingRepository.getBookingById(bookingId);
  if (!booking) {
    logger.error(
      `[BookingService] Booking ${bookingId} not found for refund completion.`
    );
    return;
  }

  // Idempotency Check
  if (booking.status === "REFUNDED") {
    logger.info(
      `[BookingService] Booking ${bookingId} is already REFUNDED. Skipping.`
    );
    return;
  }

  await updateBookingStatus(bookingId, "REFUNDED");
  await performanceService.cancelTickets(
    booking.performanceId,
    booking.quantity
  );
  logger.info(
    `[BookingService] Booking ${bookingId} refunded and stock restored.`
  );
};

/**
 * 결제 성공 시 Booking 상태 확정 (PaymentService가 호출)
 */
const confirmBookingPayment = async (bookingId) => {
  const booking = await bookingRepository.getBookingById(bookingId);
  if (!booking) return;

  // Idempotency Check
  if (booking.status === "PAID") {
    logger.info(
      `[BookingService] Booking ${bookingId} is already PAID. Skipping.`
    );
    return;
  }

  if (booking.status === "CANCELLED") {
    logger.warn(
      `[BookingService] Received PAYMENT_COMPLETED for CANCELLED booking ${bookingId}. Requesting refund.`
    );
    eventBus.publish("REFUND_REQUESTED", { bookingId, userId: booking.userId });
    return;
  }

  await updateBookingStatus(bookingId, "PAID");
  logger.info(`[BookingService] Booking ${bookingId} confirmed as PAID.`);
};

/**
 * 결제 실패 시 Booking 상태 처리 (PaymentService가 호출)
 */
const failBookingPayment = async (bookingId) => {
  const booking = await bookingRepository.getBookingById(bookingId);
  if (!booking) return;

  // Idempotency Check
  if (booking.status === "PAYMENT_FAILED") {
    logger.info(
      `[BookingService] Booking ${bookingId} is already marked as PAYMENT_FAILED. Skipping.`
    );
    return;
  }

  if (booking.status === "CANCELLED") {
    logger.info(
      `[BookingService] Received PAYMENT_FAILED for CANCELLED booking ${bookingId}. Ignoring.`
    );
    return;
  }

  await updateBookingStatus(bookingId, "PAYMENT_FAILED");
  logger.info(
    `[BookingService] Booking ${bookingId} marked as PAYMENT_FAILED.`
  );
};

module.exports = {
  createBooking,
  getMyBookings,
  cancelBooking,
  completeBookingRefund,
  confirmBookingPayment,
  failBookingPayment,
};
