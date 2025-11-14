const { db, admin } = require("../../config/firebase");

const SEAT_LOCK_DURATION_MINUTES = 5; // 좌석 잠금 시간 (5분)

/**
 * 지정된 좌석들을 트랜잭션 내에서 잠급니다.
 *
 * @param {admin.firestore.Transaction} t - Firestore 트랜잭션 객체
 * @param {string} performanceId - 공연 ID
 * @param {string[]} seatIds - 잠글 좌석 ID 배열
 * @param {string} userId - 잠금을 시도하는 사용자 ID
 */
const lockSeatsWithTransaction = async (t, performanceId, seatIds, userId) => {
  const now = admin.firestore.Timestamp.now();
  const lockUntil = admin.firestore.Timestamp.fromMillis(
    now.toMillis() + SEAT_LOCK_DURATION_MINUTES * 60 * 1000
  );

  // 중앙 좌석 관리 컬렉션 경로 (가정: performances/{performanceId}/seats/{seatId})
  const seatRefs = seatIds.map((id) =>
    db.collection("performances").doc(performanceId).collection("seats").doc(id)
  );

  const seatDocs = await t.getAll(...seatRefs);

  for (const seatDoc of seatDocs) {
    if (!seatDoc.exists) {
      throw new Error(`Seat ${seatDoc.id} not found.`);
    }
    const seatData = seatDoc.data();
    // 좌석이 이미 예약되었거나, 다른 사용자에 의해 잠겨있다면 에러 발생
    if (
      seatData.status === "booked" ||
      (seatData.lockedUntil && seatData.lockedUntil > now)
    ) {
      throw new Error(`Seat ${seatDoc.id} is not available.`);
    }
  }

  // 모든 좌석이 사용 가능하면 잠금 업데이트
  for (const seatRef of seatRefs) {
    t.update(seatRef, {
      status: "locked",
      lockedUntil: lockUntil,
      lockedBy: userId, // 어떤 사용자가 잠갔는지 기록
    });
  }
};

/**
 * 지정된 좌석들의 잠금을 해제합니다.
 *
 * @param {string} performanceId - 공연 ID
 * @param {string[]} seatIds - 잠금을 해제할 좌석 ID 배열
 */
const releaseSeats = async (performanceId, seatIds) => {
  const batch = db.batch();
  seatIds.forEach((seatId) => {
    const seatRef = db
      .collection("performances")
      .doc(performanceId)
      .collection("seats")
      .doc(seatId);
    batch.update(seatRef, {
      status: "available", // 'available' 상태로 명시적 변경
      lockedUntil: null,
      lockedBy: null,
    });
  });
  await batch.commit();
  console.log(
    `[Seats Released] Performance: ${performanceId}, Seats: ${seatIds.join(
      ", "
    )}`
  );
};

module.exports = {
  lockSeatsWithTransaction,
  releaseSeats,
};
