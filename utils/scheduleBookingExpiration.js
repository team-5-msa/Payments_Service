const { db } = require("../config/firebase");
const { Timestamp } = require("firebase-admin").firestore;

/**
 * 예약 생성 시 'PENDING' 상태가 10분 넘으면 자동으로 'FAILED'로 변경합니다.
 * 예약 생성 시 함수가 바로 호출되어 해당 항목을 10분 후 검사합니다.
 */
const scheduleBookingExpiration = async (bookingDoc) => {
  const bookingId = bookingDoc.id;
  const bookingData = bookingDoc.data();

  // 예약 상태 확인: 'PENDING'이 아닌 예약 무시
  if (bookingData.status !== "PENDING") {
    return;
  }

  // 예약 만료 검사 예약
  setTimeout(async () => {
    try {
      // Read Booking Doc
      const bookingSnapshot = await db
        .collection("bookings")
        .doc(bookingId)
        .get();
      if (!bookingSnapshot.exists) {
        return;
      }

      const currentBookingData = bookingSnapshot.data();

      // Booking 상태 확인
      if (currentBookingData.status.toLowerCase() !== "pending") {
        return;
      }

      // Batch 시작
      const batch = db.batch();

      // Booking 상태 업데이트
      const bookingRef = db.collection("bookings").doc(bookingId);
      batch.update(bookingRef, {
        status: "FAILED",
        updatedAt: Timestamp.now(),
      });

      // Payment Intent 상태 업데이트
      const paymentIntentQuery = db
        .collection("paymentIntents")
        .where("bookingId", "==", bookingId);

      const paymentIntentSnapshots = await paymentIntentQuery.get();

      if (!paymentIntentSnapshots.empty) {
        paymentIntentSnapshots.forEach((paymentDoc) => {
          const paymentData = paymentDoc.data();

          if (paymentData.status.toLowerCase() === "pending") {
            const paymentRef = paymentDoc.ref;
            batch.update(paymentRef, {
              status: "FAILED",
              updatedAt: Timestamp.now(),
            });
          }
        });
      }

      // Batch 커밋 실행
      await batch.commit();
      console.log(
        `[Batch Commit Success] Booking and related PaymentIntents updated for Booking ID '${bookingId}'.`
      );
    } catch (error) {
      console.error(
        `[Error] Failed to process expiration for Booking ID '${bookingId}':`,
        error
      );
    }
  }, 10 * 60 * 1000); // 예약 후 10분
};

module.exports = scheduleBookingExpiration;
