// const occupiedSeatsService = require("./occupiedSeats.service");

// const getOccupiedSeats = async (req, res) => {
//   try {
//     const { performanceId } = req.params;
//     const { seatIds } = req.query; // 특정 좌석 ID 필터링 옵션 (선택 사항)

//     if (!performanceId) {
//       return res.status(400).send({ error: "공연 ID가 필요합니다." });
//     }

//     const occupiedSeats = await occupiedSeatsService.getOccupiedSeats(
//       performanceId,
//       seatIds
//     );
//     res.status(200).send(occupiedSeats);
//   } catch (error) {
//     console.error(`[오류] 좌석 조회 실패: ${error.message}`);
//     res.status(500).send({ error: error.message });
//   }
// };

// module.exports = {
//   getOccupiedSeats,
// };
