const { db, admin } = require("../../config/firebase");
const { createLedgerEntries } = require("./payment.helper");

/**
 * 결제 의향(PaymentIntent) 생성
 */
const createIntent = async (
  bookingId,
  userId,
  amount,
  paymentMethod,
  performanceId
) => {
  const intentRef = db.collection("paymentIntents").doc(bookingId);

  // Firestore에 저장할 데이터 객체
  const dataToSave = {
    paymentIntentId: bookingId, // bookingId를 paymentIntentId로 사용
    bookingId,
    userId,
    amount,
    status: "PENDING",
    paymentMethod,
    performanceId,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  // set()을 사용하여 문서를 생성하거나 덮어씁니다.
  await intentRef.set(dataToSave);

  // console.log(
  //   `[PaymentRepository] Intent ${bookingId} created with data:`,
  //   dataToSave
  // );
};

/**
 * 단순 상태 업데이트 (Non-Transaction)
 */
const updateIntentStatusNonTx = async (bookingId, status) => {
  const intentRef = db.collection("paymentIntents").doc(bookingId);
  await intentRef.update({
    status: status,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  // console.log(`[PaymentRepository] Intent ${bookingId} updated to ${status}`);
};

/**
 * ✨ [변경] 결제 의향 정보만 조회 (Booking 정보 조회 제거)
 */
const getPaymentIntent = async (bookingId) => {
  const intentRef = db.collection("paymentIntents").doc(bookingId);
  const intentDoc = await intentRef.get();

  return intentDoc.exists ? intentDoc.data() : null;
};

/**
 * [Transaction] 결제 실행 결과 반영
 * ✨ [변경] Booking 상태 업데이트 제거 (오직 PaymentIntent와 원장만 처리)
 */
const completePaymentTransaction = async (
  bookingId,
  finalStatus,
  pgData,
  amount,
  isSuccessMock
) => {
  await db.runTransaction(async (t) => {
    const intentRef = db.collection("paymentIntents").doc(bookingId);

    // PaymentIntent 업데이트
    t.update(intentRef, {
      status: finalStatus,
      pgData,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 성공 시 원장 기록
    if (isSuccessMock) {
      createLedgerEntries(t, bookingId, amount);
    }
  });
};

/**
 * [Transaction] 환불 처리 반영
 */
const updateIntentToRefunded = async (bookingId) => {
  await db.runTransaction(async (t) => {
    const intentRef = db.collection("paymentIntents").doc(bookingId);

    // Intent 상태만 변경
    t.update(intentRef, {
      status: "REFUNDED",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
};

module.exports = {
  createIntent,
  updateIntentStatusNonTx,
  getPaymentIntent, // 이름 변경됨
  completePaymentTransaction,
  updateIntentToRefunded,
};
