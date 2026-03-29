const express = require("express");
const router = express.Router();
const betController = require("../src/controllers/bet.controller");

router.get("/bets", betController.listAllBets);

router.get("/bets/booking/:bookingCode", betController.getByBookingCode);
router.get("/bets/:userId", betController.listBetsByUser);

router.post("/bets", betController.createBet);
router.post("/bets1", betController.createBet1);

router.put("/bets/:betId", betController.updateBetOdd);
router.put("/ticketId/:betId", betController.updateTicketFields);
router.put("/bookingcode/:betId", betController.updateBookingCode);

router.delete("/bets/:betId", betController.deleteBet);
router.delete("/aLLbets/:userId", betController.deleteAllBetsForUser);

module.exports = router;
