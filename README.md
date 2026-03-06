# 💳 MSA Payments Service

MSA(Microservice Architecture) 기반 공연 예매 시스템의 결제 및 트랜잭션 처리 서비스입니다.

<p align="center">
  <img src="https://expressjs.com/images/express-facebook-share.png" width="240" alt="Express Logo" />
</p>

---

> **"안정적이고 투명한 결제 경험을 제공합니다."**  
> 복잡한 결제 프로세스를 추상화하고, 이벤트 기반 아키텍처를 통해 데이터 정합성을 보장합니다.

---

## 🔗 Quick Links

- 🌐 **Live Demo (Backend)**: [https://msa-payments.fly.dev](https://msa-payments.fly.dev)
- 📑 **API Documentation**: [Swagger UI (Local)](http://localhost:3002/api-docs)
- 🖥️ **Central Repository**: [Payments_Service](https://github.com/team-5-msa/Payments_Service)

---

## 🏗️ 프로젝트 개요 (Project Overview)

**MSA Payments Service**는 공연 예매 시스템의 결제 라이프사이클을 관리하는 핵심 마이크로서비스입니다. 결제 의향(Intent) 생성부터 실제 결제 실행, 환불 및 상태 동기화까지의 전 과정을 담당합니다.

### 🎯 주요 목표

- **결제 무결성**: 분산 환경에서도 결제 데이터의 일관성을 유지하고 중복 결제를 방지합니다.
- **확장성 있는 아키텍처**: 이벤트 버스를 활용하여 타 서비스(Booking Service 등)와 느슨하게 결합된 통신을 지향합니다.
- **편리한 검증**: Mock PG(Payment Gateway)를 통해 실제 결제 환경을 시뮬레이션하고 다양한 시나리오를 테스트합니다.

---

## ✨ 핵심 기능 (Key Features)

### 💰 1. 결제 라이프사이클 관리

- **결제 의향 (Payment Intent)**: 실제 결제 전 예약 정보를 바탕으로 결제 준비 상태를 생성하여 멱등성을 보장합니다.
- **결제 실행 (Execution)**: Mock PG와 연동하여 신용카드 결제를 시뮬레이션하고 결과를 처리합니다.
- **환불 및 취소 (Refund & Cancel)**: 결제된 내역에 대한 환불 처리 및 진행 중인 결제 의향의 취소를 지원합니다.

### 📡 2. 이벤트 기반 메시징 (Event-Driven)

- **실시간 상태 업데이트**: 결제 완료, 실패, 환불 이벤트를 발행하여 예매 서비스가 즉각적으로 반응하도록 합니다.
- **이벤트 로그 관리**: 모든 결제 관련 이벤트를 Firestore에 기록하여 트래킹 및 장애 복구를 지원합니다.

### 🛡️ 3. 보안 및 안정성

- **인증 미들웨어**: JWT 기반의 인증을 통해 인가된 요청만 결제 API에 접근할 수 있도록 제한합니다.
- **보안 헤더**: Helmet, CORS 설정을 통해 웹 취약점으로부터 서비스를 보호합니다.
- **속도 제한 (Rate Limiting)**: API 남용 방지를 위한 요청 속도 제한이 적용되어 있습니다.

---

## 🛠 기술 스택 (Tech Stack)

### ⚙️ Backend & Infrastructure

- **Framework**: Node.js / Express.js
- **Database**: Google Cloud Firestore (Managed via Firebase Admin SDK)
- **API Documentation**: Swagger / OpenAPI 3.0
- **Validation**: Joi (Event Schema Validation)
- **Messaging**: Custom EventBus (Internal)
- **Deployment**: Fly.io / Docker

---

## 📂 프로젝트 구조 (Project Structure)

```text
src/
├── app.js               # Express 앱 및 미들웨어 설정
├── server.js            # 서버 엔트리 포인트
├── bin/                 # 서버 부트스트래퍼 (www)
├── config/              # Firebase 및 전역 설정
├── docs/                # Swagger API 명세
├── events/              # Joi 기반 이벤트 스키마
├── middlewares/         # 인증 및 에러 핸들링 미들웨어
├── modules/             # 비즈니스 로직
│   ├── booking/         # 타 서비스(Booking) API 클라이언트
│   ├── mocks/           # 결제 대행사(PG) 시뮬레이션
│   └── payment/         # 결제 컨트롤러, 서비스, 레포지토리
├── routes/              # Express 라우트 정의
└── utils/               # 공통 유틸리티 (EventBus, Logger, ErrorHandler)
```

---

## ⚙️ 시작하기 (Getting Started)

### 1. 환경 변수 설정

프로젝트 루트에 `.env` 파일을 생성하고 아래 항목들을 설정합니다.

```env
# Firebase Admin SDK (Base64 encoded JSON)
FIREBASE_SERVICE_ACCOUNT_B64=

# App Settings
PORT=3002
NODE_ENV=development
```

### 2. 설치 및 실행

```bash
# 의존성 설치
$ npm install

# 개발 서버 실행 (Nodemon)
$ npm run dev

# 프로덕션 빌드 및 실행
$ npm start
```

### 3. Firebase Emulator (선택 사항)

로컬에서 Firestore를 시뮬레이션하려면 아래 명령어를 사용합니다.

```bash
$ firebase emulators:start
```

---

## 📖 API 목록

### 1. 결제 (Payment) - `/payment` (JWT 필수)

모든 요청에 `Authorization: Bearer <token>` 헤더가 필요합니다.

| Method | Endpoint              | 설명                   | Request Body Key Fields                                    |
| :----- | :-------------------- | :--------------------- | :--------------------------------------------------------- |
| `POST` | `/payment/intent`     | 결제 의향 생성         | `{ bookingId, totalAmount, paymentMethod, performanceId }` |
| `POST` | `/payment/execute`    | 실 결제 실행 (Mock PG) | `{ bookingId, paymentMethodToken, cardNumber, cvv }`       |
| `POST` | `/payment/refund`     | 결제 환불 처리         | `{ bookingId }`                                            |
| `POST` | `/payment/cancel`     | 결제 의향 취소         | `{ bookingId }`                                            |
| `GET`  | `/payment/events/:id` | 결제 이벤트 상태 조회  | Param: `bookingId`                                         |

---

## 📄 라이선스 (License)

본 프로젝트는 **MIT License**를 따릅니다.
