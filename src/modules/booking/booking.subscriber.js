const eventBus = require("../../utils/eventBus");
const bookingService = require("./booking.service");
const logger = require("../../utils/logger");

const initBookingSubscribers = () => {
  // 결제 성공 이벤트 구독
  eventBus.subscribe("PAYMENT_COMPLETED", async ({ bookingId, token }) => {
    logger.info(
      "[BookingSubscriber]",
      `Received PAYMENT_COMPLETED for ${bookingId}`
    );
    try {
      await bookingService.confirmBookingPayment(bookingId, token);
    } catch (error) {
      logger.error(
        "[BookingSubscriber]",
        `Failed to confirm booking ${bookingId}: ${error.message}`
      );
    }
  });

  // 결제 실패 이벤트 구독
  eventBus.subscribe("PAYMENT_FAILED", async ({ bookingId, token }) => {
    logger.info(
      "[BookingSubscriber]",
      `Received PAYMENT_FAILED for ${bookingId}`
    );
    try {
      await bookingService.failBookingPayment(bookingId, token);
    } catch (error) {
      logger.error(
        "[BookingSubscriber]",
        `Failed to fail booking ${bookingId}: ${error.message}`
      );
    }
  });

  // 환불 완료 이벤트 구독
  eventBus.subscribe("REFUND_COMPLETED", async ({ bookingId, token }) => {
    logger.info(
      "[BookingSubscriber]",
      `Received REFUND_COMPLETED for ${bookingId}`
    );
    try {
      await bookingService.completeBookingRefund(bookingId, token);
    } catch (error) {
      logger.error(
        "[BookingSubscriber]",
        `Failed to complete refund for booking ${bookingId}: ${error.message}`
      );
    }
  });
};

module.exports = initBookingSubscribers;
