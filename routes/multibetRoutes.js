const express = require("express");
const router = express.Router();
const Bet = require("../models/multibets");
const oddModel = require("../models/bet")
const cashout = require("../models/cashOut")
const VerifyCode = require("../models/verifycode");


router.post("/multibets", async (req, res) => {
    try {
        console.log("📩 Received request body:", req.body); // ✅ Debugging Log

        const { userId, text, userId1,type } = req.body;

        // ✅ Validate userId
        if (!userId) {
            return res.status(400).json({ message: "User ID is required" });
        }

        // ✅ Validate bet data
        if (!Array.isArray(text) || text.length === 0) {
            console.error("❌ No valid bets found in request.");
            return res.status(400).json({ message: "No valid bets found." });
        }

        const cashData = {
            betId: userId,
            amount: 0,
            cashoutStatus: "cashout"
        }

        await cashout.create(cashData)

        // ✅ Prepare bet objects for insertion
        const betsToInsert = text.map(bet => ({
            userId,
            gameId: bet?.gameId || null,
            dateTime: bet?.date || new Date(), // Default to now if missing
            teams: bet?.teams || "N/A",
            ftScore: bet?.ftScore || "N/A",
            pick: bet?.pick || "N/A",
            market: bet?.market || "N/A",
            outcome: bet?.outcome || "N/A",
            odd: bet?.odd || 1.0, // Default to 1.0 if missing
            createdAt: new Date(), // ✅ Store timestamp
            type:type,
            userId1: userId1 || null,
            chatNumber: Math.floor(Math.random() * 100) + 1,
            league: bet?.league || null, // Optional league field
            country: bet?.country || null // Optional country field
        }));

        // ✅ Insert bets into MongoDB
        const savedBets = await Bet.insertMany(betsToInsert);

        console.log("✅ Bets successfully stored:", savedBets.length, "bets inserted");

        // ✅ Send success response
        return res.json({
            message: "Bets stored successfully",
            bets: savedBets
        });

    } catch (error) {
        console.error("❌ Error processing bets:", error);
        return res.status(500).json({
            message: "Internal server error",
            error: error.message
        });
    }
});


router.post("/add-match", async (req, res) => {
    try {
      const {userId, gameId, dateTime, teams, userId1, league, country } = req.body;
  
      // Validation: Check if all fields are present
      if (!gameId || !dateTime || !teams) {
        return res.status(400).json({ message: "All fields are required" });
      }

     
      const cashData = {
        betId: userId,
        amount: 0,
        cashoutStatus: "cashout"
    };
    
    // Check if a record already exists
    const cashExistData = await cashout.findOne({ betId: userId });
    
    if (cashExistData) {
        // Update existing record
        await cashout.updateOne(
            { betId: userId },  // Filter
            { $set: cashData }  // Update values
        );
    } else {
        // Insert new record
        await cashout.create(cashData);
    }
  
      // Save to MongoDB
      const newMatch = new Bet({
        userId, 
        gameId, 
        dateTime, 
        teams, 
        userId1, 
        chatNumber: Math.floor(Math.random() * 100) + 1,
        league: league || null, // Optional league field
        country: country || null // Optional country field
      });
      await newMatch.save();
  
      res.status(201).json({ message: "Match added successfully", match: newMatch });
    } catch (error) {
      console.error("❌ Error adding match:", error);
      res.status(500).json({ message: "Internal server error", error: error.message });
    }
  });

router.post("/add-match1", async (req, res) => {
  try {
    const {
      userId, // References Bet document _id
      gameId,
      dateTime,
      teams,
      ftScore = "",
      pick,
      market,
      outcome,
      status,
      odd = "0.1",
      chatNumber = "0",
      type = "Football",
      userId1, // References User document _id
      liveOdd,
      league,
      country,
    } = req.body;

    // Validation: Check required fields
    if (!userId || !gameId || !dateTime || !teams || !pick || !market || !outcome || !status || !userId1) {
      return res.status(400).json({ message: "All required fields must be provided" });
    }

    // Validate userId (Bet document reference)
    const betExists = await oddModel.findById(userId);
    if (!betExists) {
      return res.status(400).json({ message: "Invalid Bet ID" });
    }

    // Validate type
    const validTypes = ["Football", "eFootball", "vFootball"];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ message: "Invalid type value" });
    }

    // Save match to multbet collection
    const newMatch = new Bet({
      userId,
      gameId,
      dateTime,
      teams,
      ftScore,
      pick,
      market,
      outcome,
      status,
      odd,
      chatNumber,
      type,
      userId1,
      liveOdd,
      league: league || null,
      country: country || null,
    });
    await newMatch.save();

    // Cashout logic
    const cashData = {
      betId: userId,
      amount: 0,
      cashoutStatus: "cashout",
    };

    const cashExistData = await cashout.findOne({ betId: userId });
    if (cashExistData) {
      await cashout.updateOne({ betId: userId }, { $set: cashData });
    } else {
      await cashout.create(cashData);
    }

    res.status(201).json({ message: "Match added successfully", match: newMatch });
  } catch (error) {
    console.error("❌ Error adding match:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
});


