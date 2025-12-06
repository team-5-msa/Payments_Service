const express = require("express");
const router = express.Router();
const authMiddleware = require("@middlewares/authMiddleware");
const {
  createPaymentIntent,
  getEventStatus,
  executePayment,
  refundPayment,
  cancelPaymentIntent,
} = require("@modules/payment/payment.controller");

// 모든 결제 관련 라우트에 인증 미들웨어 적용
router.use(authMiddleware);

// 결제 실행 라우트
router.post("/execute", executePayment);

// 결제 의향 생성 라우트 (Booking Service에서 호출) - payment intent 생성
router.post("/intent", createPaymentIntent);

// 결제 이벤트 상태 조회 라우트 (booking service에서 호출) - event 컬렉션 status 조회
router.get("/events/:bookingId", getEventStatus);

// 결제 취소 (환불) 라우트 (booking service에서 호출) - 환불 처리 및 결제 의향 상태를 'REFUNDED'로 변경
router.post("/refund", refundPayment);

// 결제 의향 취소 라우트 (booking service에서 호출) - 결제 의향 상태를 'CANCELLED'로 변경
router.post("/cancel", cancelPaymentIntent);

module.exports = router;
