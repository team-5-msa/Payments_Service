/**
 * 실패 사유를 다양화하는 Mock 결제 로직
 */
const getMockPaymentResult = (lastDigit) => {
  let isSuccessMock = false;
  let failureCode = null;
  let failureMessage = null;

  switch (lastDigit) {
    case "0":
    case "1":
    case "9":
      isSuccessMock = true;
      break;
    case "2":
      failureCode = "INSUFFICIENT_FUNDS";
      failureMessage = "카드 잔액이 부족합니다.";
      break;
    case "3":
      failureCode = "INVALID_CVV";
      failureMessage = "CVV 정보가 올바르지 않습니다.";
      break;
    case "4":
      failureCode = "CARD_EXPIRED";
      failureMessage = "만료된 카드입니다.";
      break;
    case "5":
      failureCode = "SERVER_ERROR";
      failureMessage = "서버에 장애가 발생했습니다. 잠시 후 다시 시도해주세요.";
      break;
    case "6":
      failureCode = "PG_TIMEOUT";
      failureMessage =
        "결제 대행사 응답이 지연되었습니다. 잠시 후 다시 시도해주세요.";
      break;
    default:
      failureCode = "GENERIC_DECLINE";
      failureMessage = "알 수 없는 이유로 결제가 거부되었습니다.";
      break;
  }

  return { isSuccessMock, failureCode, failureMessage };
};

module.exports = { getMockPaymentResult };
