const { db, admin } = require("../../config/firebase");

// --- 데이터베이스 상호작용 레이어 ---

/**
 * 'paymentIntents' 컬렉션에 새 문서를 생성합니다.
 */
// (수정) 함수 파라미터 및 저장 필드 변경
const createIntent = async (bookingId, userId, amount, paymentMethod) => {
  const intentRef = db.collection("paymentIntents").doc();
  const paymentIntentId = intentRef.id;

  await intentRef.set({
    paymentIntentId, // 필드명 수정 (intentId -> paymentIntentId)
    bookingId, // 필드명 수정 (orderId -> bookingId)
    userId, // 필드 추가
    amount,
    status: "PENDING", // 명세서에 맞게 PENDING 또는 requires_payment_method 등
    paymentMethod, // 필드 추가
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return paymentIntentId;
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
// (수정) 함수 파라미터 및 저장 필드 변경
const createLedgerEntries = (t, paymentIntentId, amount, bookingId) => {
  const ledgerRef = db.collection("ledgerEntries");

  const debitEntry = ledgerRef.doc();
  t.set(debitEntry, {
    paymentIntentId, // 필드명 수정
    bookingId, // 필드명 수정
    account: "CUSTOMER_PAYABLE",
    type: "DEBIT",
    value: amount,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const creditEntry = ledgerRef.doc();
  t.set(creditEntry, {
    paymentIntentId, // 필드명 수정
    bookingId, // 필드명 수정
    account: "MERCHANT_BALANCE",
    type: "CREDIT",
    value: amount,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
};

/**
 * 결제 실행 로직을 Firestore 트랜잭션으로 실행합니다.
 * @param {string} paymentIntentId - 결제 의향 ID
 * @param {Function} updateFn - 트랜잭션 내부에서 실행될 비즈니스 로직 함수
 */
// (수정) 파라미터 변수명 변경 (intentId -> paymentIntentId)
const runPaymentTransaction = async (paymentIntentId, updateFn) => {
  const intentRef = db.collection("paymentIntents").doc(paymentIntentId);
  return db.runTransaction(updateFn(intentRef));
};

module.exports = {
  createIntent,
  emitEvent,
  createLedgerEntries,
  runPaymentTransaction,
};
