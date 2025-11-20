/**
 * 공연 정보를 조회하는 서비스 (현재는 Mock으로 동작)
 * MSA 환경에서 실제 Performance API를 호출하는 역할을 담당합니다.
 */

/**
 * ID로 공연 정보를 조회합니다.
 * @param {string} performanceId - 조회할 공연의 ID
 * @returns {Promise<object>} 공연 정보 객체
 */
const getPerformanceById = async (performanceId) => {
  // 실제 API가 연결되기 전까지 Mock 데이터를 반환합니다.
  console.log(
    `[Mock Performance Service] Fetching performance data for ID: ${performanceId}`
  );

  // 여기서 performanceId에 따라 다른 Mock 데이터를 반환하거나,
  // 특정 ID가 아니면 에러를 발생시키는 등의 로직을 추가할 수 있습니다.
  const mockData = {
    id: performanceId,
    price: 50000, // 예시 가격
    stock: 100, // 예시 재고
    name: `Mock Performance: ${performanceId}`,
  };

  // API 호출을 시뮬레이션하기 위해 Promise.resolve를 사용합니다.
  return Promise.resolve(mockData);
};

module.exports = {
  getPerformanceById,
};
