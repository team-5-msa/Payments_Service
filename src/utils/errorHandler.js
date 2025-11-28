/**
 * 모든 사용자 정의 에러의 기본 클래스입니다.
 * HTTP 상태 코드(status)와 메시지를 가집니다.
 */
class AppError extends Error {
  constructor(message, status) {
    super(message);
    this.name = this.constructor.name; // 'AppError', 'NotFoundError' 등으로 설정
    this.status = status || 500; // 기본 상태 코드는 500
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 400 Bad Request 에러 (필수 입력값 누락, 유효하지 않은 데이터 등)
 */
class BadRequestError extends AppError {
  constructor(message = "Invalid request parameters or data.") {
    super(message, 400);
  }
}

/**
 * 401 Unauthorized 에러 (인증 정보 누락, 사용자 ID 불일치 등)
 */
class UnauthorizedError extends AppError {
  constructor(message = "Authentication or authorization failed.") {
    super(message, 401);
  }
}

/**
 * 404 Not Found 에러 (문서, 리소스 등을 찾지 못함)
 */
class NotFoundError extends AppError {
  constructor(message = "The requested resource was not found.") {
    super(message, 404);
  }
}

/**
 * 409 Conflict 에러 (예약 한도 초과, 이미 처리된 상태 등)
 */
class ConflictError extends AppError {
  constructor(
    message = "Resource conflict or state is invalid for this operation."
  ) {
    super(message, 409);
  }
}

module.exports = {
  AppError,
  BadRequestError,
  UnauthorizedError,
  NotFoundError,
  ConflictError,
};
