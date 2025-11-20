<<<<<<< HEAD
# MSA - Payments Service

MSA(Microservice Architecture) 기반 공연 예매 시스템의 결제 및 예매 처리 서비스입니다. 이 서비스는 다음과 같은 기능을 담당합니다.

- **예매(Booking)**: 사용자의 예매 요청을 처리하고, 좌석을 임시 잠금합니다.
- **결제(Payment)**: 예매에 대한 결제를 실행하고, 결과를 처리합니다.
- **좌석 상태 관리(OccupiedSeats)**: 좌석의 잠금 및 확정 상태를 중앙에서 관리하여 데이터 정합성을 보장합니다.

## 🚀 시작하기

### 사전 요구 사항

- Node.js (v18 이상)
- Firebase CLI
- `gcp-service-account.json` 파일 (Firebase Admin SDK 인증용)

### 설치 및 실행

1.  **저장소 복제 및 의존성 설치**

    ```bash
    git clone https://github.com/team-5-msa/Payments_Service.git
    cd Payments_Service
    npm install
    ```

2.  **Firebase Emulator 실행**

    - Firestore 데이터베이스를 로컬 환경에서 시뮬레이션합니다.

    ```bash
    firebase emulators:start
    ```
=======
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
>>>>>>> parent of 3accf10 (Add occupiedSeats API and refactor booking/payment flows)

3.  **개발 서버 실행**

<<<<<<< HEAD
    - `nodemon`을 사용하여 파일 변경 시 자동으로 재시작되는 개발 서버를 실행합니다.

    ```bash
    npm run dev
    ```

    서버가 성공적으로 실행되면 `http://localhost:3000`에서 요청을 수신합니다.

## 📖 API 명세

### 1. 예매 (Bookings)

#### `POST /bookings` - 예매 생성

- 새로운 예매를 생성하고, 관련 좌석을 잠금하며, 결제 의향(Payment Intent)을 생성합니다.
- **Request Body**:
  - `userId` (string, 필수): 사용자 ID
  - `performanceId` (string, 필수): 공연 ID
  - `seatIds` (array of strings, 필수): 좌석 ID 배열
  - `paymentMethod` (string, 필수): 결제 수단 (예: "CREDIT_CARD")

#### `GET /bookings/user/:userId` - 내 예매 내역 조회

- 특정 사용자의 모든 예매 내역을 조회합니다.
- **URL Parameter**:
  - `userId` (string, 필수): 조회할 사용자 ID

#### `DELETE /bookings/user/:userId` - 예매 취소

- `pending` 상태의 예매를 사용자가 직접 취소합니다.
- **URL Parameter**:
  - `userId` (string, 필수): 예매를 취소할 사용자 ID
- **Request Body**:
  - `bookingId` (string, 필수): 취소할 예매 ID

### 2. 결제 (Payments)

#### `POST /payments/execute` - 결제 실행

- 생성된 결제 의향에 대해 실제 결제를 실행합니다.
- **Request Body**:
  - `paymentIntentId` (string, 필수): 예매 생성 시 발급된 결제 의향 ID
  - `paymentMethodToken` (string, 필수): 결제 대행사(PG)로부터 받은 결제 수단 토큰
  - `cvv` (string, 필수): 결제 성공/실패 시뮬레이션을 위한 CVV 번호 (끝자리가 0, 1, 9이면 성공)

### 3. 점유 좌석 (Occupied Seats)
=======
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
>>>>>>> parent of 3accf10 (Add occupiedSeats API and refactor booking/payment flows)

#### `GET /occupiedSeats/:performanceId` - 점유 좌석 상태 조회

- 특정 공연의 좌석 상태(잠금, 확정)를 조회합니다.
- **URL Parameter**:
  - `performanceId` (string, 필수): 조회할 공연 ID
- **Query Parameter (선택 사항)**:
  - `seatIds` (string): 쉼표로 구분된 좌석 ID 목록 (예: `?seatIds=A1,B3`)

<<<<<<< HEAD
## 🏛️ 아키텍처 및 흐름

1.  **예매 요청**: 클라이언트가 `POST /bookings` API를 호출합니다.
2.  **좌석 잠금**: 서비스는 `occupiedSeats` 컬렉션에 해당 좌석들을 `locked` 상태로 5분간 저장합니다.
3.  **결제 의향 생성**: `paymentIntents` 컬렉션에 결제 정보를 담은 문서를 생성합니다.
4.  **결제 실행**: 클라이언트는 받은 `paymentIntentId`로 `POST /payments/execute`를 호출합니다.
5.  **결제 결과 처리**:
    - **성공 시**: `bookings` 상태를 `confirmed`로, `occupiedSeats` 상태를 `booked`로 업데이트합니다.
    - **실패 시**: `bookings` 상태를 `cancelled`로 업데이트하고, `occupiedSeats`의 잠금을 해제합니다.
=======
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
>>>>>>> parent of 3accf10 (Add occupiedSeats API and refactor booking/payment flows)
