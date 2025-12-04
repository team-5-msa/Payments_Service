const paymentService = require("./payment.service");
const bookingApi = require("../booking/booking.api"); // 1단계에서 만든 파일

/**
 * 결제 의향 생성 API
 */
const createPaymentIntent = async (req, res) => {
  try {
    const { bookingId, amount, paymentMethod, performanceId, userId } =
      req.body;
    const finalUserId = userId || (req.user ? req.user.id : null);

    if (!finalUserId) {
      return res.status(401).send({ error: "사용자 식별 정보가 없습니다." });
    }

    const result = await paymentService.createPaymentIntent(
      bookingId,
      finalUserId,
      amount,
      paymentMethod,
      performanceId
    );

    res.status(201).send(result);
  } catch (error) {
    res.status(error.status || 500).send({ error: error.message });
  }
};

/**
 * 동기식 결제 실행 API
 */
const executePayment = async (req, res) => {
  try {
    const { id: userId, token } = req.user || {};
    const { bookingId, paymentMethodToken, cardNumber, cvv } = req.body;

    // Debugging logs for token and userId
    // console.log("[executePayment] User ID:", userId);
    // console.log("[executePayment] Token:", token);

    if (!userId) {
      return res.status(401).send({ error: "User identification is missing." });
    }

    // 1. 결제 로직 실행
    const result = await paymentService.executePayment(
      userId,
      bookingId,
      paymentMethodToken,
      cardNumber,
      cvv,
      token
    );

    // 2. 결제 성공 시 Booking 서비스에 상태 알림
    if (result.finalStatus === "SUCCESS") {
      await bookingApi.notifyBookingStatus(bookingId, "SUCCESS", token); // ✨ 토큰 추가
    } else if (result.finalStatus === "FAILURE") {
      await bookingApi.notifyBookingStatus(bookingId, "FAILURE", token); // ✨ 토큰 추가
    }

    res.status(200).send(result);
  } catch (error) {
    console.error("[executePayment] Error:", error);
    res.status(error.status || 500).send({ error: error.message });
  }
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

module.exports = {
  createPaymentIntent,
  executePayment,
  refundPayment,
  cancelPaymentIntent,
};
