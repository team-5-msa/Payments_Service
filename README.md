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

3.  **개발 서버 실행**

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

#### `GET /occupiedSeats/:performanceId` - 점유 좌석 상태 조회

- 특정 공연의 좌석 상태(잠금, 확정)를 조회합니다.
- **URL Parameter**:
  - `performanceId` (string, 필수): 조회할 공연 ID
- **Query Parameter (선택 사항)**:
  - `seatIds` (string): 쉼표로 구분된 좌석 ID 목록 (예: `?seatIds=A1,B3`)

## 🏛️ 아키텍처 및 흐름

1.  **예매 요청**: 클라이언트가 `POST /bookings` API를 호출합니다.
2.  **좌석 잠금**: 서비스는 `occupiedSeats` 컬렉션에 해당 좌석들을 `locked` 상태로 5분간 저장합니다.
3.  **결제 의향 생성**: `paymentIntents` 컬렉션에 결제 정보를 담은 문서를 생성합니다.
4.  **결제 실행**: 클라이언트는 받은 `paymentIntentId`로 `POST /payments/execute`를 호출합니다.
5.  **결제 결과 처리**:
    - **성공 시**: `bookings` 상태를 `confirmed`로, `occupiedSeats` 상태를 `booked`로 업데이트합니다.
    - **실패 시**: `bookings` 상태를 `cancelled`로 업데이트하고, `occupiedSeats`의 잠금을 해제합니다.
