// const { db } = require("../../config/firebase");

// const getOccupiedSeats = async (performanceId, seatIds) => {
//   try {
//     const occupiedSeatsRef = db
//       .collection("occupiedSeats")
//       .where("performanceId", "==", performanceId);

//     let querySnapshot;
//     if (seatIds) {
//       const seatIdArray = seatIds.split(",");
//       querySnapshot = await occupiedSeatsRef
//         .where("seatId", "in", seatIdArray)
//         .get();
//     } else {
//       querySnapshot = await occupiedSeatsRef.get();
//     }

//     const occupiedSeats = [];
//     querySnapshot.forEach((doc) => {
//       occupiedSeats.push({ id: doc.id, ...doc.data() }); // Firestore에서 문서를 변환하여 배열에 추가
//     });
//     return occupiedSeats;
//   } catch (error) {
//     console.error(
//       `[오류] Firestore에서 occupiedSeats 조회 실패: ${error.message}`
//     );
//     throw new Error(error.message);
//   }
// };

// module.exports = {
//   getOccupiedSeats,
// };
