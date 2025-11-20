const { db, admin } = require("../../config/firebase");

/**
 * 'paymentIntents' 컬렉션에 새 문서를 생성합니다.
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
 * 회계 원장(Ledger) 문서를 생성합니다. (트랜잭션 내에서 사용)
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
 * 공연 재고를 차감하고 참여자를 추가합니다. (트랜잭션 내에서 사용)
 */
const updatePerformanceStock = (t, performanceRef, userId) => {
  t.update(performanceRef, {
    stock: admin.firestore.FieldValue.increment(-1),
    participants: admin.firestore.FieldValue.arrayUnion(userId),
  });
};

module.exports = {
  createIntent,
  createLedgerEntries,
  updatePerformanceStock,
};
