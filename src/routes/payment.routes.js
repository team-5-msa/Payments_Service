const express = require("express");
const router = express.Router();
const paymentController = require("../modules/payment/payment.controller");

// 결제 의향 생성 라우트 (Booking Service에서 호출)
router.post("/intent", paymentController.createPaymentIntent);

// 결제 실행 라우트
router.post("/execute", paymentController.executePayment); // POST 요청 처리

// 결제 취소 (환불) 라우트
router.post("/refund", paymentController.refundPayment);

// 결제 의향 취소 라우트
router.post("/cancel", paymentController.cancelPaymentIntent);

module.exports = router;
