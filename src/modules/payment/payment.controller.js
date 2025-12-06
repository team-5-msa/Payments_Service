const paymentService = require("@modules/payment/payment.service");

/**
 * 결제 의향 생성 API
 */
const createPaymentIntent = async (req, res) => {
  try {
    const {
      bookingId,
      amount,
      paymentMethod,
      performanceId,
      userId,
      reservationId,
    } = req.body;

    // Debugging log for reservationId
    console.log("[createPaymentIntent] reservationId:", reservationId);

    const finalUserId = userId || (req.user ? req.user.id : null);

    if (!finalUserId) {
      return res.status(401).send({ error: "사용자 식별 정보가 없습니다." });
    }

    const result = await paymentService.createPaymentIntent(
      bookingId,
      finalUserId,
      amount,
      reservationId,
      paymentMethod,
      performanceId
    );

    res.status(201).send(result);
  } catch (error) {
    res.status(error.status || 500).send({ error: error.message });
  }
};

/**
 * 결제 실행 API
 */
const executePayment = async (req, res) => {
  const { id: userId, token } = req.user || {};
  const { bookingId, paymentMethodToken, cardNumber, cvv } = req.body;

  if (!userId) {
    return res.status(401).send({ error: "User identification is missing." });
  }

  const result = await paymentService.executePayment(
    userId,
    bookingId,
    paymentMethodToken,
    cardNumber,
    cvv,
    token
  );

  res.status(200).send(result);
};

/**
 * 결제 취소 (환불) API
 */
const refundPayment = async (req, res) => {
  try {
    const { id: userId, token } = req.user || {};
    const { bookingId } = req.body;

    if (!userId) {
      return res.status(401).send({ error: "User identification is missing." });
    }

    const result = await paymentService.refundPayment(bookingId, userId, token);

    res.status(200).send(result);
  } catch (error) {
    res.status(error.status || 500).send({ error: error.message });
  }
};

/**
 * 결제 의향 취소 API
 */
const cancelPaymentIntent = async (req, res) => {
  try {
    const { bookingId } = req.body;

    if (!bookingId) {
      return res.status(400).send({ error: "bookingId is required." });
    }

    await paymentService.updateIntentStatusForCancellation(bookingId);

    res.status(200).send({ message: "Payment intent cancelled." });
  } catch (error) {
    res.status(error.status || 500).send({ error: error.message });
  }
};

/**
 * 결제 상태 조회 API
 */
const getEventStatus = async (req, res) => {
  try {
    const { bookingId } = req.params;

    if (!bookingId) {
      return res.status(400).send({ error: "bookingId is required." });
    }

    const eventStatus = await paymentService.getEventStatus(bookingId);

    if (!eventStatus) {
      return res.status(404).send({ error: "Payment status not found." });
    }

    res.status(200).send(eventStatus);
  } catch (error) {
    console.error("[getEventStatus] Error:", error);
    res.status(error.status || 500).send({ error: error.message });
  }
};

module.exports = {
  createPaymentIntent,
  executePayment,
  refundPayment,
  cancelPaymentIntent,
  getEventStatus,
};
