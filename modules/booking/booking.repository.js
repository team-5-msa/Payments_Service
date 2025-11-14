const { db, admin } = require("@/config/firebase");
const { lockSeatsWithTransaction } = require("../seat/seat.repository");

/**
 * 좌석 잠금과 예매 생성을 하나의 트랜잭션으로 처리하고,
 * 예매에 연결된 좌석 정보를 서브컬렉션에 기록합니다.
 */
const createBookingWithSeatLock = async (bookingData) => {
  const bookingRef = db.collection("bookings").doc();
  const bookingId = bookingRef.id;

  // 트랜잭션 시작
  await db.runTransaction(async (t) => {
    // 1. 중앙 좌석 관리 컬렉션에서 좌석 잠금 시도
    await lockSeatsWithTransaction(
      t,
      bookingData.performanceId,
      bookingData.seatIds,
      bookingData.userId // 누가 잠그려는지 userId 전달
    );

    // 2. 예매 문서 생성
    const { seatDetails, ...restOfBookingData } = bookingData; // seatDetails 분리
    t.set(bookingRef, {
      ...restOfBookingData,
      bookingId,
      status: "pending", // 예매 생성 시 초기 상태는 'pending'
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 3. 예매 문서 하위의 'booked_Seats' 서브컬렉션에 좌석 정보 기록
    // bookingData에 좌석별 상세 정보(가격, 타입 등)가 포함되어 있다고 가정
    if (seatDetails && seatDetails.length > 0) {
      seatDetails.forEach((seat) => {
        const seatDocRef = bookingRef.collection("booked_Seats").doc(seat.id);
        t.set(seatDocRef, {
          price: seat.price,
          type: seat.type,
          status: "locked", // 현재 상태는 'locked'
          userId: bookingData.userId,
        });
      });
    }
  });

  return bookingId;
};

const getMyBookings = async (userId) => {
  const snapshot = await db
    .collection("bookings")
    .where("userId", "==", userId)
    .get();
  return snapshot.docs.map((doc) => doc.data());
};

const getBookingById = async (bookingId) => {
  const doc = await db.collection("bookings").doc(bookingId).get();
  return doc.exists ? doc.data() : null;
};

const updateBookingStatus = async (bookingId, status) => {
  const bookingRef = db.collection("bookings").doc(bookingId);
  await bookingRef.update({
    status,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log(
    `[Booking Status Updated] Booking ID: ${bookingId}, Status: ${status}`
  );
};

module.exports = {
  createBookingWithSeatLock,
  getMyBookings,
  getBookingById,
  updateBookingStatus,
};
