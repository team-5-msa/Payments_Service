const axios = require("axios");

const BASE_URL =
  process.env.NODE_ENV === "production"
    ? "https://msa-booking.fly.dev" // 배포서버 URL
    : "http://localhost:3001"; // Localhost URL

const bookingAxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 10000, // 요청 제한 시간 (밀리초)
  headers: {
    "Content-Type": "application/json", // 요청 데이터의 타입을 JSON으로 설정
  },
});

// 요청 인터셉터 (필요시)
bookingAxiosInstance.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => Promise.reject(error)
);

// 응답 인터셉터 (필요시)
bookingAxiosInstance.interceptors.response.use(
  (response) => response.data, // 데이터만 반환
  (error) => {
    console.error("[booking Axios Error]", error.response || error.message);
    return Promise.reject(error);
  }
);

module.exports = bookingAxiosInstance;
