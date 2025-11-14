const paymentRepository = require("./payment.repository");
const { admin } = require("../../config/firebase");

// --- 비즈니스 로직 레이어 ---

// (수정) 명세서에 맞게 파라미터 추가
const createPaymentIntent = async (
  bookingId,
  userId,
  amount,
  paymentMethod
) => {
  if (!bookingId || !userId || !amount || amount <= 0) {
    const error = new Error("Invalid bookingId, userId, or amount");
    error.status = 400;
    throw error;
  }
  // (수정) 모든 정보를 레포지토리에 전달
  return paymentRepository.createIntent(
    bookingId,
    userId,
    amount,
    paymentMethod
  );
};

const executePayment = async (paymentIntentId, paymentMethodToken, cvv) => {
  if (!paymentIntentId || !paymentMethodToken || !cvv) {
    const error = new Error("Missing paymentIntentId, token, or cvv");
    error.status = 400;
    throw error;
  }

  // --- CVV 기반 Mock 결제 시뮬레이션 로직 (유지) ---
  const lastDigit = cvv.slice(-1);
  let isSuccessMock = ["0", "1", "9"].includes(lastDigit);
  let pgFailureCode = isSuccessMock ? null : `DECLINE_${lastDigit}`;
  let failureConcept = isSuccessMock ? null : "CLIENT_ERROR";
  // ... (이하 Mock 로직은 동일)

  const pgMockData = {
    isSuccess: isSuccessMock,
    failureCode: pgFailureCode,
    failureConcept,
    processedAt: new Date().toISOString(),
  };

  let finalStatus = "";

  // 트랜잭션 실행
  await paymentRepository.runPaymentTransaction(
    paymentIntentId,
    (intentRef) => async (t) => {
      const doc = await t.get(intentRef);
      if (!doc.exists) throw new Error("Payment intent not found");

      const data = doc.data();
      if (data.status !== "PENDING")
        throw new Error("Payment already processed");

      if (isSuccessMock) {
        finalStatus = "SUCCESS";
        t.update(intentRef, {
          status: finalStatus,
          pgMockData,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // (수정) 명세서에 맞는 필드명으로 레포지토리 함수 호출
        paymentRepository.createLedgerEntries(
          t,
          paymentIntentId,
          data.amount,
          data.bookingId // data.orderId -> data.bookingId
        );
        await paymentRepository.emitEvent("PAYMENT_SUCCESS", {
          paymentIntentId,
          bookingId: data.bookingId, // data.orderId -> data.bookingId
        });
      } else {
        finalStatus = "FAILURE";
        t.update(intentRef, {
          status: finalStatus,
          pgMockData,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        await paymentRepository.emitEvent("PAYMENT_FAILURE", {
          paymentIntentId,
          bookingId: data.bookingId, // data.orderId -> data.bookingId
          failureConcept,
        });
      }
    }
  );

  return { finalStatus, pgMockData };
};

module.exports = {
  createPaymentIntent,
  executePayment,
};
