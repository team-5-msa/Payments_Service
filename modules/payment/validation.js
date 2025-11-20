const performanceService = require("../booking/performance.service");

/**
 * 공연 ID를 통해 유효성을 검증하고 데이터를 반환
 */
const validatePerformance = async (performanceId) => {
  const performanceData = await performanceService.getPerformanceById(
    performanceId
  );

  if (!performanceData) {
    throw new Error(`Performance with ID '${performanceId}' not found.`);
  }

  return performanceData;
};

module.exports = { validatePerformance };
