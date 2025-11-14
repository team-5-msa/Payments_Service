const { db, admin } = require("../../config/firebase");

const SEAT_LOCK_DURATION_MINUTES = 5;

const lockSeatsWithTransaction = async (
  t,
  performanceId,
  seatIds,
  userId,
  bookingId
) => {
  const lockUntil = admin.firestore.Timestamp.fromMillis(
    Date.now() + SEAT_LOCK_DURATION_MINUTES * 60 * 1000
  );

  for (const seatId of seatIds) {
    const docId = `${performanceId}_${seatId}`;
    const occupiedSeatRef = db.collection("occupiedSeats").doc(docId);

    const seatDoc = await t.get(occupiedSeatRef);

    if (!seatDoc.exists) {
      console.log(
        `[DEBUG-CREATE-PREP] Preparing to create document: /occupiedSeats/${docId}`
      );
      console.log(
        `[DEBUG-CREATE-FIELDS] bookingId: ${bookingId}, userId: ${userId}, lockedUntil:`,
        lockUntil,
        ", status: locked"
      );

      try {
        t.set(occupiedSeatRef, {
          bookingId,
          userId,
          lockedUntil: null, // 타임스탬프 데이터
          status: "locked", // 잠금 상태
        });
        console.log(
          `[DEBUG-CREATE-SUCCESS] Document /occupiedSeats/${docId} successfully created.`
        );
      } catch (error) {
        console.error(
          `[DEBUG-CREATE-ERROR] Failed to create document /occupiedSeats/${docId}. Error:`,
          error
        );
        throw new Error(`Failed to create seat document: ${error.message}`);
      }
    }
  }
};

const releaseSeats = async (performanceId, seatIds) => {
  const batch = db.batch();
  seatIds.forEach((seatId) => {
    const docId = `${performanceId}_${seatId}`;
    const occupiedSeatRef = db.collection("occupiedSeats").doc(docId);
    batch.delete(occupiedSeatRef);
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
