const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      success: false,
      message: "Authorization header is missing.",
    });
  }

  // console.log("Authorization Header:", authHeader);

  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Token is missing.",
    });
  }

  try {
    // API Gateway에서 이미 검증된 토큰이라고 가정하고 디코딩합니다.
    // 보안을 강화하려면 여기서도 process.env.JWT_SECRET을 사용하여 verify를 수행해야 합니다.
    const decoded = jwt.decode(token);

    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: "Invalid token.",
      });
    }

    // console.log("Decoded User:", decoded);

    // 컨트롤러에서 헤더를 다시 찾지 않도록, 토큰 원본도 함께 전달
    // user_id를 id로 매핑하여 컨트롤러에서 일관되게 사용할 수 있도록 함
    req.user = {
      ...decoded,
      id: decoded.user_id || decoded.id,
      token: `Bearer ${token}`,
    };
    next();
  } catch (error) {
    console.error("[AuthMiddleware] Token processing error:", error);
    return res.status(401).json({
      success: false,
      message: "Failed to process token.",
    });
  }
};

module.exports = authMiddleware;
