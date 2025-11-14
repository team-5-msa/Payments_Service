/**
 * payment.service.js
 *
 * 결제 관련 비즈니스 로직을 처리하는 서비스 레이어입니다.
 * - 결제 의향(Payment Intent) 생성
 * - 실제 결제 실행 및 결과 처리
 * - 결제 결과에 따른 후속 작업(원장 기록, 이벤트 발행) 트리거
 */

const paymentRepository = require("./payment.repository");
const { admin } = require("../../config/firebase");

// --- 비즈니스 로직 레이어 ---

/**
 * 결제 의향(Payment Intent)을 생성합니다.
 * 이 함수는 실제 결제가 일어나기 전에, '결제를 하겠다'는 의도를 시스템에 기록하는 역할을 합니다.
 *
 * @param {string} bookingId - 연결된 예매의 ID
 * @param {string} userId - 결제를 시도하는 사용자의 ID
 * @param {number} amount - 결제할 총 금액
 * @param {string} paymentMethod - 결제 수단 (예: "CREDIT_CARD")
 * @returns {Promise<string>} 생성된 결제 의향 문서의 ID (paymentIntentId)
 */
const createPaymentIntent = async (
  bookingId,
  userId,
  amount,
  paymentMethod
) => {
  // 1. 입력값 유효성 검증: 필수 정보가 없거나 금액이 0 이하이면 에러를 발생시킵니다.
  if (!bookingId || !userId || !amount || amount <= 0) {
    const error = new Error("Invalid bookingId, userId, or amount");
    error.status = 400; // 클라이언트 요청 오류 상태 코드
    throw error;
  }

  // 2. 데이터베이스 작업을 레포지토리에 위임: 모든 정보를 담아 레포지토리의 createIntent 함수를 호출합니다.
  return paymentRepository.createIntent(
    bookingId,
    userId,
    amount,
    paymentMethod
  );
};

/**
 * 실제 결제를 실행하고, 그 결과를 시스템에 기록합니다.
 *
 * @param {string} paymentIntentId - 'createPaymentIntent'를 통해 생성된 결제 의향 ID
 * @param {string} paymentMethodToken - PG사로부터 받은 실제 결제 수단 토큰 (예: 카드 정보 토큰)
 * @param {string} cvv - 카드 CVV 번호 (이 프로젝트에서는 결제 성공/실패를 시뮬레이션하는 데 사용됨)
 * @returns {Promise<{finalStatus: string, pgMockData: object}>} 결제 최종 상태와 PG사 모의 응답 데이터
 */
const executePayment = async (paymentIntentId, paymentMethodToken, cvv) => {
  // 1. 입력값 유효성 검증: 결제 실행에 필요한 정보가 누락되었는지 확인합니다.
  if (!paymentIntentId || !paymentMethodToken || !cvv) {
    const error = new Error("Missing paymentIntentId, token, or cvv");
    error.status = 400;
    throw error;
  }

  // 2. Mock 결제 시뮬레이션: CVV 끝자리를 기반으로 PG사의 결제 성공/실패를 모의로 결정합니다.
  // 실제 프로덕션 환경에서는 이 부분에 실제 PG사 API를 호출하는 로직이 들어갑니다.
  const lastDigit = cvv.slice(-1);
  const isSuccessMock = ["0", "1", "9"].includes(lastDigit); // CVV 끝이 0, 1, 9이면 성공으로 간주
  const pgFailureCode = isSuccessMock ? null : `DECLINE_${lastDigit}`;
  const failureConcept = isSuccessMock ? null : "CLIENT_ERROR";

  // PG사로부터 받았다고 가정하는 모의 응답 데이터 객체
  const pgMockData = {
    isSuccess: isSuccessMock,
    failureCode: pgFailureCode,
    failureConcept,
    processedAt: new Date().toISOString(),
  };

  let finalStatus = ""; // 트랜잭션 내에서 결정될 최종 상태를 저장할 변수

  // 3. Firestore 트랜잭션을 실행하여 데이터 정합성을 보장합니다.
  // 트랜잭션: 여러 개의 데이터베이스 작업을 하나의 원자적 단위로 묶어, 모두 성공하거나 모두 실패하게 만듭니다.
  await paymentRepository.runPaymentTransaction(
    paymentIntentId,
    (intentRef) => async (t) => {
      // 't'는 트랜잭션 객체입니다.

      // 3-1. 결제 의향 문서를 트랜잭션 내에서 조회합니다.
      const doc = await t.get(intentRef);
      if (!doc.exists) throw new Error("Payment intent not found");

      // 3-2. 상태 확인 (멱등성 보장): 이미 처리된 결제인지 확인합니다.
      // 멱등성: 동일한 요청을 여러 번 보내도 시스템 상태가 한 번만 변경되도록 보장하는 성질.
      const data = doc.data();
      if (data.status !== "PENDING") {
        throw new Error("Payment already processed");
      }

      // 3-3. 결제 시뮬레이션 결과에 따라 분기 처리합니다.
      if (isSuccessMock) {
        // [성공 시 로직]
        finalStatus = "SUCCESS";
        // a. 결제 의향 문서 상태를 'SUCCESS'로 업데이트합니다.
        t.update(intentRef, {
          status: finalStatus,
          pgMockData,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // b. 회계 원장을 기록합니다. (모든 돈의 흐름을 기록)
        paymentRepository.createLedgerEntries(
          t,
          paymentIntentId,
          data.amount,
          data.bookingId
        );

        // c. 'PAYMENT_SUCCESS' 이벤트를 발행하여 다른 서비스(예: 예매 서비스)에 알립니다.
        await paymentRepository.emitEvent("PAYMENT_SUCCESS", {
          paymentIntentId,
          bookingId: data.bookingId,
        });
      } else {
        // [실패 시 로직]
        finalStatus = "FAILURE";
        // a. 결제 의향 문서 상태를 'FAILURE'로 업데이트합니다.
        t.update(intentRef, {
          status: finalStatus,
          pgMockData,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // b. 'PAYMENT_FAILURE' 이벤트를 발행하여 다른 서비스에 알립니다. (좌석 잠금 해제 등 롤백 처리 유도)
        await paymentRepository.emitEvent("PAYMENT_FAILURE", {
          paymentIntentId,
          bookingId: data.bookingId,
          failureConcept,
        });
      }
    }
  );

  // 4. 최종 처리 결과를 반환합니다.
  return { finalStatus, pgMockData };
};

module.exports = {
  createPaymentIntent,
  executePayment,
};
