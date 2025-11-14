const express = require("express");
const router = express.Router();
const paymentController = require("../modules/payment/payment.controller");

// /intent 라우트 제거. 결제 의향은 예매 생성 시 함께 생성됨.

// 결제 실행 라우트만 남김
router.post("/execute", paymentController.executePayment);

module.exports = router;
