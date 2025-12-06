const eventBus = require("@utils/eventBus");
const bookingApi = require("@modules/booking/booking.api");
const logger = require("@utils/logger");

const initPaymentSubscribers = () => {
  eventBus.subscribe("PAYMENT_COMPLETED", async (data) => {
    const { bookingId, token } = data;
    await bookingApi.notifyBookingStatus(bookingId, "SUCCESS", token);
    logger.info(
      `[PaymentSubscriber] Notified booking service of SUCCESS for ${bookingId}`
    );
  });

  eventBus.subscribe("PAYMENT_FAILED", async (data) => {
    const { bookingId, token } = data;
    await bookingApi.notifyBookingStatus(bookingId, "FAILURE", token);
    logger.info(
      `[PaymentSubscriber] Notified booking service of FAILURE for ${bookingId}`
    );
  });

  eventBus.subscribe("REFUND_COMPLETED", async (data) => {
    const { bookingId, token } = data;
    // 환불 완료 시 Booking 서비스에 'REFUNDED' 상태 알림
    await bookingApi.notifyBookingStatus(bookingId, "REFUNDED", token);
    logger.info(
      `[PaymentSubscriber] Notified booking service of REFUND for ${bookingId}`
    );
  });

  logger.info(
    "[PaymentSubscriber]",
    "Payment subscribers initialized for PAYMENT_COMPLETED, PAYMENT_FAILED, and REFUND_COMPLETED"
  );
};

module.exports = initPaymentSubscribers;
