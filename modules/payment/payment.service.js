const paymentRepository = require("./payment.repository");
const { db, admin } = require("../../config/firebase");
const { recordEvent, createLedgerEntries } = require("./payment.helper");
const { validatePerformanceID } = require("./validatePerformanceID");
const { getMockPaymentResult } = require("../mocks/PGprocess.mock");

/**
 * 결제 의향 생성 (booking.service에서 호출)
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
 * 실제 결제 실행 (Mock 결제 로직만 사용)
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
    `Executing payment for bookingId: ${bookingId}, userId: ${userId}, cardNumber: ${cardNumber}, cvv: ${cvv}`
  );

  // ✨ Mock 결제 로직 호출
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

  // Firestore 트랜잭션으로 모든 작업을 처리
  await db.runTransaction(async (t) => {
    const intentRef = db.collection("paymentIntents").doc(bookingId);
    const bookingRef = db.collection("bookings").doc(bookingId);

    const [intentDoc, bookingDoc] = await Promise.all([
      t.get(intentRef),
      t.get(bookingRef),
    ]);

    if (!intentDoc.exists) throw new Error("Payment intent not found");
    if (!bookingDoc.exists) throw new Error("Booking not found");

    const intentData = intentDoc.data();
    const performanceId = intentData.performanceId;
    const performanceData = await validatePerformanceID(performanceId);

    if (intentData.status !== "PENDING" && intentData.status !== "FAILURE") {
      throw new Error(
        `Payment cannot be processed. Current status is '${intentData.status}'.`
      );
    }

    if (performanceData.stock < bookingDoc.data().quantity && isSuccessMock) {
      throw new Error(`Performance ${performanceId} is out of stock.`);
    }

    t.update(intentRef, {
      status: finalStatus,
      pgData,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    t.update(bookingRef, {
      status: bookingFinalStatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    if (isSuccessMock) {
      createLedgerEntries(t, bookingId, intentData.amount);
    }
  });

  // 이벤트 기록
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
    response.failureDetails = {
      code: failureCode,
      message: failureMessage,
    };
  }

  return response;
};

module.exports = {
  createPaymentIntent,
  executePayment,
};
