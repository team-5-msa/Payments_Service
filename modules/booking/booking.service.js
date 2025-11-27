// booking.service.js (performanceService와 에러 핸들링을 동기화)

const bookingRepository = require("./booking.repository");
const paymentService = require("../payment/payment.service");
const performanceService = require("../mocks/mockPerformance.service"); // Mock Performance Service

// ✨ 예매 한도 상수
const MAX_TICKETS_PER_USER = 10;

// =========================================================================
// 👇 [개선] 상태 업데이트 로직을 Service 내부에 중앙화
// =========================================================================

/**
 * 내부적으로 Booking 상태 업데이트를 처리하고 부가 로직을 담당합니다.
 */
const updateBookingStatus = async (bookingId, status) => {
  // 1. Repository 호출로 상태 변경
  await bookingRepository.updateBookingStatus(bookingId, status);

  // 2. [미래 확장성] 상태 변경 이벤트 기록 등을 추가할 수 있습니다.
  console.log(
    `[BookingService] Booking ${bookingId} status updated to ${status}`
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
  performanceService.seedPerformance(performanceId); // [테스트용] 초기 데이터 시드 생성

  // 1. 기존 예매 수량 확인 (Repository 사용)
  const existingTickets = await bookingRepository.getActiveTicketCount(
    userId,
    performanceId
  );

  // 2. 예매 한도 검사
  if (existingTickets + quantity > MAX_TICKETS_PER_USER) {
    const error = new Error(
      `You cannot book more than ${MAX_TICKETS_PER_USER} tickets. Already booked: ${existingTickets}.`
    );
    error.status = 400; // 400 Bad Request
    throw error;
  }

  // 3. 공연 정보 조회 (Performance Service 호출)
  const performanceData = await performanceService.getPerformanceById(
    performanceId
  );

  const totalAmount = performanceData.price * quantity;
  const seatIds = Array.from({ length: quantity }, (_, i) => `A${i + 1}`);

  // 4. 예매 문서 생성 (Repository 사용)
  const bookingId = await bookingRepository.createBooking({
    userId,
    performanceId,
    quantity,
    totalAmount,
    seatIds,
  });

  try {
    // 5. 재고 차감 (Mock Service 호출)
    await performanceService.reserveTickets(performanceId, quantity);

    // 6. 결제 의향 생성
    await paymentService.createPaymentIntent(
      bookingId,
      userId,
      totalAmount,
      paymentMethod,
      performanceId
    );

    return { bookingId, totalAmount };
  } catch (error) {
    // 7. 보상 트랜잭션 (실패 시 롤백)
    console.error(
      `[Booking Rollback] Booking ${bookingId} failed. Reverting... Error: ${error.message}`
    );

    // 상태 업데이트 (Service 함수 사용)
    await updateBookingStatus(bookingId, "FAILED");

    // [중요] 재고 복구 (Mock Service 호출)
    // 재고 복구 실패 시 원본 에러를 방해하지 않도록 try/catch로 감싸 로그 기록
    try {
      await performanceService.cancelTickets(performanceId, quantity);
      console.log(`[Rollback Success] Stock restored for ${performanceId}.`);
    } catch (stockError) {
      console.error(
        `[CRITICAL ROLLBACK FAILURE] Failed to restore stock for ${performanceId}. Error: ${stockError.message}`
      );
    }

    // 발생한 에러를 상위 호출자에게 그대로 다시 던짐.
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
    // 1. Booking 상태 취소 (Service 함수 사용)
    await updateBookingStatus(bookingId, "CANCELLED"); // 👈 [개선 적용]

    // 2. PaymentIntent 상태 취소 (Service 패턴 적용)
    await paymentService.updateIntentStatusForCancellation(bookingId);

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

    // [참고] refundPayment가 성공하면, 내부적으로 Booking 상태도 CANCELLED/REFUNDED로 변경되어야 합니다.
    // 상태 변경은 성공시에 부킹 자체에서 반영하도록 리팩토링할까? 지금 환불을 위임하고 성공하면 payment에서 booking의 상태도 바꿔주고 있는데
    // 이거 나중에 분리해야겠지? 성공 시그널을 받으면 booking 내부에서 상태변경 자체적으로 처리하도록 말이야
    // 목표는 결제(Payment)와 예약(Booking) 서비스 간의 강한 결합을 끊고 이벤트 기반 통신 모델을 확립하는 것입니다.
    // 🎯 목표: 환불 프로세스의 서비스 책임 분리
    // 현상: BookingService의 환불 요청(cancelBooking) 시, PaymentService 내부(refundPayment)에서 직접 Booking 상태를 업데이트하고 있습니다. (강한 결합)

    // 최종 목표: PaymentService는 자신의 책임만 수행하고 이벤트 발행으로 작업을 완료합니다. BookingService는 이 이벤트를 비동기로 구독하여 자신의 상태를 독립적으로 업데이트합니다.
    // 여기서는 PaymentService가 그 역할을 하도록 위임합니다.

    // BookingService는 환불 요청을 시작하고, PaymentService가 환불을 처리하며, 성공 시 이벤트를 발행합니다. BookingService는 이 이벤트를 구독하여 상태를 업데이트합니다.
    // 이렇게 하면 두 서비스 간의 결합도가 낮아지고, 각 서비스는 자신의 책임에 집중할 수 있습니다. 이는 마이크로서비스 아키텍처의 원칙에 부합합니다.
    // 따라서, refundPayment 함수 내에서 Booking 상태 업데이트를 제거하고, 이벤트 발행 메커니즘을 구현하는 것이 좋습니다.
    // 이것 말고도 강한 결합 있으면 다 제거하고 리팩토링해줘~

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
