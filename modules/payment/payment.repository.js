const { db, admin } = require("../../config/firebase");

/**
 * 'paymentIntents' 컬렉션에 새 문서를 생성합니다.
 */
const createIntent = async (bookingId, userId, amount, paymentMethod) => {
  const intentRef = db.collection("paymentIntents").doc(bookingId);
  await intentRef.set({
    paymentIntentId: intentRef.id,
    bookingId,
    userId,
    amount,
    status: "PENDING",
    paymentMethod,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
};

/**
 * 'paymentIntents' 문서의 상태를 업데이트합니다.
 */
const updatePaymentIntentStatus = async (bookingId, status, pgMockData) => {
  const intentRef = db.collection("paymentIntents").doc(bookingId);
  await intentRef.update({
    status: status,
    pgMockData,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
};

/**
 * 'events' 문서의 상태를 업데이트합니다.
 */
const updateEventStatusByBookingId = async (bookingId, status) => {
  const eventsQuery = db
    .collection("events")
    .where("payload.bookingId", "==", bookingId);
  const eventSnapshot = await eventsQuery.get();

  if (eventSnapshot.empty) {
    console.warn(
      `[Repository] No event found for bookingId: ${bookingId}. Skipping event status update.`
    );
    return;
  }

  const eventDoc = eventSnapshot.docs[0];
  await eventDoc.ref.update({
    status: status,
    processedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
};

/**
 * 'bookings' 문서의 상태를 업데이트합니다.
 */
const updateBookingStatus = async (bookingId, status) => {
  const bookingRef = db.collection("bookings").doc(bookingId);
  await bookingRef.update({
    status: status,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
};

/**
 * 'performances' 재고를 업데이트합니다.
 */
const updateUserStock = async (performanceId) => {
  const performanceRef = db.collection("performances").doc(performanceId);
  await performanceRef.update({
    stock: admin.firestore.FieldValue.increment(-1),
  });
};

/**
 * 회계 원장을 생성합니다.
 */
const createLedgerEntries = async (bookingId, amount) => {
  const ledgerRef = db.collection("ledgerEntries");
  const debitEntry = ledgerRef.doc();
  const creditEntry = ledgerRef.doc();

  const batch = db.batch();
  batch.set(debitEntry, {
    bookingId,
    account: "CUSTOMER_PAYABLE",
    type: "DEBIT",
    amount,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  batch.set(creditEntry, {
    bookingId,
    account: "MERCHANT_BALANCE",
    type: "CREDIT",
    amount,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await batch.commit();
};

module.exports = {
  createIntent, // 복원된 함수
  updatePaymentIntentStatus,
  updateEventStatusByBookingId,
  updateBookingStatus,
  updateUserStock,
  createLedgerEntries,
};
