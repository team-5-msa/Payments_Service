const { db, admin } = require("../../config/firebase");

/**
 * 예매 정보를 받아 Firestore에 새로운 문서를 생성합니다.
 */
const createBooking = async (bookingData) => {
  const bookingRef = db.collection("bookings").doc();
  const bookingId = bookingRef.id;

  await bookingRef.set({
    ...bookingData,
    bookingId: bookingId,
    status: "pending",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return bookingId;
};

/**
 * 특정 사용자의 모든 예매 내역을 조회합니다.
 * createdAt 필드를 기준으로 내림차순으로 정렬됩니다.
 */
const getMyBookings = async (userId) => {
  const snapshot = await db
    .collection("bookings")
    .where("userId", "==", userId)
    .orderBy("createdAt", "desc")
    .get();

  if (snapshot.empty) {
    return [];
  }

  return snapshot.docs.map((doc) => doc.data());
};

/**
 * 특정 예매 문서를 ID로 조회합니다.
 */
const getBookingById = async (bookingId) => {
  const bookingRef = db.collection("bookings").doc(bookingId);
  const doc = await bookingRef.get();

  return doc.exists ? doc.data() : null;
};

/**
 * 특정 예매 문서의 상태를 업데이트합니다.
 */
const updateBookingStatus = async (bookingId, status) => {
  const bookingRef = db.collection("bookings").doc(bookingId);

  await bookingRef.update({
    status: status,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(
    `[Booking Status Updated] Booking ID: ${bookingId}, New Status: ${status}`
  );
};

/**
 *  특정 사용자가 특정 공연에 대해 'PAID' 상태로 구매한 총 티켓 수를 조회합니다.
 */
const getPaidTicketCount = async (userId, performanceId) => {
  const snapshot = await db
    .collection("bookings")
    .where("userId", "==", userId)
    .where("performanceId", "==", performanceId)
    .where("status", "==", "PAID") // 최종 확정된 예매만 계산
    .get();

  if (snapshot.empty) {
    return 0;
  }

  // 조회된 모든 예매의 'quantity'를 합산합니다.
  let totalQuantity = 0;
  snapshot.forEach((doc) => {
    totalQuantity += doc.data().quantity || 0;
  });

  return totalQuantity;
};

module.exports = {
  createBooking,
  getMyBookings,
  getBookingById,
  updateBookingStatus,
  getPaidTicketCount,
};
