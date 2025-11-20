const paymentService = require("./payment.service");

/**
 * [수정] 동기식 결제 실행 API
 * 클라이언트가 이 API를 호출하면, 서버는 결제를 시뮬레이션하고
 * 그 결과를 이벤트로 발행합니다.
 */
const executePayment = async (req, res) => {
  try {
    const userId = req.headers["x-user-id"]; // 게이트웨이가 주입한 헤더
    const { bookingId, paymentMethodToken, cvv } = req.body;

    if (!userId) {
      return res
        .status(401)
        .send({ error: "User identification is missing in headers." });
    }

    const result = await paymentService.executePayment(
      userId,
      bookingId,
      paymentMethodToken,
      cvv
    );

    res.status(200).send({
      message: `Payment simulation finished with status: ${result.finalStatus}`,
      ...result,
    });
  } catch (error) {
    res.status(error.status || 500).send({ error: error.message });
  }
};

module.exports = {
  // createIntent 제거
  executePayment,
};
