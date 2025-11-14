const paymentRepository = require("./payment.repository");
const { admin } = require("../../config/firebase");

// --- 비즈니스 로직 레이어 ---

const createPaymentIntent = async (orderId, amount) => {
  if (!orderId || !amount || amount <= 0) {
    const error = new Error("Invalid orderId or amount");
    error.status = 400;
    throw error;
  }
  return paymentRepository.createIntent(orderId, amount);
};

const executePayment = async (intentId, paymentMethodToken, cvv) => {
  if (!intentId || !paymentMethodToken || !cvv) {
    const error = new Error("Missing intentId, token, or cvv");
    error.status = 400;
    throw error;
  }

  console.log(`Processing token: ${paymentMethodToken.substring(0, 4)}...`);
  console.log(`Simulating with CVV: ***${cvv.slice(-1)}`);

  // CVV 기반 Mock 로직
  const lastDigit = cvv.slice(-1);
  let isSuccessMock = false;
  let pgFailureCode = "GENERIC_DECLINE";
  let failureConcept = "CLIENT_ERROR";

  if (["0", "1", "9"].includes(lastDigit)) {
    isSuccessMock = true;
    pgFailureCode = null;
    failureConcept = null;
  } else if (lastDigit === "4") {
    pgFailureCode = "CARD_DECLINED_4XX";
    failureConcept = "CLIENT_ERROR";
  } else if (lastDigit === "5") {
    pgFailureCode = "PG_INTERNAL_ERROR_5XX";
    failureConcept = "SERVER_ERROR";
  } else {
    pgFailureCode = `UNKNOWN_DECLINE_${lastDigit}`;
    failureConcept = "CLIENT_ERROR";
  }

  const pgMockData = {
    isSuccess: isSuccessMock,
    failureCode: pgFailureCode,
    failureConcept: failureConcept,
    processedAt: new Date().toISOString(),
  };

  let finalStatus = "";

  // 트랜잭션 실행
  await paymentRepository.runPaymentTransaction(
    intentId,
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
        paymentRepository.createLedgerEntries(
          t,
          intentId,
          data.amount,
          data.orderId
        );
        await paymentRepository.emitEvent("PAYMENT_SUCCESS", {
          intentId,
          orderId: data.orderId,
        });
      } else {
        finalStatus = "FAILURE";
        t.update(intentRef, {
          status: finalStatus,
          pgMockData,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        await paymentRepository.emitEvent("PAYMENT_FAILURE", {
          intentId,
          orderId: data.orderId,
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
