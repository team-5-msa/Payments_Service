const express = require("express");
const logger = require("morgan");
const cron = require("node-cron");
const { db } = require("./config/firebase");
const updateBookingStatusFromEvents = require("./jobs/updateBookingStatus");

// 라우터 파일 import
const bookingRouter = require("./routes/booking.routes");
const paymentRouter = require("./routes/payment.routes");

const app = express();

// 미들웨어 설정
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// [핵심] 각 경로에 맞는 라우터를 정확히 연결
app.use("/bookings", bookingRouter);
app.use("/payments", paymentRouter);

// ✨ 배치 작업 초기화 (node-cron)
cron.schedule("0 0 * * *", () => updateBookingStatusFromEvents()); // 자정마다 실행

// 404 에러 핸들러
app.use((req, res, next) => {
  const err = new Error("Not Found");
  err.status = 404;
  next(err);
});

// 최종 에러 핸들러
app.use((err, req, res, next) => {
  console.error("[FATAL ERROR]", err);
  res.status(err.status || 500).json({ error: err.message });
});

module.exports = app;
