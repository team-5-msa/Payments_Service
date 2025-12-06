const Joi = require("joi");

const eventSchemas = {
  PAYMENT_COMPLETED: Joi.object({
    bookingId: Joi.string().required(),
    userId: Joi.string().required(),
    token: Joi.string().required(),
  }),
  PAYMENT_FAILED: Joi.object({
    bookingId: Joi.string().required(),
    userId: Joi.string().required(),
    token: Joi.string().required(),
  }),
  REFUND_COMPLETED: Joi.object({
    bookingId: Joi.string().required(),
    token: Joi.string().required(),
  }),
};

module.exports = eventSchemas;
