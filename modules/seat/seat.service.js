const seatRepository = require("./seat.repository");

const releaseSeats = async (performanceId, seatIds) => {
  return seatRepository.releaseSeats(performanceId, seatIds);
};

module.exports = {
  releaseSeats,
};
