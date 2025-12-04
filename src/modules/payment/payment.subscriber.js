const logger = require("../../utils/logger");

const initPaymentSubscribers = () => {
  logger.info(
    "[PaymentSubscriber]",
    "Payment subscribers initialized (No active subscriptions - using HTTP API)"
  );
  // HTTP 통신으로 전환됨에 따라 이벤트 구독 로직은 제거되었습니다.
  // 필요한 경우 내부 이벤트 처리를 위해 여기에 코드를 추가할 수 있습니다.
};

module.exports = initPaymentSubscribers;
