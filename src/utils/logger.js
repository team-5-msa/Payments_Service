const moment = require("moment-timezone");

/**
 * 모든 로그 메시지에 공통 정보를 추가하여 출력합니다.
 * @param {string} level - 로그 레벨 (INFO, WARN, ERROR)
 * @param {string} context - 로그가 발생한 위치 또는 모듈 ([BookingService], [PaymentController] 등)
 * @param {string} message - 주요 로그 메시지
 * @param {object} [details={}] - 추가 디버깅 정보 (옵션)
 */
const log = (level, context, message, details = {}) => {
  const timestamp = moment().tz("Asia/Seoul").format("YYYY-MM-DD HH:mm:ss.SSS");
  const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${context} - ${message}`;

  if (Object.keys(details).length > 0) {
    // 디버깅 정보를 JSON.stringify로 추가 (나중에 구조화된 로그 분석에 용이)
    console.log(logMessage, JSON.stringify(details));
  } else {
    console.log(logMessage);
  }
};

const logger = {
  info: (context, message, details) => log("INFO", context, message, details),
  warn: (context, message, details) => log("WARN", context, message, details),
  error: (context, message, details) => log("ERROR", context, message, details),
  // 에러 객체를 받아 처리하는 전용 함수
  exception: (context, error) => {
    log(
      "ERROR",
      context,
      `[${error.name}:${error.status || 500}] ${error.message}`,
      {
        stack: error.stack ? error.stack.split("\n") : "No stack trace",
        name: error.name,
        status: error.status,
      }
    );
  },
};

module.exports = logger;
