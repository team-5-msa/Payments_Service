const { db } = require("../config/firebase");
const { Timestamp } = require("firebase-admin").firestore;

/**
 * 예약 생성 시 'pending' 상태가 10분 넘으면 자동으로 'FAILED'로 변경합니다.
 * 예약 생성 시 함수가 바로 호출되어 해당 항목을 10분 후 검사합니다.
 */
const scheduleBookingExpiration = async (bookingDoc) => {
  const bookingId = bookingDoc.id;
  const bookingData = bookingDoc.data();

  // 예약이 이미 실패 상태로 변경되었거나 처리된 경우 무시
  if (bookingData.status !== "pending") {
    console.log(`[Skip] Booking ID '${bookingId}' is not pending.`);
    return;
  }

  const expirationTime = 10 * 60 * 1000; // 예약 후 10분
  console.log(
    `[Schedule] Booking ID '${bookingId}' will expire in 10 minutes.`
  );

  // 10분 후 상태 변경 검사
  setTimeout(async () => {
    const updatedBookingDoc = await db
      .collection("bookings")
      .doc(bookingId)
      .get();

    if (!updatedBookingDoc.exists) {
      console.error(`[Error] Booking ID '${bookingId}' does not exist.`);
      return;
    }

    const updatedBookingData = updatedBookingDoc.data();
    if (updatedBookingData.status !== "pending") {
      console.log(
        `[Skip] Booking ID '${bookingId}' already updated to '${updatedBookingData.status}'.`
      );
      return;
    }

    // 상태를 FAILED로 업데이트
    await updatedBookingDoc.ref.update({
      status: "FAILED",
      updatedAt: Timestamp.now(),
    });
    console.log(
      `[Updated] Booking ID '${bookingId}' status changed to 'FAILED'.`
    );
  }, expirationTime);
};

module.exports = scheduleBookingExpiration;
