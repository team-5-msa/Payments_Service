const paymentService = require("./payment.service");

// --- 요청/응답 처리 레이어 ---

// (수정) createIntent 함수 제거.
/*
const createIntent = async (req, res) => {
  // 이 로직은 booking.service.js의 createBooking 내부로 통합되었음.
};
*/

const executePayment = async (req, res) => {
  try {
    // (수정) 명세서에 맞게 paymentIntentId를 받도록 변수명 수정
    const { paymentIntentId, paymentMethodToken, cvv } = req.body;
    const { finalStatus, pgMockData } = await paymentService.executePayment(
      paymentIntentId, // intentId -> paymentIntentId
      paymentMethodToken,
      cvv
    );
    res.status(200).send({
      message: `Payment ${finalStatus}`,
      paymentIntentId: paymentIntentId, // intentId -> paymentIntentId
      status: finalStatus,
      pgMockData,
    });
  } catch (error) {
    res.status(error.status || 500).send({ error: error.message });
  }
};

module.exports = {
  executePayment,
};
