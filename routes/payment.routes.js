const express = require("express");
const router = express.Router();
const paymentController = require("../modules/payment/payment.controller");

// 결제 실행 라우트
router.post("/execute", paymentController.executePayment); // POST 요청 처리

module.exports = router;
