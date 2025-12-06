const paymentRepository = require("@modules/payment/payment.repository");
const {
  getMockPaymentResult,
  processMockRefund,
} = require("@modules/mocks/PGprocess.mock");
const logger = require("@utils/logger");
const {
  NotFoundError,
  BadRequestError,
  UnauthorizedError,
} = require("@utils/errorHandler");
const eventBus = require("@utils/eventBus");

/**
 * 결제 의향 생성
 */
const createPaymentIntent = async (
  bookingId,
  userId,
  amount,
  reservationId,
  paymentMethod,
  performanceId
) => {
  if (
    !bookingId ||
    !userId ||
    !amount ||
    amount <= 0 ||
    !paymentMethod ||
    !performanceId ||
    !reservationId
  ) {
    throw new BadRequestError(
      "Missing or invalid parameters for payment intent creation."
    );
  }

  // Idempotency Check
  const existingIntent = await paymentRepository.getPaymentIntent(bookingId);
  if (existingIntent) {
    logger.info(
      "[PaymentService]",
      `Payment intent already exists for booking: ${bookingId}. Skipping creation.`
    );
    return { message: "Payment intent already exists.", bookingId };
  }

  await paymentRepository.createIntent(
    bookingId,
    userId,
    amount,
    reservationId,
    paymentMethod,
    performanceId
  );

  logger.info("[PaymentService]", `Intent created for booking: ${bookingId}`);
  return {
    message: "Payment intent successfully created.",
    bookingId,
    totalAmount: amount,
    paymentIntentId: bookingId,
  };
};

/**
 * 실제 결제 실행
 */
const executePayment = async (
  userId,
  bookingId,
  paymentMethodToken,
  cardNumber,
  cvv,
  token
) => {
  if (!bookingId || !paymentMethodToken || !cvv) {
    throw new BadRequestError("Missing bookingId, token, or cvv");
  }

  logger.info(
    "[PaymentService]",
    `Executing payment for bookingId: ${bookingId}`
  ); // 1. PaymentIntent 조회 (Booking 정보는 조회하지 않음)

  const intentData = await paymentRepository.getPaymentIntent(bookingId);
  if (!intentData) {
    throw new NotFoundError(
      `Payment intent not found for bookingId: ${bookingId}. Ensure createPaymentIntent is called first.`
    );
  } // 2. 상태 검증

  if (intentData.status !== "PENDING" && intentData.status !== "FAILURE") {
    throw new BadRequestError(
      `Payment cannot be processed. Status: ${intentData.status}`
    );
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

  const finalStatus = isSuccessMock ? "SUCCESS" : "FAILURE"; // 5. Payment 트랜잭션 처리 (오직 Payment DB만 수정)

  await paymentRepository.completePaymentTransaction(
    bookingId,
    finalStatus,
    pgData,
    intentData.amount,
    isSuccessMock
  ); // 6. 결제 성공/실패 이벤트 발행

  if (isSuccessMock) {
    eventBus.publish("PAYMENT_COMPLETED", {
      bookingId,
      userId,
      token,
    });
  } else {
    eventBus.publish("PAYMENT_FAILED", {
      bookingId,
      userId,
      token,
    });
  } // 7. 이벤트 기록

  await paymentRepository.recordEvent(
    bookingId,
    userId,
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
const refundPayment = async (bookingId, userId, token) => {
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
    await paymentRepository.recordEvent(
      bookingId,
      userId,
      "REFUND_FAILURE",
      { msg: "PG Fail" },
      "FAILED"
    );
    throw new Error("PG Refund Failed");
  } // 3. DB 상태 업데이트 (PaymentIntent만)

  await paymentRepository.updateIntentToRefunded(bookingId); // 4. 환불 완료 이벤트 발행
  eventBus.publish("REFUND_COMPLETED", { bookingId, token });

  // 5. 이벤트 기록
  await paymentRepository.recordEvent(
    bookingId,
    userId,
    "REFUND_SUCCESS",
    { refundId: pgRefundResult.refundId, amount: intentData.amount },
    "REFUNDED"
  ); // 6. 결과 반환 (Booking 업데이트는 호출자가 수행함)

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
  const intent = await paymentRepository.getPaymentIntent(bookingId);
  if (!intent) {
    logger.warn(
      `[PaymentService] Cannot cancel intent for ${bookingId}: Not found.`
    );
    return;
  }

  if (intent.status === "CANCELLED") {
    logger.info(
      `[PaymentService] Intent for ${bookingId} is already CANCELLED.`
    );
    return;
  }

  await paymentRepository.updateIntentStatusNonTx(bookingId, "CANCELLED");
  await paymentRepository.recordEvent(
    bookingId,
    userId,
    "INTENT_CANCELLED",
    {},
    "CANCELLED"
  );
};

const getEventStatus = async (bookingId) => {
  if (!bookingId) {
    throw new BadRequestError("bookingId is required to fetch payment status.");
  }

  const eventStatus = await paymentRepository.getEventStatus(bookingId);

  if (!eventStatus) {
    throw new NotFoundError(
      `Payment intent not found for bookingId: ${bookingId}`
    );
  }

  // Return only the finalStatus field from the eventStatus
  return eventStatus;
};

module.exports = {
  createPaymentIntent,
  executePayment,
  refundPayment,
  updateIntentStatusForCancellation,
  getEventStatus,
};
