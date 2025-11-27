const paymentRepository = require("./payment.repository");
const { recordEvent } = require("./payment.helper");
const {
  getMockPaymentResult,
  processMockRefund,
} = require("../mocks/PGprocess.mock");
const performanceService = require("../mocks/mockPerformance.service");
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
  if (
    !bookingId ||
    !userId ||
    !amount ||
    amount <= 0 ||
    !paymentMethod ||
    !performanceId
  ) {
    throw new Error(
      "Missing or invalid parameters for payment intent creation."
    );
  }

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
 * 실제 결제 실행
 */
const executePayment = async (
  userId,
  bookingId,
  paymentMethodToken,
  cardNumber,
  cvv
) => {
  if (!bookingId || !paymentMethodToken || !cvv) {
    const error = new Error("Missing bookingId, token, or cvv");
    error.status = 400;
    throw error;
  }

  console.log(
    `Executing payment for bookingId: ${bookingId}, userId: ${userId}`
  );

  // 1. 데이터 조회 (Repo 사용)
  const { intentData, bookingData } =
    await paymentRepository.getIntentAndBooking(bookingId);

  if (!intentData) throw new Error("Payment intent not found");
  if (!bookingData) throw new Error("Booking not found");

  // 2. 상태 검증
  if (intentData.status !== "PENDING" && intentData.status !== "FAILURE") {
    throw new Error(
      `Payment cannot be processed. Current status is '${intentData.status}'.`
    );
  }

  // 3. 재고 검증 (Mock Service 사용 - Firestore 재고 확인 로직 대체)
  const performanceData = await performanceService.getPerformanceById(
    intentData.performanceId
  );
  // 주의: createBooking에서 이미 재고를 잡았기 때문에 여기선 정보만 확인하거나,
  // 만약 결제 시점에 재고를 다시 체크해야 한다면 아래 로직 유지.
  if (performanceData.stock < bookingData.quantity) {
    // 이미 예약된 수량 외에 추가 재고가 필요한 로직이 아니라면, 이 체크는 생략 가능할 수 있음.
    // 여기서는 '유효한 공연인지' 확인하는 용도로 유지.
  }

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
  const bookingFinalStatus = isSuccessMock ? "PAID" : "PAYMENT_FAILED";

  // 5. 트랜잭션 처리 (Repo 위임)
  await paymentRepository.completePaymentTransaction(
    bookingId,
    finalStatus,
    bookingFinalStatus,
    pgData,
    intentData.amount,
    isSuccessMock
  );

  // 6. 이벤트 기록
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
  // 1. 결제 상태 확인 (Repo 사용)
  const { intentData, bookingData } =
    await paymentRepository.getIntentAndBooking(bookingId);

  if (!intentData || !bookingData)
    throw new Error("Booking or PaymentIntent not found");

  if (intentData.status !== "SUCCESS" && bookingData.status !== "PAID") {
    throw new Error("환불은 결제 완료 상태(PAID)에서만 가능합니다.");
  }

  // 2. Mock PG사 환불 처리
  const pgRefundResult = await processMockRefund(bookingId);
  if (!pgRefundResult.success) {
    // [추가]: 환불 실패 이벤트 기록
    await recordEvent(
      bookingId,
      "REFUND_FAILURE",
      { message: "PG Refund Failed" },
      "FAILED"
    );
    throw new Error("PG 환불 실패");
  }

  // 3. DB 상태 업데이트
  await paymentRepository.completeRefundTransaction(bookingId);

  // 4. [핵심 추가]: 환불 성공 이벤트 기록
  await recordEvent(
    bookingId,
    "REFUND_SUCCESS", // ⬅️ 배치 잡이 찾는 이벤트 타입
    { refundId: pgRefundResult.refundId, amount: intentData.amount },
    "SUCCESS" // ⬅️ 배치 잡이 찾는 최종 상태
  );

  // 5. 재고 복구 (Mock Service 일원화)
  await performanceService.cancelTickets(
    bookingData.performanceId,
    bookingData.quantity
  );

  return { refunded: true, refundId: pgRefundResult.refundId };
};

/**
 * Booking Service에서 호출하여 PaymentIntent의 상태를 업데이트합니다.
 * 트랜잭션 외부에서 실행됩니다.
 */
const updateIntentStatusForCancellation = async (bookingId) => {
  // 1. 상태 업데이트 실행 (Repo 호출)
  // paymentRepository.updateIntentStatusNonTx를 호출합니다.
  await paymentRepository.updateIntentStatusNonTx(bookingId, "CANCELLED");

  // 2. 이벤트 기록
  recordEvent(
    bookingId,
    "INTENT_CANCELLED_PRE_PAYMENT",
    { reason: "Booking cancelled by user" },
    "CANCELLED"
  );

  console.log(
    `[PaymentService] Intent ${bookingId} status updated to CANCELLED for pre-payment.`
  );
};

module.exports = {
  createPaymentIntent,
  executePayment,
  refundPayment,
  updateIntentStatusForCancellation,
};
