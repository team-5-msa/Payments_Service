const paymentRepository = require("./payment.repository");
const { recordEvent } = require("./payment.helper");
const {
  getMockPaymentResult,
  processMockRefund,
} = require("../mocks/PGprocess.mock");
const logger = require("../../utils/logger");
const { NotFoundError, BadRequestError } = require("../../utils/errorHandler"); // 에러 처리 추가

// ❌ 순환 참조 문제로 인해 상단에서 bookingService를 require하는 것을 제거합니다.

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
    throw new BadRequestError(
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

  logger.info("[PaymentService]", `Intent created for booking: ${bookingId}`);
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
  // ✨ 순환 참조 회피를 위해 함수 내부에서 require 합니다.
  const bookingService = require("../booking/booking.service");

  if (!bookingId || !paymentMethodToken || !cvv) {
    throw new BadRequestError("Missing bookingId, token, or cvv");
  }

  logger.info(
    "[PaymentService]",
    `Executing payment for bookingId: ${bookingId}`
  ); // 1. PaymentIntent 조회 (Booking 정보는 조회하지 않음)

  const intentData = await paymentRepository.getPaymentIntent(bookingId);
  if (!intentData) throw new NotFoundError("Payment intent not found"); // 2. 상태 검증

  if (intentData.status !== "PENDING" && intentData.status !== "FAILURE") {
    throw new BadRequestError(
      `Payment cannot be processed. Status: ${intentData.status}`
    );
  } // 3. Booking 유효성 검사 위임 (Service-to-Service)

  try {
    // 이 시점에 bookingService는 완전히 로드된 상태입니다.
    await bookingService.validateBookingForPayment(bookingId, userId);
  } catch (error) {
    // Booking이 유효하지 않은 경우 (PENDING 상태가 아니거나 사용자 불일치 등)
    throw new BadRequestError(`Booking validation failed: ${error.message}`);
  } // 4. Mock PG 결제 실행

  const lastDigit = cvv.slice(-1);
  const { isSuccessMock, failureCode, failureMessage } =
    getMockPaymentResult(lastDigit);

  const pgData = {
    isSuccess: isSuccessMock,
    failureCode,
    failureMessage,
    processedAt: new Date().toISOString(),
  };

  const finalStatus = isSuccessMock ? "SUCCESS" : "FAILURE"; // 5. Payment 트랜잭션 처리 (오직 Payment DB만 수정)

  await paymentRepository.completePaymentTransaction(
    bookingId,
    finalStatus,
    pgData,
    intentData.amount,
    isSuccessMock
  ); // 6. Booking 상태 업데이트 요청 (Service-to-Service)

  try {
    if (isSuccessMock) {
      await bookingService.confirmBookingPayment(bookingId);
    } else {
      await bookingService.failBookingPayment(bookingId);
    }
  } catch (bookingError) {
    // 결제는 성공했는데 Booking 상태 업데이트가 실패한 경우 (치명적 오류)
    logger.error(
      "[PaymentService: CRITICAL]",
      `Payment success but Booking update failed: ${bookingError.message}`,
      { bookingId, paymentStatus: finalStatus }
    );
  } // 7. 이벤트 기록

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
  if (!intentData) throw new NotFoundError("PaymentIntent not found");

  if (intentData.status !== "SUCCESS") {
    throw new BadRequestError(
      "Refund is allowed only for SUCCESS payment status."
    );
  }
  if (intentData.userId !== userId) {
    throw new UnauthorizedError("User mismatch for refund request.");
  } // 2. Mock PG 환불

  const pgRefundResult = await processMockRefund(bookingId);
  if (!pgRefundResult.success) {
    await recordEvent(
      bookingId,
      "REFUND_FAILURE",
      { msg: "PG Fail" },
      "FAILED"
    );
    throw new Error("PG Refund Failed");
  } // 3. DB 상태 업데이트 (PaymentIntent만)

  await paymentRepository.updateIntentToRefunded(bookingId); // 4. 이벤트 기록

  await recordEvent(
    bookingId,
    "REFUND_SUCCESS",
    { refundId: pgRefundResult.refundId, amount: intentData.amount },
    "SUCCESS"
  ); // 5. 결과 반환 (Booking 업데이트는 호출자가 수행함)

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

// 현재 서비스 간의 강한 결합(순환 참조 우회) 문제를 근본적으로 해결하기 위해, 직접 호출 대신 이벤트 발행/구독 모델을 도입하는 작업입니다.

// 1. ⚙️ Event Bus 구현 및 준비
// utils/eventBus.js 파일을 만듭니다.

// subscribe(eventName, handler) (리스너 등록)와 publish(eventName, data) (이벤트 발행 및 비동기 실행) 두 가지 기능만 가진 간단한 인메모리 메시지 버스를 구현합니다.

// 2. 💸 Payment Service: 발행자 역할 수행
// payment.service.js 파일에서 bookingService에 대한 모든 require를 제거합니다.

// 결제 성공/실패 시 Booking Service 함수를 직접 호출하는 대신, Event Bus를 통해 다음 이벤트를 발행합니다.

// 성공 시: eventBus.publish('payment.completed', { bookingId, ... })

// 실패 시: eventBus.publish('payment.failed', { bookingId, ... })

// 3. 🎫 Booking Service: 구독자 역할 수행
// booking.service.js 파일에 initializeSubscribers(eventBus) 함수를 추가합니다.

// 이 함수는 Event Bus를 받아 payment.completed 및 payment.failed 이벤트를 구독하고, 해당 이벤트 발생 시 기존의 confirmBookingPayment 또는 failBookingPayment 함수를 비동기적으로 실행하도록 연결합니다.

// 앱 시작점에서 이 initializeSubscribers 함수를 호출하여 리스너를 활성화합니다.
