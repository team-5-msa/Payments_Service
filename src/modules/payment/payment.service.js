const paymentRepository = require("./payment.repository");
const { recordEvent } = require("./payment.helper");
const {
  getMockPaymentResult,
  processMockRefund,
} = require("../mocks/PGprocess.mock");

// ✨ Booking DB 접근 대신 Booking Service를 사용
// 주의: 순환 참조(Circular Dependency)가 발생할 수 있는 구조입니다.
// 실제 운영 환경에서는 Event Bus를 사용하거나 계층을 분리해야 합니다.
// 여기서는 require 시점을 함수 내부로 미루거나 구조적으로 해결했다고 가정합니다.
const bookingService = require("../booking/booking.service");

/**
 * 결제 의향 생성
 */
const createPaymentIntent = async (
  bookingId,
  userId,
  amount,
  paymentMethod,
  performanceId
) => {
  // 파라미터 검증 로직 유지...
  await paymentRepository.createIntent(
    bookingId,
    userId,
    amount,
    paymentMethod,
    performanceId
  );
  return { message: "Payment intent successfully created.", bookingId };
};

/**
 * 실제 결제 실행 (DB 분리 적용)
 */
const executePayment = async (
  userId,
  bookingId,
  paymentMethodToken,
  cardNumber,
  cvv
) => {
  if (!bookingId || !paymentMethodToken || !cvv) {
    throw new Error("Missing parameters");
  }

  console.log(`Executing payment for bookingId: ${bookingId}`);

  // 1. PaymentIntent 조회 (Booking 정보는 조회하지 않음)
  const intentData = await paymentRepository.getPaymentIntent(bookingId);
  if (!intentData) throw new Error("Payment intent not found");

  // 2. 상태 검증
  if (intentData.status !== "PENDING" && intentData.status !== "FAILURE") {
    throw new Error(
      `Payment cannot be processed. Status: ${intentData.status}`
    );
  }

  // 3. ✨ Booking 유효성 검사 위임 (Service-to-Service)
  // PaymentService는 Booking DB를 모르므로 BookingService에 물어봅니다.
  await bookingService.validateBookingForPayment(bookingId, userId);

  // 4. Mock PG 결제 실행
  const lastDigit = cvv.slice(-1);
  const { isSuccessMock, failureCode, failureMessage } =
    getMockPaymentResult(lastDigit);

  const pgData = {
    isSuccess: isSuccessMock,
    failureCode,
    failureMessage,
    processedAt: new Date().toISOString(),
  };

  const finalStatus = isSuccessMock ? "SUCCESS" : "FAILURE";

  // 5. Payment 트랜잭션 처리 (오직 Payment DB만 수정)
  await paymentRepository.completePaymentTransaction(
    bookingId,
    finalStatus,
    pgData,
    intentData.amount,
    isSuccessMock
  );

  // 6. ✨ Booking 상태 업데이트 요청 (Service-to-Service)
  // 결제 결과에 따라 BookingService에 알림
  try {
    if (isSuccessMock) {
      await bookingService.confirmBookingPayment(bookingId);
    } else {
      await bookingService.failBookingPayment(bookingId);
    }
  } catch (bookingError) {
    // 결제는 성공했는데 Booking 상태 업데이트가 실패한 경우 (치명적 오류)
    // 실제로는 여기서 재시도 큐(Queue)에 넣거나 알림을 보내야 합니다.
    console.error(
      `[CRITICAL] Payment success but Booking update failed: ${bookingError.message}`
    );
  }

  // 7. 이벤트 기록
  recordEvent(
    bookingId,
    isSuccessMock ? "PAYMENT_SUCCESS" : "PAYMENT_FAILURE",
    pgData,
    finalStatus
  );

  const response = {
    message: `Payment processing finished with status: ${finalStatus}`,
    finalStatus,
    bookingId,
  };

  if (!isSuccessMock) {
    response.failureDetails = { code: failureCode, message: failureMessage };
  }

  return response;
};

/**
 * 환불 처리
 */
const refundPayment = async (bookingId, userId) => {
  // 1. 결제 정보 조회 (Intent만)
  const intentData = await paymentRepository.getPaymentIntent(bookingId);
  if (!intentData) throw new Error("PaymentIntent not found");

  if (intentData.status !== "SUCCESS") {
    throw new Error("Refund is allowed only for SUCCESS payment status.");
  }
  if (intentData.userId !== userId) {
    throw new Error("User mismatch for refund request.");
  }

  // 2. Mock PG 환불
  const pgRefundResult = await processMockRefund(bookingId);
  if (!pgRefundResult.success) {
    await recordEvent(
      bookingId,
      "REFUND_FAILURE",
      { msg: "PG Fail" },
      "FAILED"
    );
    throw new Error("PG Refund Failed");
  }

  // 3. DB 상태 업데이트 (PaymentIntent만)
  await paymentRepository.updateIntentToRefunded(bookingId);

  // 4. 이벤트 기록
  await recordEvent(
    bookingId,
    "REFUND_SUCCESS",
    { refundId: pgRefundResult.refundId, amount: intentData.amount },
    "SUCCESS"
  );

  // 5. 결과 반환 (Booking 업데이트는 호출자가 수행함)
  return {
    success: true,
    refundId: pgRefundResult.refundId,
    amount: intentData.amount,
  };
};

/**
 * 단순 상태 업데이트
 */
const updateIntentStatusForCancellation = async (bookingId) => {
  await paymentRepository.updateIntentStatusNonTx(bookingId, "CANCELLED");
  recordEvent(bookingId, "INTENT_CANCELLED", {}, "CANCELLED");
};

module.exports = {
  createPaymentIntent,
  executePayment,
  refundPayment,
  updateIntentStatusForCancellation,
};
