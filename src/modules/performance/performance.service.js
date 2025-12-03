const performanceClient = require("../../utils/axios");
const { NotFoundError, BadRequestError } = require("../../utils/errorHandler");
const logger = require("../../utils/logger");

/**
 * 공연 정보 조회
 * GET /performances/:id
 */
const getPerformanceById = async (performanceId, token) => {
  try {
    const config = token ? { headers: { Authorization: token } } : {};
    const response = await performanceClient.get(
      `/performances/${performanceId}`,
      config
    );
    return response;
  } catch (error) {
    if (error.response && error.response.status === 404) {
      throw new NotFoundError(`Performance ${performanceId} not found`);
    }
    logger.error(
      `[PerformanceService] getPerformanceById failed: ${error.message}`
    );
    throw error;
  }
};

/**
 * 티켓 예매 (임시 예약)
 * POST /reservations/:performanceId
 */
const reserveTickets = async (performanceId, quantity, token) => {
  try {
    const config = token ? { headers: { Authorization: token } } : {};
    const response = await performanceClient.post(
      `/reservations/${performanceId}`,
      {
        seatCount: quantity,
      },
      config
    );
    // response: { reservationId, status: "PENDING", ... }
    return response;
  } catch (error) {
    if (error.response) {
      logger.error(
        `[PerformanceService] reserveTickets failed: ${
          error.response.status
        } - ${JSON.stringify(error.response.data)}`
      );
      if (error.response.status === 400) {
        throw new BadRequestError("Not enough seats or invalid request");
      }
    }
    throw error;
  }
};

/**
 * 예약 확정
 * PATCH /reservations/:performanceId/:reservationId/confirm
 */
const confirmReservation = async (performanceId, reservationId, token) => {
  try {
    const config = token ? { headers: { Authorization: token } } : {};
    const response = await performanceClient.patch(
      `/reservations/${performanceId}/${reservationId}/confirm`,
      {}, // data (empty)
      config
    );
    return response;
  } catch (error) {
    logger.error(
      `[PerformanceService] confirmReservation failed: ${error.message}`
    );
    throw error;
  }
};

/**
 * 예약 취소 (결제 전)
 * PATCH /reservations/:performanceId/:reservationId/cancel
 */
const cancelReservation = async (performanceId, reservationId, token) => {
  try {
    const config = token ? { headers: { Authorization: token } } : {};
    const response = await performanceClient.patch(
      `/reservations/${performanceId}/${reservationId}/cancel`,
      {},
      config
    );
    return response;
  } catch (error) {
    logger.error(
      `[PerformanceService] cancelReservation failed: ${error.message}`
    );
    // 이미 취소되었거나 없는 경우 등은 무시하거나 처리
    throw error;
  }
};

/**
 * 예약 환불 (결제 후)
 * PATCH /reservations/:performanceId/:reservationId/refund
 */
const refundReservation = async (performanceId, reservationId, token) => {
  try {
    const config = token ? { headers: { Authorization: token } } : {};
    const response = await performanceClient.patch(
      `/reservations/${performanceId}/${reservationId}/refund`,
      {},
      config
    );
    return response;
  } catch (error) {
    logger.error(
      `[PerformanceService] refundReservation failed: ${error.message}`
    );
    throw error;
  }
};

// Mock 호환성을 위한 메서드 (필요 시 제거)
const seedPerformance = (id) => {
  // 실제 서비스에서는 시딩이 필요 없거나 API로 해야 함
  // 여기서는 로깅만 수행
  logger.info(
    `[PerformanceService] seedPerformance called for ${id} (No-op in real service)`
  );
};

// 기존 인터페이스와의 호환성을 위해 cancelTickets를 래핑 (reservationId가 필요함)
// 주의: 기존 booking.service.js에서는 cancelTickets(performanceId, quantity)로 호출하고 있음.
// 하지만 새로운 API는 reservationId가 필수임.
// 따라서 booking.service.js를 수정하여 reservationId를 전달하도록 해야 함.

module.exports = {
  getPerformanceById,
  reserveTickets,
  confirmReservation,
  cancelReservation,
  refundReservation,
  seedPerformance,
};
