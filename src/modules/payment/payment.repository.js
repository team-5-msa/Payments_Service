const { db, admin } = require("@config/firebase");
const {
  generateCustomId,
  generateEventId,
  generateLedgerId,
} = require("@utils/generateId");
/**
 * 결제 의향(PaymentIntent) 생성
 */
const createIntent = async (
  bookingId,
  userId,
  amount,
  reservationId,
  paymentMethod,
  performanceId
) => {
  const intentRef = db.collection("paymentIntents").doc(bookingId);

  // Firestore에 저장할 데이터 객체
  const dataToSave = {
    paymentIntentId: bookingId,
    bookingId,
    userId,
    amount,
    reservationId,
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
 *  결제 의향 정보만 조회
 */
const getPaymentIntent = async (bookingId) => {
  const intentRef = db.collection("paymentIntents").doc(bookingId);
  const intentDoc = await intentRef.get();

  return intentDoc.exists ? intentDoc.data() : null;
};

const getEventStatus = async (bookingId) => {
  const eventsRef = db.collection("events");
  const snapshot = await eventsRef.where("bookingId", "==", bookingId).get();

  if (snapshot.empty) {
    return null;
  }

  // Assuming you want to return all events related to the bookingId
  const events = [];
  snapshot.forEach((doc) => {
    events.push(doc.data());
  });

  return events;
};

/**
 * [Transaction] 결제 실행 결과 반영
 */
const completePaymentTransaction = async (
  bookingId,
  userId, // userId 추가
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
      // 올바른 인수로 createLedgerEntries 호출
      createLedgerEntries(t, bookingId, userId, amount);
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

/**
 * 백업 데이터: events 컬렉션에 기록
 */
const recordEvent = async (bookingId, eventType, pgMockData, finalStatus) => {
  const eventId = generateEventId(bookingId, eventType);
  await db.collection("events").doc(eventId).set({
    eventId,
    bookingId,
    eventType,
    details: pgMockData,
    finalStatus,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
};

/**
 * 회계 원장(Ledger) 문서를 생성
 * Firestore 트랜잭션 (t) 내에서 호출되어야 합니다.
 */
const createLedgerEntries = (t, bookingId, userId, amount) => {
  const ledgerRef = db.collection("ledgerEntries");
  const timestamp = admin.firestore.FieldValue.serverTimestamp();

  // 차변 (Debit): 부채(고객에게 갚아야 할 돈) 감소 또는 자산 증가
  const debitId = generateLedgerId(bookingId, "DEBIT");
  const debitEntry = ledgerRef.doc(debitId);
  t.set(debitEntry, {
    ledgerId: debitId,
    bookingId,
    userId,
    account: "CUSTOMER_PAYABLE", // 고객에게 받아야 할 돈 (자산)
    type: "DEBIT",
    amount,
    createdAt: timestamp,
  });

  // 대변 (Credit): 부채 증가 또는 자산 감소
  const creditId = generateLedgerId(bookingId, "CREDIT");
  const creditEntry = ledgerRef.doc(creditId);
  t.set(creditEntry, {
    ledgerId: creditId,
    bookingId,
    userId,
    account: "MERCHANT_BALANCE", // 상인(우리) 잔고 (자본)
    type: "CREDIT",
    amount,
    createdAt: timestamp,
  });
};

module.exports = {
  createIntent,
  updateIntentStatusNonTx,
  getPaymentIntent,
  completePaymentTransaction,
  updateIntentToRefunded,
  getEventStatus,
  recordEvent,
  createLedgerEntries,
};
