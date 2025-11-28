const { db, admin } = require("../../config/firebase");

/**
 * 백업 데이터: events 컬렉션에 기록
 */
const recordEvent = async (bookingId, eventType, pgMockData, finalStatus) => {
  await db.collection("events").add({
    bookingId,
    eventType,
    details: pgMockData,
    finalStatus,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
};

/**
 * ✨ [통합된 로직] 회계 원장(Ledger) 문서를 생성
 * Firestore 트랜잭션 (t) 내에서 호출되어야 합니다.
 */
const createLedgerEntries = (t, bookingId, amount) => {
  const ledgerRef = db.collection("ledgerEntries");
  const timestamp = admin.firestore.FieldValue.serverTimestamp();

  // 차변 (Debit): 부채(고객에게 갚아야 할 돈) 감소 또는 자산 증가
  const debitEntry = ledgerRef.doc();
  t.set(debitEntry, {
    bookingId,
    account: "CUSTOMER_PAYABLE", // 고객에게 받아야 할 돈 (자산)
    type: "DEBIT",
    amount,
    createdAt: timestamp,
  });

  // 대변 (Credit): 부채 증가 또는 자산 감소
  const creditEntry = ledgerRef.doc();
  t.set(creditEntry, {
    bookingId,
    account: "MERCHANT_BALANCE", // 상인(우리) 잔고 (자본)
    type: "CREDIT",
    amount,
    createdAt: timestamp,
  });
};

module.exports = {
  recordEvent,
  createLedgerEntries,
};
