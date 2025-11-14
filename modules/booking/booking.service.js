const bookingRepository = require("./booking.repository");
const paymentService = require("../payment/payment.service");

// [Mock] 가상의 Performances_Service와 통신하는 모듈
// 실제 MSA 통신 모듈이 구현되면 이 부분을 교체합니다.
const performanceService = {
  /**
   * [Mock] 수량 기반 좌석 잠금 요청을 시뮬레이션합니다.
   * @returns {Promise<{seatIds: string[], pricePerSeat: number}>} 할당된 좌석 ID 목록과 좌석당 가격
   */
  lockSeatsByQuantity: async (performanceId, quantity) => {
    console.log(
      `[Mock Performance Service] Locking ${quantity} seats for performance ${performanceId}...`
    );

    // --- 성공 시나리오 ---
    // 가상의 좌석 ID를 생성합니다 (예: A1, A2, ...)
    const seatIds = Array.from({ length: quantity }, (_, i) => `A${i + 1}`);
    const pricePerSeat = 30000; // 고정된 모의 가격

    console.log(
      `[Mock Performance Service] Locked seats: ${seatIds.join(
        ", "
      )} with price ${pricePerSeat}`
    );

    // 실제 서비스가 반환할 것으로 예상되는 객체
    return Promise.resolve({
      seatIds,
      pricePerSeat,
    });

    // --- 실패 시나리오 테스트를 원할 경우 아래 코드를 사용 ---
    // return Promise.reject(new Error("Not enough available seats."));
  },

  /**
   * [Mock] 좌석 잠금 해제 요청을 시뮬레이션합니다.
   */
  unlockSeats: async (performanceId, seatIds) => {
    console.log(
      `[Mock Performance Service] Unlocking seats ${seatIds.join(
        ", "
      )} for performance ${performanceId}.`
    );
    return Promise.resolve(); // 성공적으로 완료되었음을 나타냄
  },

  /**
   * [Mock] 좌석 상태를 'booked'로 최종 확정하는 요청을 시뮬레이션합니다.
   */
  confirmSeatsAsBooked: async (performanceId, seatIds) => {
    console.log(
      `[Mock Performance Service] Confirming seats ${seatIds.join(
        ", "
      )} as 'booked' for performance ${performanceId}.`
    );
    return Promise.resolve(); // 성공적으로 완료되었음을 나타냄
  },
};

/**
 * 1. 예매 생성 및 결제 의향 생성 (수량 기반)
 */
const createBooking = async (
  userId,
  performanceId,
  quantity,
  paymentMethod
) => {
  if (!userId || !performanceId || !quantity || quantity <= 0) {
    const error = new Error("User, performance, and quantity are required.");
    error.status = 400;
    throw error;
  }

  // --- MSA 통신 1: Performances_Service에 좌석 할당 및 가격 정보 요청 ---
  let allocatedSeats;
  try {
    // [수정] 이제 이 함수는 위에서 정의한 Mock 객체를 호출합니다.
    allocatedSeats = await performanceService.lockSeatsByQuantity(
      performanceId,
      quantity
    );
  } catch (error) {
    const serviceError = new Error(
      `Performance Service is unavailable: ${error.message}`
    );
    serviceError.status = 503;
    throw serviceError;
  }

  const { seatIds, pricePerSeat } = allocatedSeats;
  const totalAmount = pricePerSeat * quantity;

  // 1. 예매 문서 생성 (DB 저장)
  const bookingId = await bookingRepository.createBooking({
    userId,
    performanceId,
    seatIds, // Performances_Service로부터 할당받은 좌석 ID 목록
    quantity,
  });

  try {
    // 2. 결제 의향 생성 (payment.service 호출)
    await paymentService.createPaymentIntent(
      bookingId,
      userId,
      totalAmount,
      paymentMethod
    );
    // 3. 클라이언트에게 bookingId 반환
    return { bookingId, totalAmount };
  } catch (error) {
    // --- 보상 트랜잭션: 결제 의향 생성 실패 시 Performances_Service에 좌석 잠금 해제 요청 ---
    console.error(
      `[Booking Rollback] For booking ${bookingId}, releasing seats.`
    );
    await performanceService.unlockSeats(performanceId, seatIds); // 롤백 API 호출
    await bookingRepository.updateBookingStatus(bookingId, "failed");
    throw new Error(
      "Failed to create payment intent. Booking has been rolled back."
    );
  }
};

/**
 * 특정 사용자의 모든 예매 내역을 조회합니다.
 */
const getMyBookings = async (userId) => {
  return bookingRepository.getMyBookings(userId);
};

/**
 * 예매 취소 API (결제 전 'pending' 상태일 때만)
 */
const cancelBooking = async (userId, bookingId) => {
  const booking = await bookingRepository.getBookingById(bookingId);
  if (!booking || booking.userId !== userId || booking.status !== "pending") {
    const error = new Error("Booking not found or cannot be cancelled.");
    error.status = 400;
    throw error;
  }
  await performanceService.unlockSeats(booking.performanceId, booking.seatIds);
  await bookingRepository.updateBookingStatus(bookingId, "cancelled");
  return { message: "Booking cancelled successfully." };
};

module.exports = {
  createBooking,
  getMyBookings,
  cancelBooking,
};
