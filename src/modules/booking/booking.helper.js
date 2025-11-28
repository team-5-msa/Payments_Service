const { db } = require("../../config/firebase");
const { Timestamp } = require("firebase-admin").firestore;

/**
 * 예약 ID를 받아 10분 후 상태를 확인하고,
 * 여전히 'PENDING' 상태라면 'FAILED'로 변경합니다.
 *
 * @param {string} bookingId - 예약 문서 ID (문자열)
 */
const scheduleBookingExpiration = (bookingId) => {
  // 예약 만료 검사 예약 (10분)
  setTimeout(async () => {
    try {
      // 1. 예약 문서 조회 (만료 시점에 최신 상태 확인)
      const bookingRef = db.collection("bookings").doc(bookingId);
      const bookingSnapshot = await bookingRef.get();

      if (!bookingSnapshot.exists) {
        console.log(`[Expiration Skip] Booking ${bookingId} not found.`);
        return;
      }

      const currentBookingData = bookingSnapshot.data();

      // 2. 상태 확인: 이미 결제(PAID)되었거나 취소(CANCELLED)된 경우 무시
      // 대소문자 구분 없이 확인
      if (currentBookingData.status.toUpperCase() !== "PENDING") {
        return;
      }

      console.log(
        `[Expiration Trigger] Booking ${bookingId} is still PENDING. Expiring...`
      );

      // 3. Batch 시작 (예약 실패 처리 및 결제 의향 실패 처리)
      const batch = db.batch();

      // 3-1. Booking 상태 업데이트
      batch.update(bookingRef, {
        status: "FAILED",
        updatedAt: Timestamp.now(),
      });

      // 3-2. Payment Intent 상태 업데이트
      const paymentIntentQuery = db
        .collection("paymentIntents")
        .where("bookingId", "==", bookingId);

      const paymentIntentSnapshots = await paymentIntentQuery.get();

      if (!paymentIntentSnapshots.empty) {
        paymentIntentSnapshots.forEach((paymentDoc) => {
          const paymentData = paymentDoc.data();
          if (paymentData.status.toUpperCase() === "PENDING") {
            batch.update(paymentDoc.ref, {
              status: "FAILED",
              updatedAt: Timestamp.now(),
            });
          }
        });
      }

      // 4. Batch 커밋
      await batch.commit();
      console.log(
        `[Batch Commit Success] Expired Booking ${bookingId} and related PaymentIntents.`
      );
    } catch (error) {
      console.error(
        `[Error] Failed to process expiration for Booking ID '${bookingId}':`,
        error
      );
    }
  }, 10 * 60 * 1000); // 10분 후 실행
};

module.exports = scheduleBookingExpiration;
