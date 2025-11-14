# API 테스트 명세서

## 1. 예매 관련 API (`Bookings`)

### 1.1. `POST /bookings` (예매 생성)

#### Request:

```json
POST /bookings
Content-Type: application/json
{
  "performanceId": "perf_001",   // 공연 ID
  "seatIds": ["A1", "A2"],       // 선택 좌석 ID 배열
  "paymentMethod": "CREDIT_CARD" // 결제 방법
}
```

#### Response: 성공 (`201 Created`)

```json
{
  "message": "Booking initiated. Please proceed to payment.",
  "bookingId": "bk_12345abcd", // 생성된 예매 ID
  "paymentIntentId": "pi_12345efghi", // 연결된 결제 의향 ID
  "totalAmount": 60000 // 총 결제 금액
}
```

#### Response: 실패 (`400 Bad Request`)

```json
{
  "error": "User, performance, and seats are required."
}
```

---

### 1.2. `GET /bookings/my` (내 예매 조회)

#### Request:

```json
GET /bookings/my
Content-Type: application/json
Authorization: Bearer <JWT_TOKEN>
```

#### Response: 성공 (`200 OK`)

```json
[
  {
    "bookingId": "bk_12345abcd",
    "performanceId": "perf_001",
    "totalAmount": 60000,
    "status": "confirmed", // 예매 상태 ["pending", "confirmed", "failed", "cancelled"]
    "createdAt": "2025-11-14T10:00:00Z"
  }
]
```

#### Response: 실패 (`401 Unauthorized`)

```json
{
  "error": "Unauthorized access."
}
```

---

### 1.3. `DELETE /bookings/:id` (예매 취소)

#### Request:

```json
DELETE /bookings/bk_12345abcd
Content-Type: application/json
Authorization: Bearer <JWT_TOKEN>
```

#### Response: 성공 (`200 OK`)

```json
{
  "message": "Booking cancelled successfully."
}
```

#### Response: 실패 (`404 Not Found`)

```json
{
  "error": "Booking not found."
}
```

#### Response: 실패 (`403 Forbidden`)

```json
{
  "error": "Unauthorized to cancel this booking."
}
```

---

## 2. 결제 관련 API (`Payments`)

### 2.1. `POST /payments/execute` (결제 실행)

#### Request:

```json
POST /payments/execute
Content-Type: application/json
{
  "paymentIntentId": "pi_12345efghi",    // 결제를 실행할 의향 ID
  "paymentMethodToken": "tok_12345abcd", // 결제 수단 토큰
  "cvv": "123"                          // 신용 카드 CVV
}
```

#### Response: 성공 (`200 OK`)

```json
{
  "message": "Payment SUCCESS",
  "paymentIntentId": "pi_12345efghi",
  "status": "SUCCESS",
  "pgMockData": {
    "isSuccess": true,
    "processedAt": "2025-11-14T10:05:00Z"
  }
}
```

#### Response: 실패 (`400 Bad Request`)

```json
{
  "message": "Payment FAILURE",
  "paymentIntentId": "pi_12345efghi",
  "status": "FAILURE",
  "error": {
    "failureCode": "CARD_DECLINED",
    "failureConcept": "CLIENT_ERROR"
  }
}
```

---

## 공통 설정

### 헤더 규칙

- `Authorization`: API 요청에 인증이 필요한 경우 JWT 토큰을 헤더에 추가해야 합니다.
- 모든 요청의 `Content-Type`은 `application/json`이어야 합니다.

---

### 응답 코드 해석

- 성공 시: `200 OK`, `201 Created`
- 사용자 오류: `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`
- 서버 오류: `500 Internal Server Error`

---

### 테스트 툴

- 테스트는 Postman 혹은 cURL 명령으로 실행 가능합니다.
- 예시:

```bash
curl -X POST https://example.com/bookings \
-H "Content-Type: application/json" \
-H "Authorization: Bearer <JWT_TOKEN>" \
-d '{
  "performanceId": "perf_001",
  "seatIds": ["A1", "A2"],
  "paymentMethod": "CREDIT_CARD"
}'
```
