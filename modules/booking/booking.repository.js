const { db, admin } = require("../../config/firebase");

/**
 * 예매 정보를 받아 Firestore에 'pending' 상태로 저장합니다.
 */
const createBooking = async (bookingData) => {
  const bookingRef = db.collection("bookings").doc();
  const bookingId = bookingRef.id;

<<<<<<< HEAD
  await bookingRef.set({
    ...bookingData,
    bookingId,
    status: "pending",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
=======
  // 트랜잭션 시작
  await db.runTransaction(async (t) => {
    // 1. 중앙 좌석 관리 컬렉션에서 좌석 잠금 시도
    // (수정) bookingId를 인자로 추가하여 전달합니다.
    await lockSeatsWithTransaction(
      t,
      bookingData.performanceId,
      bookingData.seatIds,
      bookingData.userId,
      bookingId // <--- 이 부분을 추가해야 합니다.
    );

    // 2. 예매 문서 생성을 위한 데이터 준비
    const { seatDetails, ...restOfBookingData } = bookingData;
    const total_amount =
      seatDetails?.reduce((sum, seat) => sum + seat.price, 0) || 0;

    // 3. 예매 문서 생성
    t.set(bookingRef, {
      ...restOfBookingData,
      bookingId,
      total_amount,
      status: "pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 4. 예매 문서 하위의 'booked_Seats' 서브컬렉션에 좌석 정보 기록
    if (seatDetails && seatDetails.length > 0) {
      seatDetails.forEach((seat) => {
        const seatDocRef = bookingRef.collection("booked_Seats").doc(seat.id);
        t.set(seatDocRef, {
          price: seat.price,
          type: seat.type,
          status: "locked",
          userId: bookingData.userId,
        });
      });
    }
>>>>>>> parent of 3accf10 (Add occupiedSeats API and refactor booking/payment flows)
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
