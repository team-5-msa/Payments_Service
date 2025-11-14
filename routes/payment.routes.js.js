const express = require("express");
const router = express.Router();
const paymentController = require("../modules/payment/payment.controller");

router.post("/intent", paymentController.createIntent);
router.post("/execute", paymentController.executePayment);

module.exports = router;
