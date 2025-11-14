// config/firebase.js

const admin = require("firebase-admin");
// 💡 dotenv를 로드하여 .env 파일의 변수를 process.env 객체에 주입
require('dotenv').config(); 

// 1. 환경 변수(문자열)를 가져옵니다.
const serviceAccountKeyString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

if (!serviceAccountKeyString) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set.");
}

// 2. JSON 문자열을 JavaScript 객체로 변환합니다.
// JSON.parse()를 사용하면 문자열 형태로 저장된 키 파일을 객체로 변환 가능
const serviceAccount = JSON.parse(serviceAccountKeyString);

// Firebase Admin SDK 초기화
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// db와 admin 객체를 외부로 내보내 다른 파일에서 쉽게 사용
module.exports = { db, admin };