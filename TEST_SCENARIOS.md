# API 테스트 및 실행 시나리오

## 개요

이 문서는 현재 프로젝트의 API를 테스트하기 위한 실행 시나리오를 정의합니다. 본 시나리오는 다음과 같은 **하이브리드 아키텍처**를 기반으로 합니다.

- **예매 생성 (`/bookings`)**: 클라이언트가 예매 정보를 보내면, 서버는 `pending` 상태의 예매와 결제 의향을 동기적으로 생성합니다.
- **결제 실행 (`/payments/execute`)**: 클라이언트가 결제를 실행하면, 서버는 결제를 **동기적으로 시뮬레이션**하고 그 결과를 **이벤트(`events` 컬렉션)로 발행**합니다.
- **후속 처리**: 백그라운드 프로세스가 발행된 이벤트를 감지하여 예매 상태 확정, 좌석 상태 변경 등의 후속 작업을 **비동기적으로 처리**합니다.

## 테스트를 위한 사전 준비

1. **전체 서비스 실행**: `Payments_Service`와 API 게이트웨이(또는 Postman으로 시뮬레이션)가 실행 중이어야 합니다.
2. **가상 서비스 설정**: `performance.service.js`가 정상적으로 모의(mock) 좌석 정보와 가격을 반환하도록 설정되어 있어야 합니다.
3. **테스트 사용자 ID**: `user_test_001`이라는 `userId`를 사용.

---

## 시나리오 1: 정상적인 예매 및 결제 성공 흐름

### 단계 1: 예매 생성 (수량 기반 좌석 할당 및 결제 의향 생성)

- **API**: `POST /bookings`
- **설명**: 사용자가 공연 ID와 좌석 수량을 지정하여 예매를 요청합니다. 서버는 `Performances_Service`로부터 좌석을 할당받고, `bookings`와 `paymentIntents` 문서를 `pending` 상태로 생성합니다.

#### 요청 예시 (`curl` / Postman)

- **URL**: `http://api-gateway.domain.com/bookings`
- **Method**: `POST`
- **Headers**:
  - `Content-Type`: `application/json`
  - `x-user-id`: `user_test_001`
- **Body**:
  ```json
  {
    "performanceId": "perf_001",
    "quantity": 2,
    "paymentMethod": "CREDIT_CARD"
  }
  ```

#### 예상 응답 (`201 Created`)

- `bookingId`와 계산된 `totalAmount`를 반환합니다.
  ```json
  {
    "message": "Booking and payment intent created. Please proceed to payment execution.",
    "bookingId": "some-generated-booking-id",
    "totalAmount": 60000
  }
  ```

---

### 단계 2: 결제 실행 (성공)

- **API**: `POST /payments/execute`
- **설명**: 서버에 결제를 요청하며 성공을 유도하는 CVV(`120`)를 제공합니다. 서버는 결제를 성공으로 시뮬레이션하고, `PAYMENT_SUCCEEDED` 이벤트를 발행합니다.

#### 요청 예시 (`curl` / Postman)

- **URL**: `http://api-gateway.domain.com/payments/execute`
- **Method**: `POST`
- **Headers**:
  - `Content-Type`: `application/json`
  - `x-user-id`: `user_test_001`
- **Body**:
  ```json
  {
    "bookingId": "some-generated-booking-id",
    "paymentMethodToken": "tok_visa_creditCard",
    "cvv": "120"
  }
  ```

#### 예상 응답 (`200 OK`)

- 결제가 성공했음을 알립니다.
  ```json
  {
    "message": "Payment simulation finished with status: SUCCESS",
    "finalStatus": "SUCCESS",
    "bookingId": "some-generated-booking-id",
    "pgMockData": {
      "isSuccess": true,
      "failureCode": null,
      "processedAt": "..."
    }
  }
  ```

---

### 단계 3: 최종 상태 확인 (비동기 처리 후)

- **API**: `GET /bookings/my`
- **설명**: 이벤트 처리 후 `bookings` 상태가 `confirmed`로 변경되었는지 확인합니다.

#### 요청 예시 (`curl` / Postman)

- **URL**: `http://api-gateway.domain.com/bookings/my`
- **Method**: `GET`
- **Headers**:
  - `x-user-id`: `user_test_001`

#### 예상 응답 (`200 OK`)

- 해당 예매의 상태가 `confirmed`임을 반환합니다.
  ```json
  [
    {
      "bookingId": "some-generated-booking-id",
      "userId": "user_test_001",
      "performanceId": "perf_001",
      "quantity": 2,
      "seatIds": ["C7", "C8"],
      "status": "confirmed",
      "createdAt": "..."
    }
  ]
  ```

---

## 시나리오 2: 예매 후 결제 실패 흐름

### 단계 1: 예매 생성

- 시나리오 1 단계 1과 동일합니다.

---

### 단계 2: 결제 실행 (실패)

- **API**: `POST /payments/execute`
- **설명**: 실패를 유도하는 CVV(`442`)를 사용해 결제를 시뮬레이션합니다. 서버는 실패로 처리하고 `PAYMENT_FAILED` 이벤트를 발행합니다.

#### 요청 예시 (`curl` / Postman)

- **Body**:
  ```json
  {
    "bookingId": "some-new-booking-id",
    "paymentMethodToken": "tok_visa_creditCard",
    "cvv": "442"
  }
  ```

#### 예상 응답 (`200 OK`)

