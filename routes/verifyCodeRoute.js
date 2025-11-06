const express = require("express");
const router = express.Router();
const VerifyModel = require('../models/verifycode')
const bet =require("../models/bet")

// Generate verify code: GH + 15 characters (mix of uppercase letters and numbers)
// Total length: 17 characters, with 4-7 numbers in the entire code
const generateVerifyCode = () => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    
    // Random number between 4 and 7 for how many numbers we need
    const numCount = Math.floor(Math.random() * 4) + 4; // 4, 5, 6, or 7
    
    // Start with "GH"
    let code = 'GH';
    
    // Create array of 15 positions
    const positions = Array(15).fill(null);
    
    // Randomly place numbers (4-7 numbers)
    const numberPositions = [];
    while (numberPositions.length < numCount) {
        const pos = Math.floor(Math.random() * 15);
        if (!numberPositions.includes(pos)) {
            numberPositions.push(pos);
        }
    }
    
    // Fill positions with numbers or letters
    for (let i = 0; i < 15; i++) {
        if (numberPositions.includes(i)) {
            code += numbers.charAt(Math.floor(Math.random() * numbers.length));
        } else {
            code += letters.charAt(Math.floor(Math.random() * letters.length));
        }
    }
    
    return code;
};

router.get("/verify-code/:betId", async (req, res) => {
    try {
        const { betId } = req.params;
        let verifyData = await VerifyModel.findOne({ betId });

        if (verifyData) {
            res.json(verifyData);
        } else {
            // Auto-generate and save verify code
            let generatedCode;
            let isUnique = false;
            let attempts = 0;
            const maxAttempts = 10;
            
            // Generate unique code
            while (!isUnique && attempts < maxAttempts) {
                generatedCode = generateVerifyCode();
                const existingCode = await VerifyModel.findOne({ verifyCode: generatedCode });
                if (!existingCode) {
                    isUnique = true;
                }
                attempts++;
            }
            
            if (!isUnique) {
                return res.status(500).json({ error: "Failed to generate unique verify code" });
            }
            
            // Save the generated code
            const newVerify = new VerifyModel({ betId, verifyCode: generatedCode });
            await newVerify.save();
            
            res.json(newVerify);
        }
    } catch (error) {
        console.error("Error in verify-code route:", error);
        res.status(500).json({ error: "Server error" });
    }
});

// ✅ Check if verifyCode exists: Update or Insert
router.put("/verify-code/:betId", async (req, res) => {
    try {
        const { betId } = req.params;
        const { verifyCode } = req.body;

        // Check if the verifyCode already exists
        const existingVerify = await VerifyModel.findOne({ verifyCode });

        if (existingVerify) {
            // Update existing verifyCode entry
            existingVerify.betId = betId;  // Update betId if needed
            await existingVerify.save();
            return res.json({ message: "Verify Code updated successfully", existingVerify });
        }

        // If verifyCode does not exist, create a new one
        const newVerify = new VerifyModel({ betId, verifyCode });
        await newVerify.save();
        res.json({ message: "New Verify Code added", newVerify });

    } catch (error) {
        res.status(500).json({ error: "Error updating code" });
    }
});

// Delete verify code to allow regeneration
router.delete("/verify-code/:betId", async (req, res) => {
    try {
        const { betId } = req.params;
        const deleted = await VerifyModel.deleteOne({ betId });
        
        if (deleted.deletedCount > 0) {
            res.json({ message: "Verify code deleted successfully" });
        } else {
            res.json({ message: "No verify code found to delete" });
        }
    } catch (error) {
        console.error("Error deleting verify code:", error);
        res.status(500).json({ error: "Server error" });
    }
});

router.get("/betverify-code/:verifyCode", async (req, res) => {
  try {
    const { verifyCode } = req.params;

    // Step 1: Find the record with the given verify code
    const verifyRecord = await VerifyModel.findOne({ verifyCode });
    console.log(verifyRecord);

    if (!verifyRecord) {
      return res.status(404).json({ message: "Verify code not found." });
    }

    // Step 2: Check if the verify code is within 24 hours
    const now = new Date();
    const expiryTime = new Date(verifyRecord.createdAt);
    expiryTime.setHours(expiryTime.getHours() + 24); // add 24 hours

    if (now > expiryTime) {
      return res.status(400).json({ message: "Verify code expired." });
    }

    // Step 3: Use the betId from that record to find the match
    const match = await bet.findOne({ _id: verifyRecord.betId });

    if (!match) {
      return res
        .status(404)
        .json({ message: "Match not found for given verify code." });
    }

    res.status(200).json({ match });
  } catch (err) {
    console.error("Error fetching match:", err);
    res.status(500).json({ message: "Server error" });
  }
});


module.exports = router
