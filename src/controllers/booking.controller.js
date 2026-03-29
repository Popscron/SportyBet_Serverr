const bookingService = require("../services/booking.service");
const { sendResult } = require("../http/sendResult");

exports.place = async (req, res) => {
  const result = await bookingService.place(req.body);
  sendResult(res, result);
};

exports.placeFromCollapsed = async (req, res) => {
  const result = await bookingService.placeFromCollapsed(req.body);
  sendResult(res, result);
};
