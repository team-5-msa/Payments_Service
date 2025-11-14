# API 테스트 명세서 - Payments_Service

## 1. 좌석 예매 관련 API (`Bookings`)

### 1.1. 예매 생성 (`POST /bookings`)

사용자가 선택한 좌석을 잠금 처리하고 예매를 시작합니다.

#### Request Body

```json
POST /bookings
Content-Type: application/json
{
  "performanceId": "perf_001",
  "seatIds": ["A2"],
  "paymentMethod": "CREDIT_CARD",
  "userId": "user_123"
}
```

#### Response (성공)

```json
HTTP 201 Created
{
  "message": "Booking initiated. Please proceed to payment.",
  "bookingId": "AGeV3v5J9UzyJ4bw9ECo",
  "paymentIntentId": "i0do0nHZSn4TZr0tKOa9",
  "totalAmount": 30000
}
```

#### Response (실패 - 좌석 잠금 실패)

```json
HTTP 400 Bad Request
{
  "error": "Seat A2 is not available."
}
```

#### Response (실패 - 필수 정보 누락)

```json
HTTP 400 Bad Request
{
  "error": "User, performance, and seats are required."
}
```

---

### 1.2. 내 예매 내역 조회 (`GET /bookings/my`)

사용자가 자신이 생성한 모든 예매 내역을 조회합니다.

#### Request

- `Authorization`: Bearer `<USER_JWT_TOKEN>`

#### Response (성공)

```json
HTTP 200 OK
[
  {
    "bookingId": "AGeV3v5J9UzyJ4bw9ECo",
    "performanceId": "perf_001",
    "seatIds": ["A2"],
    "total_amount": 30000,
    "status": "confirmed",
    "userId": "user_123",
    "createdAt": "2025-11-14T10:47:06Z"
  }
]
```

---

### 1.3. 예매 취소 (`DELETE /bookings/:id`)

`pending` 상태의 예매를 취소합니다.

#### Request

- `id`: 예매 ID
- `Authorization`: Bearer `<USER_JWT_TOKEN>`

#### Response (성공)

```json
HTTP 200 OK
{
  "message": "Booking cancelled successfully."
}
```

#### Response (실패 - 권한 에러)

```json
HTTP 403 Forbidden
{
  "error": "Unauthorized to cancel this booking."
}
```

---

## 2. 결제 관련 API (`Payments`)

### 2.1. 결제 실행 (`POST /payments/execute`)

결제 프로세스를 실행합니다.

#### Request Body

```json
POST /payments/execute
Content-Type: application/json
{
  "paymentIntentId": "i0do0nHZSn4TZr0tKOa9",
  "paymentMethodToken": "tok_visa_creditCard",
  "cvv": "123"
}
```

#### Response (성공)

```json
HTTP 200 OK
{
  "message": "Payment SUCCESS",
  "paymentIntentId": "i0do0nHZSn4TZr0tKOa9",
  "status": "SUCCESS",
  "pgMockData": {
    "isSuccess": true,
    "processedAt": "2025-11-14T10:50:00Z"
  }
}
```

#### Response (실패 - 카드 결제 실패)

```json
HTTP 400 Bad Request
{
  "message": "Payment FAILURE",
  "paymentIntentId": "i0do0nHZSn4TZr0tKOa9",
  "status": "FAILURE",
  "error": {
    "failureCode": "CARD_DECLINED",
    "failureConcept": "CLIENT_ERROR"
  }
}
```

---

## 3. 좌석 잠금 관련 로직 (`occupiedSeats` 컬렉션)

`occupiedSeats` 컬렉션을 통해 좌석의 잠금을 관리합니다.

### 문서 구조 (`/occupiedSeats/perf_001_A2`)

```json
{
  "bookingId": "AGeV3v5J9UzyJ4bw9ECo",
  "userId": "user_123",
  "lockedUntil": {
    "seconds": 1763117083,
    "nanoseconds": 136000000
  },
  "status": "locked"
}
```

---

### API 테스트 요약

1. **예매 성공 시나리오 테스트**:

   - `POST /bookings`: 예매 생성 및 좌석 잠금.
   - `POST /payments/execute`: 결제 실행 및 성공.

2. **예매 취소 및 예매 실패 테스트**:

   - `DELETE /bookings/:id`: 예매 취소 시도.
   - 좌석 잠금 해제를 동반한 실패 시나리오.

3. **좌석의 상태 관리 테스트**:
   - `occupiedSeats` 컬렉션에서 좌석 상태 변경 확인.

이 명세서는 팀원과 함께 빠른 API 테스트를 진행할 수 있도록 설계되었습니다. 추가 요청이 있으면 말씀해주세요! 😊
