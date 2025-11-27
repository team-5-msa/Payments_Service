const { db, admin } = require("../../config/firebase");

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
  await intentRef.set({
    paymentIntentId: intentRef.id,
    bookingId,
    userId,
    amount,
    status: "PENDING",
    paymentMethod,
    performanceId,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
};

/**
 * 회계 원장 생성 (Internal Helper)
 */
const createLedgerEntries = (t, bookingId, amount) => {
  const ledgerRef = db.collection("ledgerEntries");
  const timestamp = admin.firestore.FieldValue.serverTimestamp();

  const debitEntry = ledgerRef.doc();
  t.set(debitEntry, {
    bookingId,
    account: "CUSTOMER_PAYABLE",
    type: "DEBIT",
    amount,
    createdAt: timestamp,
  });

  const creditEntry = ledgerRef.doc();
  t.set(creditEntry, {
    bookingId,
    account: "MERCHANT_BALANCE",
    type: "CREDIT",
    amount,
    createdAt: timestamp,
  });
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
  console.log(`[PaymentRepository] Intent ${bookingId} updated to ${status}`);
};

/**
 * 데이터 조회용 (Intent & Booking)
 */
const getIntentAndBooking = async (bookingId) => {
  const intentRef = db.collection("paymentIntents").doc(bookingId);
  const bookingRef = db.collection("bookings").doc(bookingId);

  const [intentDoc, bookingDoc] = await Promise.all([
    intentRef.get(),
    bookingRef.get(),
  ]);

  return {
    intentData: intentDoc.exists ? intentDoc.data() : null,
    bookingData: bookingDoc.exists ? bookingDoc.data() : null,
  };
};

/**
 * [Transaction] 결제 실행 결과 반영
 * Service에서 DB 트랜잭션을 직접 다루지 않도록 캡슐화함
 */
const completePaymentTransaction = async (
  bookingId,
  finalStatus, // PaymentIntent status (SUCCESS/FAILURE)
  bookingFinalStatus, // Booking status (PAID/PAYMENT_FAILED)
  pgData,
  amount,
  isSuccessMock
) => {
  await db.runTransaction(async (t) => {
    const intentRef = db.collection("paymentIntents").doc(bookingId);
    const bookingRef = db.collection("bookings").doc(bookingId);

    // 상태 업데이트
    t.update(intentRef, {
      status: finalStatus,
      pgData,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    t.update(bookingRef, {
      status: bookingFinalStatus,
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
const completeRefundTransaction = async (bookingId) => {
  await db.runTransaction(async (t) => {
    const intentRef = db.collection("paymentIntents").doc(bookingId);
    const bookingRef = db.collection("bookings").doc(bookingId);

    // Intent 상태 변경
    t.update(intentRef, {
      status: "REFUNDED",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Booking 상태 변경
    t.update(bookingRef, {
      status: "REFUNDED",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
};

// ✨ 깔끔해진 exports
module.exports = {
  createIntent,
  updateIntentStatusNonTx,
  getIntentAndBooking,
  completePaymentTransaction,
  completeRefundTransaction,
};
