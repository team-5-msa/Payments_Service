# API 테스트 및 실행 시나리오

이 문서는 결제 서비스의 주요 API 흐름을 테스트하기 위한 시나리오를 정의합니다.

## 1. 사전 준비

1.  **Firebase Emulator 및 서버 실행**

    - 프로젝트 루트에서 Firebase Emulator를 시작하고, 개발 서버를 실행합니다.

    ```bash
    # Firebase Emulator 시작
    firebase emulators:start

    # 개발 서버 실행
    npm run dev
    ```

## 2. 시나리오 1: 정상적인 예매 및 결제 성공 흐름

### 단계 1: 예매 생성 (좌석 잠금 및 결제 의향 생성)

- **API**: `POST /bookings`
- **설명**: 사용자가 좌석을 선택하여 예매를 요청합니다. 이 과정에서 `bookings` 문서가 `pending` 상태로 생성되고, `paymentIntents` 문서가 생성되며, `occupiedSeats` 문서가 `locked` 상태로 생성됩니다.

**요청 예시 (`curl`)**:

```bash
curl -X POST http://localhost:3000/bookings \
-H "Content-Type: application/json" \
-d '{
  "userId": "user_123",
  "performanceId": "perf_001",
  "seatIds": ["A1", "A2"],
  "paymentMethod": "CREDIT_CARD"
}'
```

**예상 응답**:

- `HTTP 201 Created`
- 응답 본문에 `bookingId`와 `paymentIntentId`가 포함됩니다. 이 `paymentIntentId`를 다음 단계에서 사용합니다.

```json
{
  "message": "Booking initiated. Please proceed to payment.",
  "bookingId": "some-booking-id",
  "paymentIntentId": "some-payment-intent-id"
}
```

### 단계 2: 결제 실행 (성공)

- **API**: `POST /payments/execute`
- **설명**: 생성된 `paymentIntentId`를 사용하여 결제를 실행합니다. CVV 끝자리가 `0`, `1`, `9` 중 하나이면 결제가 성공합니다.

**요청 예시 (`curl`)**:

```bash
curl -X POST http://localhost:3000/payments/execute \
-H "Content-Type: application/json" \
-d '{
  "paymentIntentId": "some-payment-intent-id",
  "paymentMethodToken": "tok_visa_creditCard",
  "cvv": "120"
}'
```

**예상 결과**:

- `HTTP 200 OK` 응답 및 결제 성공 메시지 반환.
- `bookings` 문서의 상태가 `confirmed`로 변경됩니다.
- `occupiedSeats` 문서의 상태가 `booked`로 변경됩니다.

### 단계 3: 예매 내역 확인

- **API**: `GET /bookings/user/:userId`
- **설명**: 결제가 완료된 예매 내역을 확인합니다.

**요청 예시 (`curl`)**:

```bash
curl -X GET http://localhost:3000/bookings/user/user_123
```

**예상 응답**:

- `HTTP 200 OK`
- `status`가 `confirmed`인 예매 내역 배열을 반환합니다.

### 단계 4: 점유 좌석 상태 확인

- **API**: `GET /occupiedSeats/:performanceId`
- **설명**: 좌석이 `booked` 상태인지 확인합니다.

**요청 예시 (`curl`)**:

```bash
curl -X GET "http://localhost:3000/occupiedSeats/perf_001?seatIds=A1,A2"
```

**예상 응답**:

- `status`가 `booked`인 좌석 정보 배열을 반환합니다.

## 3. 시나리오 2: 예매 후 결제 실패 흐름

### 단계 1: 예매 생성

- 시나리오 1의 1단계와 동일하게 진행하여 `paymentIntentId`를 발급받습니다.

### 단계 2: 결제 실행 (실패)

- **API**: `POST /payments/execute`
- **설명**: CVV 끝자리를 실패 조건(`2`~`8`)에 맞춰 결제를 실패시킵니다.

**요청 예시 (`curl`)**:

```bash
curl -X POST http://localhost:3000/payments/execute \
-H "Content-Type: application/json" \
-d '{
  "paymentIntentId": "some-payment-intent-id",
  "paymentMethodToken": "tok_visa_creditCard",
  "cvv": "442"
}'
```

**예상 결과**:

- `HTTP 200 OK` 응답 및 결제 실패 메시지 반환.
- `bookings` 문서의 상태가 `cancelled`로 변경됩니다.
- `occupiedSeats` 문서가 삭제되거나 `available` 상태로 변경되어 잠금이 해제됩니다.

## 4. 시나리오 3: 예매 취소

### 단계 1: 예매 생성

- 시나리오 1의 1단계와 동일하게 진행하여 `bookingId`를 발급받습니다.

### 단계 2: 예매 취소

- **API**: `DELETE /bookings/user/:userId`
- **설명**: 사용자가 직접 예매를 취소합니다. `pending` 상태의 예매만 취소할 수 있습니다.

**요청 예시 (`curl`)**:

```bash
curl -X DELETE http://localhost:3000/bookings/user/user_123 \
-H "Content-Type: application/json" \
-d '{
  "bookingId": "some-booking-id"
}'
```

**예상 결과**:

- `HTTP 200 OK`
- `bookings` 문서 상태가 `cancelled`로 변경됩니다.
- `occupiedSeats` 잠금이 해제됩니다.
