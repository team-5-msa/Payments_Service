const eventBus = require("../../utils/eventBus");
const paymentService = require("./payment.service");
const logger = require("../../utils/logger");

const initPaymentSubscribers = () => {
  // 예매 생성 이벤트 구독 -> 결제 의향 생성
  eventBus.subscribe(
    "BOOKING_CREATED",
    async ({
      bookingId,
      userId,
      totalAmount,
      paymentMethod,
      performanceId,
    }) => {
      logger.info(
        "[PaymentSubscriber]",
        `Received BOOKING_CREATED for ${bookingId}`
      );
      try {
        await paymentService.createPaymentIntent(
          bookingId,
          userId,
          totalAmount,
          paymentMethod,
          performanceId
        );
      } catch (error) {
        logger.error(
          "[PaymentSubscriber]",
          `Failed to create payment intent for ${bookingId}: ${error.message}`
        );
      }
    }
  );

  // 예매 취소(결제 전) 이벤트 구독 -> 결제 의향 취소
  eventBus.subscribe("BOOKING_CANCELLED", async ({ bookingId }) => {
    logger.info(
      "[PaymentSubscriber]",
      `Received BOOKING_CANCELLED for ${bookingId}`
    );
    try {
      await paymentService.updateIntentStatusForCancellation(bookingId);
    } catch (error) {
      logger.error(
        "[PaymentSubscriber]",
        `Failed to cancel payment intent for ${bookingId}: ${error.message}`
      );
    }
  });

  // 환불 요청 이벤트 구독 -> 환불 처리
  eventBus.subscribe("REFUND_REQUESTED", async ({ bookingId, userId }) => {
    logger.info(
      "[PaymentSubscriber]",
      `Received REFUND_REQUESTED for ${bookingId}`
    );
    try {
      await paymentService.refundPayment(bookingId, userId);
    } catch (error) {
      logger.error(
        "[PaymentSubscriber]",
        `Failed to process refund for ${bookingId}: ${error.message}`
      );
    }
  });
};

module.exports = initPaymentSubscribers;
