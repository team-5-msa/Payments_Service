// utils/idGenerator.js

const generateBookingId = (performanceId, userId) => {
  const now = new Date();

  // 날짜/시간 포맷 (YYYYMMDDHHmmss)
  const dateTime = now
    .toISOString()
    .replace(/T/, "_") // DateTime 구분 (_)
    .replace(/:/g, "")
    .replace(/\..+/, ""); // 밀리초 버림

  // 규칙적 Booking ID 생성
  return `${performanceId}_${userId}_${dateTime}`;
};

module.exports = { generateBookingId };
