const paymentService = require("./payment.service");

// --- 요청/응답 처리 레이어 ---

const createIntent = async (req, res) => {
  try {
    const { orderId, amount } = req.body;
    const intentId = await paymentService.createPaymentIntent(orderId, amount);
    res.status(201).send({
      message: "Payment intent created. Ready to execute payment.",
      intentId: intentId,
    });
  } catch (error) {
    res.status(error.status || 500).send({ error: error.message });
  }
};

const executePayment = async (req, res) => {
  try {
    const { intentId, paymentMethodToken, cvv } = req.body;
    const { finalStatus, pgMockData } = await paymentService.executePayment(
      intentId,
      paymentMethodToken,
      cvv
    );
    res.status(200).send({
      message: `Payment ${finalStatus}`,
      intentId: intentId,
      status: finalStatus,
      pgMockData,
    });
  } catch (error) {
    res.status(error.status || 500).send({ error: error.message });
  }
};

module.exports = {
  createIntent,
  executePayment,
};
