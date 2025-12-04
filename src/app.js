const express = require("express");
const logger = require("morgan");
const swaggerUi = require("swagger-ui-express");
const YAML = require("yamljs");
const path = require("path");

// 라우터 파일 import
const paymentRouter = require("./routes/payment.routes");
const authMiddleware = require("./middlewares/authMiddleware");

const app = express();

// Swagger 설정
const swaggerDocument = YAML.load(path.join(__dirname, "./docs/swagger.yaml"));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// 미들웨어 설정
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// 라우터 설정
app.use("/payment", authMiddleware, paymentRouter);

// 이벤트 버스 및 구독자 초기화
const initPaymentSubscribers = require("./modules/payment/payment.subscriber");

// 구독자 초기화
initPaymentSubscribers(); // 내부 이벤트 버스 구독

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
