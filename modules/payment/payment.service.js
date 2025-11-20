const paymentRepository = require("./payment.repository");
const { db } = require("../../config/firebase");

<<<<<<< HEAD
/**
 * 1. 결제 의향 생성 (booking.service에서 호출)
 */
=======
// (수정) 명세서에 맞게 파라미터 추가
>>>>>>> parent of 3accf10 (Add occupiedSeats API and refactor booking/payment flows)
const createPaymentIntent = async (
  bookingId,
  userId,
  amount,
  paymentMethod
) => {
  if (!bookingId || !userId || !amount || amount <= 0) {
<<<<<<< HEAD
    const error = new Error(
      "Invalid bookingId, userId, or amount for payment intent."
    );
    error.status = 400;
    throw error;
  }
  // Repository의 createIntent 함수를 호출합니다.
  await paymentRepository.createIntent(
=======
    const error = new Error("Invalid bookingId, userId, or amount");
    error.status = 400;
    throw error;
  }
  // (수정) 모든 정보를 레포지토리에 전달
  return paymentRepository.createIntent(
>>>>>>> parent of 3accf10 (Add occupiedSeats API and refactor booking/payment flows)
    bookingId,
    userId,
    amount,
    paymentMethod
  );
  return {};
};

<<<<<<< HEAD
/**
 * 2. 실제 결제 실행 (동기식이지만, 비동기 흐름을 흉내내는 최종본)
 */
const executePayment = async (userId, bookingId, paymentMethodToken, cvv) => {
  if (!bookingId || !paymentMethodToken || !cvv) {
    const error = new Error("Missing bookingId, token, or cvv");
=======
const executePayment = async (paymentIntentId, paymentMethodToken, cvv) => {
  if (!paymentIntentId || !paymentMethodToken || !cvv) {
    const error = new Error("Missing paymentIntentId, token, or cvv");
>>>>>>> parent of 3accf10 (Add occupiedSeats API and refactor booking/payment flows)
    error.status = 400;
    throw error;
  }

<<<<<<< HEAD
  // --- 멱등성 체크: 이미 처리된 결제인지 먼저 확인 ---
  const intentRef = db.collection("paymentIntents").doc(bookingId);
  const intentDoc = await intentRef.get();
  if (!intentDoc.exists) throw new Error("Payment intent not found");

  const intentData = intentDoc.data();
  if (intentData.status !== "PENDING") {
    const error = new Error("Payment already processed");
    error.status = 409; // Conflict
    throw error;
  }
  // 사용자 검증
  if (intentData.userId !== userId) {
    const error = new Error("User not authorized for this payment");
    error.status = 403;
    throw error;
  }

  // --- Mock 결제 시뮬레이션 ---
  const lastDigit = cvv.slice(-1);
  const isSuccessMock = ["0", "1", "9"].includes(lastDigit);
=======
  // --- CVV 기반 Mock 결제 시뮬레이션 로직 (유지) ---
  const lastDigit = cvv.slice(-1);
  let isSuccessMock = ["0", "1", "9"].includes(lastDigit);
  let pgFailureCode = isSuccessMock ? null : `DECLINE_${lastDigit}`;
  let failureConcept = isSuccessMock ? null : "CLIENT_ERROR";
  // ... (이하 Mock 로직은 동일)

>>>>>>> parent of 3accf10 (Add occupiedSeats API and refactor booking/payment flows)
  const pgMockData = {
    isSuccess: isSuccessMock,
    failureCode: isSuccessMock ? null : `DECLINE_${lastDigit}`,
    processedAt: new Date().toISOString(),
  };

<<<<<<< HEAD
  const finalStatus = isSuccessMock ? "SUCCESS" : "FAILURE";
  const bookingFinalStatus = isSuccessMock ? "PAID" : "PAYMENT_FAILED";

  // --- 순차적 DB 업데이트 실행 ---
  if (isSuccessMock) {
    // 1. paymentIntents 상태 업데이트
    await paymentRepository.updatePaymentIntentStatus(
      bookingId,
      finalStatus,
      pgMockData
    );

    // 2. events 상태 업데이트
    await paymentRepository.updateEventStatusByBookingId(
      bookingId,
      finalStatus
    );

    // 3. bookings 상태 업데이트
    await paymentRepository.updateBookingStatus(bookingId, bookingFinalStatus);

    // 4. 재고, 회계 등 기타 작업
    const bookingDoc = await db.collection("bookings").doc(bookingId).get();
    const performanceId = bookingDoc.data().performanceId;
    await paymentRepository.updateUserStock(performanceId);
    await paymentRepository.createLedgerEntries(bookingId, intentData.amount);
  } else {
    // 실패 시
    await paymentRepository.updatePaymentIntentStatus(
      bookingId,
      finalStatus,
      pgMockData
    );
    await paymentRepository.updateEventStatusByBookingId(
      bookingId,
      finalStatus
    );
    await paymentRepository.updateBookingStatus(bookingId, bookingFinalStatus);
  }

  return {
    message: `Payment process finished with status: ${finalStatus}`,
    finalStatus,
    bookingId,
  };
=======
  let finalStatus = "";

  // 트랜잭션 실행
  await paymentRepository.runPaymentTransaction(
    paymentIntentId,
    (intentRef) => async (t) => {
      const doc = await t.get(intentRef);
      if (!doc.exists) throw new Error("Payment intent not found");

      const data = doc.data();
      if (data.status !== "PENDING")
        throw new Error("Payment already processed");

      if (isSuccessMock) {
        finalStatus = "SUCCESS";
        t.update(intentRef, {
          status: finalStatus,
          pgMockData,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // (수정) 명세서에 맞는 필드명으로 레포지토리 함수 호출
        paymentRepository.createLedgerEntries(
          t,
          paymentIntentId,
          data.amount,
          data.bookingId // data.orderId -> data.bookingId
        );
        await paymentRepository.emitEvent("PAYMENT_SUCCESS", {
          paymentIntentId,
          bookingId: data.bookingId, // data.orderId -> data.bookingId
        });
      } else {
        finalStatus = "FAILURE";
        t.update(intentRef, {
          status: finalStatus,
          pgMockData,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        await paymentRepository.emitEvent("PAYMENT_FAILURE", {
          paymentIntentId,
          bookingId: data.bookingId, // data.orderId -> data.bookingId
          failureConcept,
        });
      }
    }
  );

  return { finalStatus, pgMockData };
>>>>>>> parent of 3accf10 (Add occupiedSeats API and refactor booking/payment flows)
};

module.exports = {
  createPaymentIntent, // 복원된 함수
  executePayment,
};
