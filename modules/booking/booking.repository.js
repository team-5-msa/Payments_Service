const { db, admin } = require("../../config/firebase");

/**
 * 예매 정보를 받아 Firestore에 'pending' 상태로 저장합니다.
 */
const createBooking = async (bookingData) => {
  const bookingRef = db.collection("bookings").doc();
  const bookingId = bookingRef.id;

  await bookingRef.set({
    ...bookingData,
    bookingId,
    status: "pending",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return bookingId;
};

/**
 * 특정 사용자의 모든 예매 내역을 조회합니다.
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
 * ID로 특정 예매 문서를 조회합니다.
 */
const getBookingById = async (bookingId) => {
  const doc = await db.collection("bookings").doc(bookingId).get();
  return doc.exists ? doc.data() : null;
};

/**
 * 특정 예매 문서의 상태를 업데이트합니다.
 */
const updateBookingStatus = async (bookingId, status) => {
  const bookingRef = db.collection("bookings").doc(bookingId);
  try {
    await bookingRef.update({
      status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(
      `[Booking Status Updated] Booking ID: ${bookingId}, Status: ${status}`
    );
  } catch (error) {
    console.error(
      `Error updating booking ${bookingId} to status ${status}:`,
      error
    );
    throw new Error(`Failed to update booking status for ${bookingId}.`);
  }
};

module.exports = {
  createBooking,
  getMyBookings,
  getBookingById,
  updateBookingStatus,
};
