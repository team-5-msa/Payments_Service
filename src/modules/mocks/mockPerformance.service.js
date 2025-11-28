// 에러 상태 코드를 관리하기 위한 커스텀 에러 클래스
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.name = "HttpError";
  }
}

// 공연 데이터를 저장하는 메모리 내 데이터베이스
const PERFORMANCE_DATA = new Map();

/**
 * [추가] Mock 데이터를 저장소를 완전히 비웁니다.
 * 이 함수는 모든 테스트가 시작되기 전에 단 한 번만 호출되어야 합니다.
 */
const resetData = () => {
  PERFORMANCE_DATA.clear();
  console.log("[Mock Perf Service] All mock data has been reset.");
};

/**
 * 특정 공연 ID로 Mock 데이터를 생성하고 Map에 저장합니다.
 * ✨ [핵심 수정] 데이터가 이미 존재하면 아무것도 하지 않습니다. (Idempotent)
 */
const seedPerformance = (performanceId) => {
  // ✨ 요청하신 대로, 데이터가 이미 Map에 존재하면 기존 데이터를 건드리지 않고 즉시 종료합니다.
  if (PERFORMANCE_DATA.has(performanceId)) {
    console.log(
      `[Mock Perf Service] Already exists: ${performanceId}. Skipping seed.`
    );
    return;
  }

  // 데이터가 없을 때만 새로 생성하여 저장합니다.
  PERFORMANCE_DATA.set(performanceId, {
    id: performanceId,
    title: `Dynamic Mock Perf ${performanceId}`,
    price: 50000,
    availableTickets: 10, // 초기 재고 설정
  });
  console.log(
    `[Mock Perf Service] Dynamically Created: ${performanceId} with 10 tickets.`
  );
};

// ❌ 파일 로드 시 즉시 실행되던 초기 시드 호출을 제거합니다.
// seedPerformance("PF-A001");
// seedPerformance("PF-B002");

/**
 * 공연 ID로 데이터를 조회합니다. (getPerformanceById, reserveTickets, cancelTickets 등 유지)
 * ...
 */
const getPerformanceById = async (performanceId) => {
  const data = PERFORMANCE_DATA.get(performanceId);
  if (!data) {
    // 데이터가 없으면 에러 발생 (이전과 동일)
    const error = new Error(`Performance '${performanceId}' not found.`);
    error.status = 404;
    throw error;
  }
  return data;
};

/**
 * 공연 티켓을 예매합니다 (재고 감소).
 * @param {string} performanceId - 공연 ID
 * @param {number} quantity - 예매할 티켓 수량
 * @returns {Promise} 업데이트된 공연 정보 객체
 * @throws {HttpError} 404 - 공연 없음
 * @throws {HttpError} 409 - 재고 부족
 * @throws {HttpError} 400 - 잘못된 수량
 */

const reserveTickets = async (performanceId, quantity) => {
  const performance = mockDatabase[performanceId]; // [예외 처리] 1. 공연 ID가 존재하지 않는 경우 (404)

  if (!performance) {
    return Promise.reject(
      new HttpError(404, `Performance '${performanceId}' not found.`)
    );
  } // [예외 처리] 2. 요청 수량이 유효하지 않은 경우 (400 - Bad Request)

  if (quantity <= 0) {
    return Promise.reject(
      new HttpError(400, "Ticket quantity must be greater than 0.")
    );
  } // [예외 처리] 3. 재고가 부족한 경우 (409 - Conflict)

  if (performance.stock < quantity) {
    console.warn(
      `[Mock Performance Service] Stock shortage. Current: ${performance.stock}, Requested: ${quantity}`
    );
    return Promise.reject(
      new HttpError(409, "재고가 부족합니다. 예매할 수 없습니다.")
    );
  } // 정상 처리: 재고 감소

  performance.stock -= quantity;
  console.log(
    `[Mock Performance Service] Reserved tickets for ID: ${performanceId}, tickets reserved: ${quantity}, new stock: ${performance.stock}`
  );

  return Promise.resolve(performance);
};

/**
 * 공연 티켓을 취소 및 환불합니다 (재고 증가).
 * @param {string} performanceId - 공연 ID
 * @param {number} quantity - 환불할 티켓 수량
 * @returns {Promise} 업데이트된 공연 정보 객체
 * @throws {HttpError} 404 - 공연 없음
 * @throws {HttpError} 400 - 잘못된 수량
 */
const cancelTickets = async (performanceId, quantity) => {
  const performance = mockDatabase[performanceId]; // [예외 처리] 1. 공연 ID가 존재하지 않는 경우 (404)

  if (!performance) {
    return Promise.reject(
      new HttpError(404, `Performance '${performanceId}' not found.`)
    );
  } // [예외 처리] 2. 요청 수량이 유효하지 않은 경우 (400)

  if (quantity <= 0) {
    return Promise.reject(
      new HttpError(400, "Cancellation quantity must be greater than 0.")
    );
  } // 재고가 초기 재고(initialStock)를 초과하는지 확인 (400)

  if (performance.stock + quantity > performance.initialStock) {
    const excess = performance.stock + quantity - performance.initialStock;
    return Promise.reject(
      new HttpError(
        400,
        `Cancellation quantity (${quantity}) exceeds the maximum stock limit (${performance.initialStock}). Excess refund request: ${excess}`
      )
    );
  } // 정상 처리: 재고 증가 (취소/환불)

  performance.stock += quantity;
  console.log(
    `[Mock Performance Service] Cancelled tickets for ID: ${performanceId}, tickets refunded: ${quantity}, new stock: ${performance.stock}`
  );

  return Promise.resolve(performance);
};

module.exports = {
  getPerformanceById,
  reserveTickets,
  cancelTickets,
  seedPerformance,
  resetData,
};
