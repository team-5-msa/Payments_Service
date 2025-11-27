// config/firebase.js (수정된 내용)

const admin = require("firebase-admin");
require("dotenv").config(); // Fly.io에서는 필요 없습니다. (로컬 테스트용으로 남겨둘 수는 있습니다.)

// 1. Base64로 인코딩된 환경 변수(문자열)를 가져옵니다.
// 안전하게 설정된 'FIREBASE_SERVICE_ACCOUNT_B64'를 사용합니다.
const serviceAccountKeyBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;

if (!serviceAccountKeyBase64) {
  // 이제 이 변수가 설정되지 않았을 경우 오류가 발생합니다.
  throw new Error(
    "FIREBASE_SERVICE_ACCOUNT_B64 environment variable is not set."
  );
}

// 2. Base64 문자열을 디코딩하여 일반 JSON 문자열로 변환합니다.
// Node.js의 Buffer 객체를 사용하여 Base64 디코딩을 수행합니다.
const serviceAccountKeyString = Buffer.from(
  serviceAccountKeyBase64,
  "base64"
).toString("utf8");

// 3. 디코딩된 JSON 문자열을 JavaScript 객체로 변환합니다. (파싱)
const serviceAccount = JSON.parse(serviceAccountKeyString);

// Firebase Admin SDK 초기화
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// db와 admin 객체를 외부로 내보내 다른 파일에서 쉽게 사용
module.exports = { db, admin };
