const express = require("express");
const router = express.Router();
const virtualGameController = require("../src/controllers/virtualGame.controller");

router.post("/virtual-game/bet", virtualGameController.placeBet);

router.get(
  "/virtual-game/bets/:userId/status/:status",
  virtualGameController.listBetsByUserAndStatus
);
router.get(
  "/virtual-game/bets/:userId",
  virtualGameController.listBetsByUser
);

router.get("/virtual-game/bet/:ticketId", virtualGameController.getBetByTicketId);
router.put("/virtual-game/bet/:ticketId", virtualGameController.updateBet);
router.delete("/virtual-game/bet/:ticketId", virtualGameController.deleteBet);

module.exports = router;
