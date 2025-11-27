// booking.service.js (performanceService와 에러 핸들링을 동기화)

const bookingRepository = require("./booking.repository");
const paymentRepository = require("../payment/payment.repository");
const paymentService = require("../payment/payment.service");
const performanceService = require("../mocks/mockPerformance.service"); // Mock Performance Service

// ✨ 예매 한도 상수
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
  performanceService.seedPerformance(performanceId); // [테스트용] 초기 데이터 시드 만들기
  // 1. 기존 예매 수량 확인 (Repository 사용)
  const existingTickets = await bookingRepository.getActiveTicketCount(
    userId,
    performanceId
  );

  // 2. 예매 한도 검사
  if (existingTickets + quantity > MAX_TICKETS_PER_USER) {
    // HttpError 대신 Status를 가진 일반 Error 객체 사용 (상위 컨트롤러에서 처리)
    const error = new Error(
      `You cannot book more than ${MAX_TICKETS_PER_USER} tickets. Already booked: ${existingTickets}.`
    );
    error.status = 400; // 400 Bad Request
    throw error;
  }

  // 3. 공연 정보 조회 (Performance Service 호출)
  // performanceService는 404 HttpError를 throw/reject하므로, 별도 try-catch 없이 상위로 전달됨.
  const performanceData = await performanceService.getPerformanceById(
    performanceId
  );
  // 참고: performanceData가 null인 경우, 이미 service 내부에서 404 에러로 처리되어 여기서 별도 확인 불필요.

  // 4. 재고 확인 (이 로직은 이제 performanceService.reserveTickets 내부에서 처리됩니다.)
  // performanceService.reserveTickets를 호출하기 전에 재고 확인을 명시적으로 제거하여,
  // 재고 확인 로직이 Performance Service로 일원화되도록 합니다. (SRP 원칙 준수)
  //  if (!performanceData) {
  //   const error = new Error(`Performance '${performanceId}' not found.`);
  //   error.status = 404;
  //   throw error;
  // }
  // 같은 의미로 재고 부족 검사는 reserveTickets 내부로 이동되었습니다.

  const totalAmount = performanceData.price * quantity;
  const seatIds = Array.from({ length: quantity }, (_, i) => `A${i + 1}`);

  // 5. 예매 문서 생성 (Repository 사용)
  const bookingId = await bookingRepository.createBooking({
    userId,
    performanceId,
    quantity,
    totalAmount,
    seatIds,
  });

  try {
    // 6. 재고 차감 (Mock Service 호출)
    // 이 호출은 내부에서 재고 부족 시 409 HttpError를 throw/reject합니다.
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
    // 8. 보상 트랜잭션 (실패 시 롤백)
    console.error(
      `[Booking Rollback] Booking ${bookingId} failed. Reverting... Error: ${error.message}`
    );

    // 상태 업데이트 (Repository 사용)
    await bookingRepository.updateBookingStatus(bookingId, "failed");

    // [중요] 재고 복구 (Mock Service 호출)
    // 이전 단계(reserveTickets)에서 재고가 차감되었을 가능성이 있으므로 무조건 복구 시도.
    // performanceService.cancelTickets는 ID 오류(404)에 대해서는 에러를 던지지만,
    // 이 시점에서는 ID가 유효하므로 안전하게 호출 가능.
    await performanceService.cancelTickets(performanceId, quantity);

    // 발생한 에러를 상위 호출자(Controller)에게 그대로 다시 던져서 적절한 HTTP 응답을 하도록 위임.
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

  if (!booking || booking.userId !== userId) {
    const error = new Error("Booking not found or not owned by user.");
    error.status = 400;
    throw error;
  }

  // Case A: 결제 전 (PENDING) -> 단순 취소
  if (booking.status === "PENDING") {
    // 1. Booking 상태 취소 (Repository 사용)
    await bookingRepository.updateBookingStatus(bookingId, "CANCELLED");

    // 2. PaymentIntent 상태 취소 (Repository 패턴 적용)
    await paymentRepository.updateIntentStatusNonTx(bookingId, "CANCELLED");

    // 3. 재고 복구 (Mock Service 일원화)
    await performanceService.cancelTickets(
      booking.performanceId,
      booking.quantity
    );

    return { message: "Booking cancelled successfully before payment." };
  }

  // Case B: 결제 완료 (PAID) -> 환불 프로세스
  if (booking.status === "PAID") {
    // 환불 로직은 PaymentService에 위임되어 있음 (PaymentService 내부에서 재고 복구 처리 필요)
    const refundResult = await paymentService.refundPayment(bookingId, userId);

    return { message: "Booking refunded successfully.", ...refundResult };
  }

  const error = new Error("Booking cannot be cancelled in current status.");
  error.status = 400;
  throw error;
};

module.exports = {
  createBooking,
  getMyBookings,
  cancelBooking,
};
