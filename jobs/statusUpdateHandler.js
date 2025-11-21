const cron = require("node-cron");
const { db } = require("../config/firebase");
const { Timestamp } = require("firebase-admin").firestore;

/**
 * 주기적으로 이벤트 데이터를 확인하고, Bookings 상태를 업데이트.
 * 매일 자정에 events 컬렉션을 조회하여 10분 전에 생성된 데이터를 기반으로
 * 동일한 booking에 대한 최신 이벤트를 기준으로 bookings 컬렉션의 상태를 업데이트.
 */
const updateBookingStatusFromEvents = async () => {
  console.log("[Job Started] Checking events for booking status updates...");

  try {
    const now = new Date();
    const cutoffTime = new Date(now.getTime() - 10 * 60 * 1000); // 기준 시간: 10분 전
    const eventSnapshot = await db
      .collection("events")
      .where("createdAt", "<", Timestamp.fromDate(cutoffTime)) // 10분 초과된 데이터만 조회
      .orderBy("createdAt", "desc") // 최신 데이터 우선 정렬
      .get();

    if (eventSnapshot.empty) {
      console.log("[Job Completed] No events found for status update.");
      return;
    }

    // 최신 이벤트만 필터링하기 위해 bookingId별로 데이터를 그룹화
    const latestEvents = {};
    eventSnapshot.docs.forEach((eventDoc) => {
      const eventData = eventDoc.data();
      const bookingId = eventData.bookingId;

      // 가장 최신 이벤트만 저장 (createdAt 기준 비교)
      if (
        !latestEvents[bookingId] ||
        eventData.createdAt > latestEvents[bookingId].createdAt
      ) {
        latestEvents[bookingId] = {
          bookingId,
          isSuccess: eventData.isSuccess,
          createdAt: eventData.createdAt,
        };
      }
    });

    // 상태 업데이트 수행
    const updates = Object.values(latestEvents).map(async (eventData) => {
      const { bookingId, isSuccess } = eventData;

      const bookingRef = db.collection("bookings").doc(bookingId); // bookings 문서 참조
      const bookingDoc = await bookingRef.get();

      if (!bookingDoc.exists) {
        console.error(`[Error] Booking ID '${bookingId}' does not exist.`);
        return;
      }

      const bookingData = bookingDoc.data();
      const currentStatus = bookingData.status;
      const newStatus = isSuccess ? "PAID" : "FAILED";

      // 이미 필요한 상태면 업데이트 건너뜀
      if (currentStatus === newStatus) {
        console.log(
          `[Skip] Booking ID '${bookingId}' already in status '${currentStatus}'.`
        );
        return;
      }

      // 상태 업데이트 수행
      await bookingRef.update({
        status: newStatus,
        updatedAt: Timestamp.now(),
      });

      console.log(
        `[Updated] Booking ID '${bookingId}' status changed to '${newStatus}'.`
      );
    });

    await Promise.all(updates);
    console.log("[Job Completed] All booking statuses updated.");
  } catch (err) {
    console.error(
      "[Job Error] Failed to update booking statuses:",
      err.message
    );
  }
};

// ✨ node-cron으로 자정마다 스케줄링
cron.schedule("0 0 * * *", () => updateBookingStatusFromEvents());
module.exports = updateBookingStatusFromEvents;
