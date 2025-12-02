const initBookingSubscribers = require("../modules/booking/booking.subscriber");
const initPaymentSubscribers = require("../modules/payment/payment.subscriber");
const logger = require("../utils/logger");

const initSubscribers = () => {
  initBookingSubscribers();
  initPaymentSubscribers();
  logger.info("[EventBus]", "All subscribers initialized.");
};

module.exports = initSubscribers;
