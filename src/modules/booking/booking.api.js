const bookingAxiosInstance = require("../../utils/bookingAxios");

/**
 * Booking 서비스에 결제 결과 알림 (Webhook)
 * @param {string} bookingId - 결제와 관련된 Booking ID
 * @param {string} status - 성공: 'SUCCESS', 실패: 'FAILURE'
 * @param {string} token - Authorization 토큰
 */
const notifyBookingStatus = async (bookingId, status, token) => {
  try {
    const authHeader = token.startsWith("Bearer ") ? token : `Bearer ${token}`; // Ensure no duplicate 'Bearer'

    await bookingAxiosInstance.post(
      "/booking/webhook/payment",
      { bookingId, status }, // 바디 데이터
      {
        headers: {
          Authorization: authHeader,
        },
      }
    );
    // console.log(
    //   `[Booking API] Successfully notified ${status} for ${bookingId}`
    // );
  } catch (error) {
    console.error(
      `[Booking API] Failed to notify booking status for ${bookingId}:`,
      error.message
    );
    throw error; // 필요한 경우 오류를 다시 던질 수 있음
  }
};

module.exports = {
  notifyBookingStatus,
};