// **API to Fetch Stored Bets**
router.get("/multibets/:userId", async (req, res) => {
    try {
      const { userId } = req.params; // Get userId from request params
      const bets = await Bet.find({ userId }); // Find bets for the specific user
  
      if (!bets.length) {
        return res.status(404).json({ message: "No bets found for this user." });
      }
  
      res.json(bets);
    } catch (error) {
      console.error("Error fetching bets:", error); 
      res.status(500).json({ message: "Server error" });
    }
  });

  router.get("/multibet/:userId1", async (req, res) => {
    try {
      const { userId1 } = req.params; // Get userId from request params
      const bets = await Bet.find({ userId1: userId1 }); // Find bets for the specific user
  
      if (!bets.length) {
        return res.status(404).json({ message: "No bets found for this user." });
      }
  
      res.json(bets);
    } catch (error) {
      console.error("Error fetching bets:", error); 
      res.status(500).json({ message: "Server error" });
    }
  });

  router.put("/multibets/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { market, pick, ftScore, outcome, status, odd, userId, chatNumber } = req.body;

        if (!id || !userId) {
            return res.status(400).json({ message: "Bet ID and User ID are required." });
        }

        const updatedBet = await Bet.findByIdAndUpdate(
            id,
            { market, pick, ftScore, outcome, status, odd,chatNumber }, // ✅ No changes to odd in Bet
            { new: true, runValidators: true }
        );

        if (!updatedBet) {
            return res.status(404).json({ message: "Bet not found." });
        }

        // ✅ Update bet time when match status changes
    
            // const formatDate = (date) => {
            //     const day = date.getDate().toString().padStart(2, "0");
            //     const month = (date.getMonth() + 1).toString().padStart(2, "0");
            //     const year = date.getFullYear();
                
            //     // Always use current time from device
            //     const now = new Date();
            //     const hours = now.getHours().toString().padStart(2, "0");
            //     const minutes = now.getMinutes().toString().padStart(2, "0");
                
            //     return `${day}/${month}, ${hours}:${minutes}`;
            // };

            // const currentTime = formatDate(new Date());
            
            // Update the main bet's date to current time
            await oddModel.findByIdAndUpdate(
                updatedBet.userId, // This is the bet ID from the multibet
                { new: true }
            );


        res.json(updatedBet); // ✅ Added this to return the updated bet
    } catch (error) {
        console.error("Error updating bet:", error);
        res.status(500).json({ message: "Error updating bet", error: error.message });
    }
});




router.put("/multibets/update/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { teams, gameId, dateTime, league, country } = req.body;

        // Prepare update object with only provided fields
        const updateData = {};
        if (teams !== undefined) updateData.teams = teams;
        if (gameId !== undefined) updateData.gameId = gameId;
        if (dateTime !== undefined) updateData.dateTime = dateTime;
        if (league !== undefined) updateData.league = league;
        if (country !== undefined) updateData.country = country;

        // Find and update the bet entry
        const updatedBet = await Bet.findByIdAndUpdate(
            id,
            updateData,
            { new: true } // Returns the updated document
        );

        if (!updatedBet) {
            return res.status(404).json({ message: "Bet not found" });
        }

        res.status(200).json({ message: "Bet updated successfully", updatedBet });
    } catch (error) {
        console.error("Error updating bet:", error);
        res.status(500).json({ message: "Error updating bet", error });
    }
});

router.put("/multibets/chat/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { chatNumber } = req.body;

        // Find and update the bet entry
        const updatedBet = await Bet.findByIdAndUpdate(
            id,
            { chatNumber },
            { new: true } // Returns the updated document
        );

        if (!updatedBet) {
            return res.status(404).json({ message: "Bet not found" });
        }

        res.status(200).json({ message: "Bet updated successfully", updatedBet });
    } catch (error) {
        console.error("Error updating bet:", error);
        res.status(500).json({ message: "Error updating bet", error });
    }
});

router.put("/multibets/liveodd/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { liveOdd } = req.body;

        // Quick validation
        const oddValue = parseFloat(liveOdd);
        if (isNaN(oddValue) || oddValue <= 0) {
            return res.status(400).json({ message: "Invalid liveOdd value" });
        }

        // Optimized: Use updateOne with lean and minimal options for fastest response
        // Skip validation and hooks for speed (liveOdd is a simple number field)
        const updateResult = await Bet.updateOne(
            { _id: id },
            { $set: { liveOdd: oddValue } },
            { 
                runValidators: false, // Skip validation for speed
                upsert: false // Don't create if not found
            }
        );

        if (updateResult.matchedCount === 0) {
            return res.status(404).json({ message: "Bet not found" });
        }

        // Return minimal response immediately
        res.status(200).json({ 
            success: true,
            liveOdd: oddValue
        });
    } catch (error) {
        console.error("Error updating bet:", error);
        res.status(500).json({ message: "Error updating bet", error: error.message });
    }
});




  
module.exports = router;
