const axios = require("axios");

const axiosInstance = axios.create({
  baseURL: "https://performance-service.fly.dev", // Performance Service의 기본 URL
  timeout: 100000, // 요청 제한 시간 (밀리초)
  headers: {
    "Content-Type": "application/json", // 요청 데이터의 타입을 JSON으로 설정
  },
});

// 요청 인터셉터 (필요시)
axiosInstance.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => Promise.reject(error)
);

// 응답 인터셉터 (필요시)
axiosInstance.interceptors.response.use(
  (response) => response.data, // 데이터만 반환
  (error) => {
    console.error("[Axios Error]", error.response || error.message);
    return Promise.reject(error);
  }
);

module.exports = axiosInstance;
