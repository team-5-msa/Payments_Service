// 에러 상태 코드를 관리하기 위한 커스텀 에러 클래스
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.name = "HttpError";
  }
}

// 공연 데이터를 저장하는 메모리 내 데이터베이스
const mockDatabase = {};

/**
 * 테스트를 위해 초기 데이터를 생성하는 헬퍼 함수 (Seed Data)
 * 서비스 로직 내부에서 자동 생성하지 않고, 명시적으로 생성할 때 사용
 */
const seedPerformance = (performanceId) => {
  if (!mockDatabase[performanceId]) {
    mockDatabase[performanceId] = {
      id: performanceId,
      price: 50000,
      stock: 100, // 초기 재고
      initialStock: 100, // 최대 재고 검사를 위한 초기 값 저장
      name: `Mock Performance: ${performanceId}`,
      description: `Description of performance ${performanceId}`,
      location: "Seoul",
      date: "2025-12-01",
    };
  }
  console.log(
    `[Mock Seed] Performance ${performanceId} created with stock: ${mockDatabase[performanceId].stock}`
  );
  return mockDatabase[performanceId];
};

// ❌ 파일 로드 시 즉시 실행되던 초기 시드 호출을 제거합니다.
// seedPerformance("PF-A001");
// seedPerformance("PF-B002");

/**
 * ID로 공연 정보를 조회합니다.
 * @param {string} performanceId - 조회할 공연의 ID
 * @returns {Promise} 공연 정보 객체
 * @throws {HttpError} 404 - 공연을 찾을 수 없음
 */
const getPerformanceById = async (performanceId) => {
  console.log(
    `[Mock Performance Service] Fetching data for ID: ${performanceId}`
  );

  const performance = mockDatabase[performanceId]; // [예외 처리] 데이터가 없는 경우 404 반환

  if (!performance) {
    return Promise.reject(
      new HttpError(404, `Performance '${performanceId}' not found.`)
    );
  }

  return Promise.resolve(performance);
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
  seedPerformance, // 테스트 데이터 생성이 필요할 때 사용
};