- 결제가 실패한 상태를 반환합니다.
  ```json
  {
    "message": "Payment simulation finished with status: FAILURE",
    "finalStatus": "FAILURE",
    "bookingId": "some-new-booking-id",
    "pgMockData": {
      "isSuccess": false,
      "failureCode": "DECLINE_2",
      "processedAt": "..."
    }
  }
  ```

---

### 단계 3: 최종 상태 확인 (비동기 처리 후)

- **API**: `GET /bookings/my`
- **설명**: 이벤트 처리 후, 예매 상태를 `failed`로 확인합니다.

####

## 2.1 `bookings` - 예약 정보 관리

![bookings 컬렉션 문서](image1.png)

- **역할**: 사용자의 **예약 요청** 자체를 기록하고 관리하는 컬렉션입니다.
- **분리 이유**:
  - **상태 관리의 명확성**: 예약의 생명주기(`pending`, `confirmed`, `cancelled`)를 독립적으로 관리할 수 있습니다. 예를 들어, 사용자가 좌석을 선택했지만 아직 결제하지 않은 상태(`pending`)를 명확히 표현할 수 있습니다.
  - **관심사의 분리**: 결제, 좌석 점유, 회계 등 다른 도메인과 예약 정보를 분리하여 각 서비스가 자신의 책임에만 집중하도록 합니다. `bookings`는 "어떤 사용자가 어떤 공연의 어떤 좌석을 예매하려고 하는가"라는 정보만 기록합니다.

---

## 2.2 `events` - 비동기 이벤트 처리

![events 컬렉션 문서](image2.png)

- **역할**: 외부 시스템(Stripe 등)으로부터 들어오는 **웹훅 이벤트를 저장**하는 '받은 편지함(Inbox)' 역할을 합니다.
- **분리 이유**:
  - **비동기 처리 및 안정성**: 웹훅을 받는 즉시 최소한의 검증만 거쳐 `events` 컬렉션에 저장하고 성공 응답을 보냅니다. 이후 별도의 프로세스가 이벤트를 읽어 실제 비즈니스 로직을 처리합니다. 이 과정을 통해 **데이터 유실 없이 안정적**으로 이벤트를 처리할 수 있습니다.
  - **디커플링(Decoupling)**: 웹훅 수신 로직과 비즈니스 처리 로직을 완전히 분리하여 결제 시스템의 변경과 비즈니스 로직의 복잡성 증가가 서로 영향을 주지 않도록 합니다.

---

## 2.3 `ledgerEntries` - 회계 원장 기록

![MERCHANT_BALANCE CREDIT](image3.png) ![CUSTOMER_PAYABLE DEBIT](image4.png)

- **역할**: 시스템 내에서 발생하는 모든 금전적 거래를 복식 부기(Double-Entry Bookkeeping) 원칙에 따라 기록하는 회계 원장입니다.
- **분리 이유**:
  - **금융 데이터의 무결성 및 감사 추적**: 모든 거래는 차변(Debit)과 대변(Credit)의 한 쌍으로 기록되어야 하며, 합계는 항상 0이 되어야 합니다. 이를 통해 시스템의 돈의 흐름을 정확히 추적하고 재무 상태의 무결성을 보장합니다.
  - **역할의 명확화**: 이는 순수한 회계 데이터만을 다루는 전문화된 컬렉션입니다. 예약이나 결제 상태와는 독립적으로 '돈 이동'만을 기록하여 시스템의 재무 관련 분석이나 리포팅을 용이하게 합니다.

---

## 2.4 `occupiedSeats` - 좌석 점유 관리

![occupiedSeats 컬렉션 문서](image5.png)

- **역할**: 사용자가 예약을 시작하여 결제를 완료하기 전까지 선택한 좌석을 **일시적으로 점유**하는 상태를 기록합니다.
- **분리 이유**:
  - **동시성 문제 해결**: 여러 사용자가 동시에 같은 좌석을 예매하려는 것을 방지하기 위해 `occupiedSeats` 컬렉션은 좌석에 대한 잠금(Lock) 메커니즘으로 동작합니다.
  - **상세 예시**:
    - 스크린샷의 문서(`seatId: "A3"`)는 A3 좌석이 특정 예약(`bookingId`)을 위해 `locked` 상태임을 명시합니다.
    - `lockedUntil` 필드를 사용해 일정 시간(예: 10분)이 지나면 자동으로 잠금이 해제되는 타임아웃 로직을 구현할 수 있습니다. 이를 통해, 사용자가 결제를 완료하지 않고 이탈하더라도 좌석이 영구적으로 점유되지 않도록 합니다.

---

## 2.5 `paymentIntents` - 결제 의도 관리

![paymentIntents 컬렉션 문서](image6.png)

- **역할**: 외부 결제 시스템(PG)을 통해 생성된 **결제 의도(Payment Intent)**의 전체 생명주기를 추적하고 관리합니다.
- **분리 이유**:
  - **결제 상태의 상세 추적**: 결제는 `생성`, `처리 중`, `성공`, `실패` 등 복잡한 상태를 포함합니다. `paymentIntents` 컬렉션은 이 상태 변화를 `bookings`와 분리하여 독립적으로 상세히 관리합니다.
  - **외부 시스템과의 연동**: 스크린샷의 `pgMockData` 필드처럼, 외부 결제 시스템이 반환한 성공/실패 정보를 저장하여 문제 발생 시 원인을 추적하고 디버깅하는 데 중요한 단서를 제공합니다. 이는 결제 도메인의 복잡성을 다른 서비스로부터 격리하는 효과적인 전략입니다.
