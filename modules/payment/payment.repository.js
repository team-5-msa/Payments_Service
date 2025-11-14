const { db, admin } = require("@/config/firebase");

// --- 데이터베이스 상호작용 레이어 ---

/**
 * 'paymentIntents' 컬렉션에 새 문서를 생성합니다.
 */
const createIntent = async (orderId, amount) => {
  const intentRef = db.collection("paymentIntents").doc();
  const intentId = intentRef.id;

  await intentRef.set({
    intentId,
    orderId,
    amount,
    status: "PENDING",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return intentId;
};

/**
 * 분산 트랜잭션 이벤트(Saga)를 발행합니다.
 */
const emitEvent = async (type, payload) => {
  console.log(`[Event Emitted]: ${type}`, payload);
  try {
    await db.collection("events").add({
      type,
      payload,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error("Failed to emit event:", error);
  }
};

/**
 * 결제 원장(차변/대변)을 기록합니다. (트랜잭션 내에서 호출)
 */
const createLedgerEntries = (t, intentId, amount, orderId) => {
  const ledgerRef = db.collection("ledgerEntries");

  const debitEntry = ledgerRef.doc();
  t.set(debitEntry, {
    intentId,
    orderId,
    account: "CUSTOMER_PAYABLE",
    type: "DEBIT",
    value: amount,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const creditEntry = ledgerRef.doc();
  t.set(creditEntry, {
    intentId,
    orderId,
    account: "MERCHANT_BALANCE",
    type: "CREDIT",
    value: amount,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
};

/**
 * 결제 실행 로직을 Firestore 트랜잭션으로 실행합니다.
 * @param {string} intentId - 결제 의향 ID
 * @param {Function} updateFn - 트랜잭션 내부에서 실행될 비즈니스 로직 함수
 */
const runPaymentTransaction = async (intentId, updateFn) => {
  const intentRef = db.collection("paymentIntents").doc(intentId);
  return db.runTransaction(updateFn(intentRef));
};

module.exports = {
  createIntent,
  emitEvent,
  createLedgerEntries,
  runPaymentTransaction,
};
