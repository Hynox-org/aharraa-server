const express = require('express');
const router = express.Router();
const Joi = require('joi');
const authMiddleware = require('../middleware/auth');
const DeliveryAddress = require('../models/DeliveryAddress');
const User = require('../models/User');

// Joi schema for delivery address creation and update
const deliveryAddressSchema = Joi.object({
    street: Joi.string().required(),
    city: Joi.string().required(),
    state: Joi.string().required(),
    zipCode: Joi.string().required(),
    country: Joi.string().required(),
    phoneNumber: Joi.string().optional().allow(''),
    notes: Joi.string().optional().allow(''),
});

// POST /api/users/:userId/addresses - Add a new delivery address for a user
router.post('/:userId/addresses', authMiddleware.protect, async (req, res) => {
    try {
        const { userId } = req.params;
        const { error } = deliveryAddressSchema.validate(req.body);
        if (error) return res.status(400).json({ message: error.details[0].message });

        // Optional: Add authorization check to ensure the requesting user is the owner of the address
        if (req.user.id !== userId) {
            return res.status(403).json({ message: 'Access denied. You can only add addresses for your own account.' });
        }

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const newAddress = new DeliveryAddress({
            user: userId,
            ...req.body,
        });

        await newAddress.save();
        res.status(201).json(newAddress);
    } catch (error) {
        console.error('Error adding delivery address:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/users/:userId/addresses - Get all delivery addresses for a user
router.get('/:userId/addresses', authMiddleware.protect, async (req, res) => {
    try {
        const { userId } = req.params;

        // Optional: Add authorization check to ensure the requesting user is the owner of the addresses
        if (req.user.id !== userId) {
            return res.status(403).json({ message: 'Access denied. You can only view your own addresses.' });
        }

        const addresses = await DeliveryAddress.find({ user: userId });
        res.status(200).json(addresses);
    } catch (error) {
        console.error('Error fetching delivery addresses:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// PUT /api/users/:userId/addresses/:addressId - Update a delivery address for a user
router.put('/:userId/addresses/:addressId', authMiddleware.protect, async (req, res) => {
    try {
        const { userId, addressId } = req.params;
        const { error } = deliveryAddressSchema.validate(req.body);
        if (error) return res.status(400).json({ message: error.details[0].message });

        // Optional: Add authorization check
        if (req.user.id !== userId) {
            return res.status(403).json({ message: 'Access denied. You can only update your own addresses.' });
        }

        const updatedAddress = await DeliveryAddress.findOneAndUpdate(
            { _id: addressId, user: userId },
            { $set: req.body },
            { new: true, runValidators: true }
        );

        if (!updatedAddress) {
            return res.status(404).json({ message: 'Delivery address not found or does not belong to the user' });
        }

        res.status(200).json(updatedAddress);
    } catch (error) {
        console.error('Error updating delivery address:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// DELETE /api/users/:userId/addresses/:addressId - Delete a delivery address for a user
router.delete('/:userId/addresses/:addressId', authMiddleware.protect, async (req, res) => {
    try {
        const { userId, addressId } = req.params;

        // Optional: Add authorization check
        if (req.user.id !== userId) {
            return res.status(403).json({ message: 'Access denied. You can only delete your own addresses.' });
        }

        const deletedAddress = await DeliveryAddress.findOneAndDelete({ _id: addressId, user: userId });

        if (!deletedAddress) {
            return res.status(404).json({ message: 'Delivery address not found or does not belong to the user' });
        }

        res.status(200).json({ message: 'Delivery address deleted successfully' });
    } catch (error) {
        console.error('Error deleting delivery address:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
