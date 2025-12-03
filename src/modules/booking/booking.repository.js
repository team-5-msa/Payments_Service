const { db, admin } = require("../../config/firebase");
const { generateBookingId } = require("../../utils/generateBookingId");

/**
 * 예매 정보를 받아 Firestore에 새로운 문서를 생성합니다.
 */
const createBooking = async (bookingData) => {
  // 🎯 커스텀 ID 생성
  const { userId, performanceId } = bookingData;
  const customBookingId = generateBookingId(performanceId, userId);

  // Firestore에 문서를 수동으로 생성 (커스텀 ID 사용)
  const bookingRef = db.collection("bookings").doc(customBookingId);

  await bookingRef.set({
    ...bookingData,
    bookingId: customBookingId,
    status: "PENDING",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(`[Booking Created] New booking ID: ${customBookingId}`);
  return customBookingId;
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
 * 예매 문서에 외부 서비스의 reservationId를 업데이트합니다.
 */
const updateBookingReservationId = async (bookingId, reservationId) => {
  const bookingRef = db.collection("bookings").doc(bookingId);

  await bookingRef.update({
    reservationId: reservationId,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(
    `[Booking ReservationId Updated] Booking ID: ${bookingId}, Reservation ID: ${reservationId}`
  );
};

/**
 *  특정 사용자가 특정 공연에 대해 'PAID' 상태로 구매한 총 티켓 수를 조회합니다.
 */
// booking.repository.js (수정된 로직)

/**
 * 사용자별, 공연별로 현재 활성화된(결제 완료 또는 대기 중인) 티켓 수량을 조회합니다.
 * @param {string} userId
 * @param {string} performanceId
 * @returns {Promise<number>} 활성화된 티켓 총 수량
 */
const getActiveTicketCount = async (userId, performanceId) => {
  const snapshot = await db
    .collection("bookings")
    .where("userId", "==", userId)
    .where("performanceId", "==", performanceId)
    // [핵심 수정]: PAID 상태와 PENDING(예매 진행 중) 상태를 모두 포함하여 조회합니다.
    .where("status", "in", ["PAID", "PENDING"])
    .get();

  if (snapshot.empty) {
    return 0;
  }

  // 조회된 모든 예매의 'quantity'를 합산합니다.
  let totalQuantity = 0;
  snapshot.forEach((doc) => {
    // quantity 필드가 숫자인지 확인하고 합산 (안전한 코딩)
    const quantity = doc.data().quantity;
    if (typeof quantity === "number") {
      totalQuantity += quantity;
    }
  });

  return totalQuantity;
};

module.exports = {
  createBooking,
  getMyBookings,
  getBookingById,
  updateBookingStatus,
  updateBookingReservationId,
  getActiveTicketCount,
};
