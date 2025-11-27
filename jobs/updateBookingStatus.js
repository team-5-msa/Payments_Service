const cron = require("node-cron");
const { db } = require("../config/firebase");
const { Timestamp } = require("firebase-admin").firestore;

/**
 * [배치 잡] 이벤트 기반 Booking 상태 동기화
 *
 * 개선사항:
 * 1. [성능] Time Window 적용: 전체 역사가 아닌 '지난 24시간' 데이터만 스캔
 * 2. [성능] Field Projection: 필요한 필드만 select하여 메모리/대역폭 절약
 * 3. [안정성] Transaction 적용: 읽기/쓰기 사이의 경쟁 상태(Race Condition) 방지
 * 4. [정확성] 환불(REFUNDED) 상태 덮어쓰기 방지 로직 포함
 */
const updateBookingStatusFromEvents = async () => {
  console.log("[Job Started] Checking events for booking status updates...");

  try {
    const now = new Date();
    // 1. Time Window 설정 (쿼리 최적화)
    // 끝: 현재 트랜잭션 충돌 방지를 위해 10분 전 데이터까지만
    const endTime = new Date(now.getTime() - 10 * 60 * 1000);
    // 시작: DB 전체 스캔 방지를 위해 지난 24시간 동안의 데이터만 조회 (매일 돌기 때문)
    const startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // 2. Firestore 쿼리 실행
    const eventSnapshot = await db
      .collection("events")
      .where("createdAt", ">=", Timestamp.fromDate(startTime))
      .where("createdAt", "<", Timestamp.fromDate(endTime))
      .orderBy("createdAt", "desc")
      // [성능 최적화] 필요한 필드만 가져오기 (Projection)
      .select("bookingId", "eventType", "finalStatus", "isSuccess", "createdAt")
      .get();

    if (eventSnapshot.empty) {
      console.log("[Job Completed] No events found in the last 24h.");
      return;
    }

    // 3. 인메모리 필터링: BookingId별 '최신 이벤트' 추출
    const latestEvents = {};
    eventSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      const bookingId = data.bookingId;

      // 이미 더 최신의 이벤트가 저장되어 있다면 스킵
      if (
        latestEvents[bookingId] &&
        latestEvents[bookingId].createdAt >= data.createdAt
      ) {
        return;
      }

      // 최신 이벤트 저장
      latestEvents[bookingId] = {
        bookingId,
        eventType: data.eventType,
        // finalStatus가 루트에 없으면 details 안에 있을 수 있음 (데이터 구조에 따라 조정)
        finalStatus: data.finalStatus,
        createdAt: data.createdAt,
      };
    });

    const targetBookings = Object.values(latestEvents);
    console.log(
      `[Job Info] Processing ${targetBookings.length} unique bookings...`
    );

    // 4. 트랜잭션을 사용한 상태 업데이트 (경쟁 상태 해결)
    // Promise.all로 병렬 처리하되, 각각은 독립된 트랜잭션으로 실행
    const transactionResults = targetBookings.map(async (eventData) => {
      const { bookingId, eventType, finalStatus } = eventData;

      // 4-1. 상태 매핑 로직 (환불 버그 해결 포함)
      let desiredStatus = null;
      if (eventType === "PAYMENT_SUCCESS" && finalStatus === "SUCCESS") {
        desiredStatus = "PAID";
      } else if (eventType === "REFUND_SUCCESS" && finalStatus === "SUCCESS") {
        desiredStatus = "REFUNDED"; // ⬅️ 환불 상태 우선
      } else if (eventType === "PAYMENT_FAILED" || finalStatus === "FAILED") {
        desiredStatus = "FAILED";
      }

      // 상태를 판단할 수 없는 이벤트면 종료
      if (!desiredStatus) return;

      const bookingRef = db.collection("bookings").doc(bookingId);

      try {
        // ✨ Firestore Transaction 시작
        await db.runTransaction(async (transaction) => {
          const bookingDoc = await transaction.get(bookingRef);

          if (!bookingDoc.exists) {
            // 경고만 남기고 트랜잭션 종료
            console.warn(`[Warn] Booking ID '${bookingId}' not found.`);
            return;
          }

          const currentStatus = bookingDoc.data().status;

          // 이미 상태가 같다면 업데이트 건너뜀 (Write 비용 절약)
          if (currentStatus === desiredStatus) {
            return;
          }

          // [중요] 상태 변경 업데이트
          transaction.update(bookingRef, {
            status: desiredStatus,
            updatedAt: Timestamp.now(),
            lastEventSyncedAt: eventData.createdAt, // 추적을 위한 메타데이터 추가
          });

          console.log(
            `[Updated] Booking ${bookingId}: ${currentStatus} -> ${desiredStatus}`
          );
        });
      } catch (txError) {
        console.error(
          `[Tx Error] Failed to update booking ${bookingId}: ${txError.message}`
        );
      }
    });

    await Promise.all(transactionResults);
    console.log("[Job Completed] Batch processing finished.");
  } catch (err) {
    console.error("[Job Error] Critical failure:", err.message);
  }
};

// 매일 자정 실행
cron.schedule("0 0 * * *", () => updateBookingStatusFromEvents());

module.exports = updateBookingStatusFromEvents;
