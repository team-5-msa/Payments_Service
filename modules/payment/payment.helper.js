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
 * 회계 원장(Ledger) 문서를 생성
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

module.exports = {
  recordEvent,
  createLedgerEntries,
};
