const EventEmitter = require("events");
const { v4: uuidv4 } = require("uuid");
const logger = require("./logger");
const eventSchemas = require("@events/schemas");

class EventBus extends EventEmitter {
  constructor() {
    super();
  }

  /**
   * 이벤트를 발행합니다.
   * @param {string} eventName - 이벤트 이름
   * @param {object} data - 데이터
   * @param {string} [correlationId] - 상관 ID (없으면 생성)
   */
  async publish(eventName, data, correlationId = uuidv4()) {
    // 1. 스키마 검증
    const schema = eventSchemas[eventName];
    if (schema) {
      const { error } = schema.validate(data);
      if (error) {
        logger.error(
          `[EventBus] Schema validation failed for ${eventName}: ${error.message}`,
          { correlationId, data }
        );
        throw new Error(
          `Invalid event data for ${eventName}: ${error.message}`
        );
      }
    } else {
      logger.warn(`[EventBus] No schema defined for event: ${eventName}`);
    }

    // 2. 로깅 (Observability)
    logger.info(`[EventBus] Publishing ${eventName}`, {
      correlationId,
      data,
      timestamp: new Date().toISOString(),
    });

    // 3. 이벤트 발행 (비동기 처리 보장)
    // setImmediate를 사용하여 메인 스택을 차단하지 않음
    setImmediate(() => {
      try {
        this.emit(eventName, { ...data, correlationId });
      } catch (error) {
        logger.error(
          `[EventBus] Error emitting event ${eventName}: ${error.message}`,
          { correlationId }
        );
      }
    });
  }

  /**
   * 이벤트를 구독합니다. (재시도 로직 포함)
   * @param {string} eventName - 이벤트 이름
   * @param {function} handler - 핸들러 함수
   */
  subscribe(eventName, handler) {
    this.on(eventName, async (data) => {
      const { correlationId, ...payload } = data;
      const maxRetries = 3;
      let attempt = 0;

      while (attempt < maxRetries) {
        try {
          logger.info(
            `[EventBus] Handling ${eventName} (Attempt ${attempt + 1})`,
            { correlationId }
          );
          await handler(payload, correlationId);
          return; // 성공 시 종료
        } catch (error) {
          attempt++;
          logger.error(
            `[EventBus] Error handling ${eventName} (Attempt ${attempt}/${maxRetries}): ${error.message}`,
            { correlationId, error }
          );
          if (attempt >= maxRetries) {
            logger.error(
              `[EventBus] Failed to handle ${eventName} after ${maxRetries} attempts. Moving to DLQ (simulated).`,
              { correlationId }
            );
            // TODO: DLQ(Dead Letter Queue)에 저장 로직 추가
          }
          // 간단한 백오프 (100ms, 200ms, 400ms)
          await new Promise((resolve) =>
            setTimeout(resolve, 100 * Math.pow(2, attempt))
          );
        }
      }
    });
  }
}

module.exports = new EventBus();
