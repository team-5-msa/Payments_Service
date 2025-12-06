const generateCustomId = (bookingId, userId) => {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:T.Z]/g, ""); // YYYYMMDDHHMMSSsss
  return `${bookingId}-${userId}-${timestamp}`;
};

const generateEventId = (bookingId, eventType) => {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:T.Z]/g, "");
  return `EVENT-${bookingId}-${eventType}-${timestamp}`;
};

const generateLedgerId = (bookingId, type) => {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:T.Z]/g, "");
  return `LEDGER-${bookingId}-${type}-${timestamp}`;
};

module.exports = { generateCustomId, generateEventId, generateLedgerId };
