// utils/idGenerator.js

const generateBookingId = (performanceId, userId) => {
  const now = new Date();

  // 날짜 포맷 (YYYYMMDD)
  const date = now.toISOString().split("T")[0].replace(/-/g, "");

  // 간단한 Booking ID 생성
  return `${performanceId}-${userId}-${date}`;
};

module.exports = { generateBookingId };
