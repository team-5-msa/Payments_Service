const Joi = require("joi");

const eventSchemas = {
  BOOKING_CREATED: Joi.object({
    bookingId: Joi.string().required(),
    userId: Joi.string().required(),
    totalAmount: Joi.number().positive().required(),
    paymentMethod: Joi.string().required(),
    performanceId: Joi.string().required(),
  }),
  BOOKING_CANCELLED: Joi.object({
    bookingId: Joi.string().required(),
  }),
  REFUND_REQUESTED: Joi.object({
    bookingId: Joi.string().required(),
    userId: Joi.string().required(),
    token: Joi.string().required(),
  }),
  PAYMENT_COMPLETED: Joi.object({
    bookingId: Joi.string().required(),
    token: Joi.string().required(),
  }),
  PAYMENT_FAILED: Joi.object({
    bookingId: Joi.string().required(),
    token: Joi.string().required(),
  }),
  REFUND_COMPLETED: Joi.object({
    bookingId: Joi.string().required(),
    token: Joi.string().required(),
  }),
};

module.exports = eventSchemas;
