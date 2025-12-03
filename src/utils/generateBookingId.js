// utils/idGenerator.js

const generateBookingId = (performanceId, userId) => {
  const now = new Date();

  // 날짜와 시간 포맷 (YYYYMMDDHHMMSSsss)
  const timestamp = now.toISOString().replace(/[-:T.Z]/g, "");

  // Booking ID 생성
  return `${performanceId}-${userId}-${timestamp}`;
};

module.exports = { generateBookingId };
