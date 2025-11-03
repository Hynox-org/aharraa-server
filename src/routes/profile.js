const express = require('express');
const router = express.Router();
const User = require('../models/User');
const authMiddleware = require("../middleware/auth");

/**
 * @swagger
 * tags:
 *   name: Profile
 *   description: User profile management
 */

/**
 * @swagger
 * /api/users/profile:
 *   get:
 *     summary: Get user profile
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 email:
 *                   type: string
 *                 supabaseId:
 *                   type: string
 *                 fullName:
 *                   type: string
 *                 phoneNumber:
 *                   type: string
 *                 breakfastDeliveryLocation:
 *                   type: object
 *                   properties:
 *                     street: { type: string }
 *                     state: { type: string }
 *                     pincode: { type: string }
 *                     lat: { type: number }
 *                     lon: { type: number }
 *                 lunchDeliveryLocation:
 *                   type: object
 *                   properties:
 *                     street: { type: string }
 *                     state: { type: string }
 *                     pincode: { type: string }
 *                     lat: { type: number }
 *                     lon: { type: number }
 *                 dinnerDeliveryLocation:
 *                   type: object
 *                   properties:
 *                     street: { type: string }
 *                     state: { type: string }
 *                     pincode: { type: string }
 *                     lat: { type: number }
 *                     lon: { type: number }
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 *       500:
 *         description: Server Error
 */
router.get('/profile', authMiddleware.protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

/**
 * @swagger
 * /api/users/profile:
 *   put:
 *     summary: Update user profile
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName:
 *                 type: string
 *                 description: User's full name (optional)
 *               phoneNumber:
 *                 type: string
 *                 description: User's phone number (optional)
 *               breakfastDeliveryLocation:
 *                 type: object
 *                 description: Breakfast delivery location (optional)
 *                 properties:
 *                   street: { type: string, description: "Street address" }
 *                   state: { type: string, description: "State" }
 *                   pincode: { type: string, description: "Pincode" }
 *                   lat: { type: number, format: float, description: "Latitude" }
 *                   lon: { type: number, format: float, description: "Longitude" }
 *               lunchDeliveryLocation:
 *                 type: object
 *                 description: Lunch delivery location (optional)
 *                 properties:
 *                   street: { type: string, description: "Street address" }
 *                   state: { type: string, description: "State" }
 *                   pincode: { type: string, description: "Pincode" }
 *                   lat: { type: number, format: float, description: "Latitude" }
 *                   lon: { type: number, format: float, description: "Longitude" }
 *               dinnerDeliveryLocation:
 *                 type: object
 *                 description: Dinner delivery location (optional)
 *                 properties:
 *                   street: { type: string, description: "Street address" }
 *                   state: { type: string, description: "State" }
 *                   pincode: { type: string, description: "Pincode" }
 *                   lat: { type: number, format: float, description: "Latitude" }
 *                   lon: { type: number, format: float, description: "Longitude" }
 *     responses:
 *       200:
 *         description: Updated user profile data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 email:
 *                   type: string
 *                 supabaseId:
 *                   type: string
 *                 fullName:
 *                   type: string
 *                 phoneNumber:
 *                   type: string
 *                 breakfastDeliveryLocation:
 *                   type: object
 *                   properties:
 *                     street: { type: string }
 *                     state: { type: string }
 *                     pincode: { type: string }
 *                     lat: { type: number }
 *                     lon: { type: number }
 *                 lunchDeliveryLocation:
 *                   type: object
 *                   properties:
 *                     street: { type: string }
 *                     state: { type: string }
 *                     pincode: { type: string }
 *                     lat: { type: number }
 *                     lon: { type: number }
 *                 dinnerDeliveryLocation:
 *                   type: object
 *                   properties:
 *                     street: { type: string }
 *                     state: { type: string }
 *                     pincode: { type: string }
 *                     lat: { type: number }
 *                     lon: { type: number }
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 *       500:
 *         description: Server Error
 */
router.put('/profile', authMiddleware.protect, async (req, res) => {
  const { fullName, phoneNumber, breakfastDeliveryLocation, lunchDeliveryLocation, dinnerDeliveryLocation } = req.body;

  // Build user object
  const userFields = {};
  if (fullName) userFields.fullName = fullName;
  if (phoneNumber) userFields.phoneNumber = phoneNumber;
  if (breakfastDeliveryLocation) userFields.breakfastDeliveryLocation = breakfastDeliveryLocation;
  if (lunchDeliveryLocation) userFields.lunchDeliveryLocation = lunchDeliveryLocation;
  if (dinnerDeliveryLocation) userFields.dinnerDeliveryLocation = dinnerDeliveryLocation;

  try {
    let user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: userFields },
      { new: true }
    ).select('-password');

    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
