const express = require('express');
const router = express.Router();
const Joi = require('joi');
const mongoose = require('mongoose'); // Import mongoose to use ObjectId validation
const authMiddleware = require('../middleware/auth');
const Order = require('../models/Order');
const Meal = require('../models/Meal');
const Plan = require('../models/Plan');
const Vendor = require('../models/Vendor');
const { createCashfreeOrder } = require('../utils/cashfree');

// Joi schema for address
const addressSchema = Joi.object({
    street: Joi.string().required(),
    city: Joi.string().required(),
    zip: Joi.string().required(),
});

// Joi schema for order item
const orderItemSchema = Joi.object({
    productId: Joi.string().required(), // Allow any string at Joi level, validation for ObjectId will be done in the route handler
    quantity: Joi.number().integer().min(1).required(),
    price: Joi.number().min(0).required(),
});

// Joi schema for order creation
const orderSchema = Joi.object({
    userId: Joi.string().required(),
    items: Joi.array().items(orderItemSchema).min(1).required(),
    shippingAddress: addressSchema.required(),
    billingAddress: addressSchema.required(),
    paymentMethod: Joi.string().valid('COD', 'CC', 'UPI').required(),
    totalAmount: Joi.number().min(0).required(),
    currency: Joi.string().required(),
    deliveryAddresses: Joi.object().pattern(Joi.string(), addressSchema).min(1).required(),
});

// POST /api/orders - Create a new order
router.post('/', authMiddleware.protect, async (req, res) => {
    try {
        const { userId, items, shippingAddress, billingAddress, paymentMethod, totalAmount, currency, deliveryAddresses } = req.body;

        const { error } = orderSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: "Bad Request", details: `Validation failed: ${error.details[0].message}` });
        }

        // Populate item details (mealName, planName, vendorName)
        const populatedItems = await Promise.all(items.map(async (item) => {
            // Explicitly validate productId as ObjectId before querying
            if (!mongoose.Types.ObjectId.isValid(item.productId)) {
                throw new Error(`Invalid product ID format: ${item.productId}`);
            }
            const meal = await Meal.findById(item.productId);
            if (!meal) {
                throw new Error(`Product with ID ${item.productId} not found.`);
            }

            const plan = await Plan.findById(meal.plan);
            const vendor = await Vendor.findById(meal.vendor);

            return {
                productId: item.productId,
                quantity: item.quantity,
                price: item.price,
                mealName: meal.name,
                planName: plan ? plan.name : undefined,
                vendorName: vendor ? vendor.name : undefined,
            };
        }));

        const order = new Order({
            userId,
            items: populatedItems,
            shippingAddress,
            billingAddress,
            paymentMethod,
            totalAmount,
            currency,
            orderDate: new Date(),
            status: 'pending',
            deliveryAddresses,
        });

        await order.save();

        res.status(201).json(order);
    } catch (error) {
        console.error('Error creating order:', error);
        if (error.message.includes("Product with ID") || error.message.includes("Invalid product ID format")) {
            return res.status(400).json({ error: "Bad Request", details: error.message });
        }
        res.status(500).json({ error: 'Internal Server Error', details: 'Database error during order creation' });
    }
});

router.post('/payment', authMiddleware.protect, async (req, res) => {
    try {
        const { userId, items, shippingAddress, billingAddress, paymentMethod, totalAmount, currency, deliveryAddresses } = req.body;

        const { error } = orderSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: "Bad Request", details: `Validation failed: ${error.details[0].message}` });
        }

        // If payment method is not COD, create Cashfree order
        if (paymentMethod !== 'COD') {
            const customerDetails = {
                customer_id: userId, // Using userId as customer_id
                customer_phone: req.user.phone || '9898989898', // Assuming user phone is available in req.user
                customer_email: req.user.email || 'test@example.com', // Assuming user email is available in req.user
                customer_name: req.user.name || 'Test User' // Assuming user name is available in req.user
            };

            try {
                const cashfreeOrder = await createCashfreeOrder(
                    `${userId}-${Math.random(1000)}`, // Use MongoDB order ID as Cashfree order_id
                    totalAmount,
                    customerDetails
                );
                return res.status(201).json({ paymentSessionId: cashfreeOrder.payment_session_id });
            } catch (cashfreeError) {
                console.error('Error creating Cashfree order:', cashfreeError);
                // If Cashfree order creation fails, you might want to revert the MongoDB order or mark it as failed
                order.status = 'failed';
                await order.save();
                return res.status(500).json({ error: 'Payment Gateway Error', details: cashfreeError.message });
            }
        }

        return res.status(201).json({ paymentSessionId: cashfreeOrder.payment_session_id });
    } catch (error) {
        console.error('Error creating order:', error);
        if (error.message.includes("Product with ID") || error.message.includes("Invalid product ID format")) {
            return res.status(400).json({ error: "Bad Request", details: error.message });
        }
        res.status(500).json({ error: 'Internal Server Error', details: 'Database error during order creation' });
    }
});

// GET /api/orders/:userId - Get all orders for a specific user
router.get('/:userId', authMiddleware.protect, async (req, res) => {
    try {
        const { userId } = req.params;

        // Optional: Add authorization check to ensure the requesting user is the owner of the orders
        if (!req.user || req.user.id !== userId) {
            return res.status(403).json({ message: 'Access denied. You can only view your own orders.' });
        }

        const orders = await Order.find({ userId: userId })
            .populate('items.productId')
            .sort({ orderDate: -1 });

        res.status(200).json(orders);
    } catch (error) {
        console.error('Error fetching user orders:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/orders/details/:orderId - Get details of a specific order
router.get('/details/:orderId', authMiddleware.protect, async (req, res) => {
    try {
        const { orderId } = req.params;
        // Validate orderId format before querying
        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(404).json({ message: 'Order not found or invalid ID format' });
        }

        const order = await Order.findById(orderId)
            .populate('items.productId'); // Changed from items.meal to items.productId

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Optional: Add authorization check to ensure the requesting user is the owner of the order
        // Ensure order.userId exists and is a valid ID before comparison
        const orderUserId = order.userId ? order.userId.toString() : null;

        if (!req.user || !orderUserId || req.user.id !== orderUserId) {
            return res.status(403).json({ message: 'Access denied. You can only view your own order details.' });
        }

        res.status(200).json(order);
    } catch (error) {
        console.error('Error fetching order details:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
