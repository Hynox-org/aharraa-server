const express = require('express');
const Joi = require('joi');
const Cart = require('../models/Cart');
const CartItem = require('../models/CartItem');
const Meal = require('../models/Meal');
const Plan = require('../models/Plan');
const { protect } = require('../middleware/auth');
const moment = require('moment'); // For date calculations

const router = express.Router();

const cartItemAddSchema = Joi.object({
  mealId: Joi.string().required(),
  planId: Joi.string().required(),
  quantity: Joi.number().integer().min(1).required(),
  startDate: Joi.string().isoDate().required(),
  personDetails: Joi.array().items(Joi.object({
    name: Joi.string().required(),
    phoneNumber: Joi.string().required(),
  })).optional(),
});

const cartItemUpdateQuantitySchema = Joi.object({
  quantity: Joi.number().integer().min(1).required(),
});

const cartItemUpdatePersonDetailsSchema = Joi.object({
  personDetails: Joi.array().items(Joi.object({
    name: Joi.string().required(),
    phoneNumber: Joi.string().required(),
  })).required(),
});

// Helper function to calculate cart totals
const calculateCartTotals = async (cart) => {
  let totalItems = 0;
  let cartTotalPrice = 0;

  for (const itemId of cart.items) {
    const item = await CartItem.findById(itemId).populate('meal plan');
    if (item) {
      totalItems += item.quantity;
      cartTotalPrice += item.itemTotalPrice;
    }
  }
  cart.totalItems = totalItems;
  cart.cartTotalPrice = cartTotalPrice;
  cart.lastUpdated = Date.now();
  await cart.save();
  return cart;
};

/**
 * @openapi
 * /api/cart/{userId}:
 *   get:
 *     summary: Retrieve the current cart for a specific user.
 *     tags:
 *       - Cart
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: User ID
 *     responses:
 *       200:
 *         description: The user's cart.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Cart'
 *       404:
 *         description: Cart not found for user
 *       500:
 *         description: Internal server error
 */
router.get('/:userId', protect, async (req, res) => {
  try {
    if (req.user._id.toString() !== req.params.userId) {
      return res.status(403).json({ message: 'Unauthorized access to cart' });
    }

    let cart = await Cart.findOne({ userId: req.params.userId }).populate({
      path: 'items',
      populate: [{ path: 'meal' }, { path: 'plan' }]
    });

    if (!cart) {
      // If no cart exists, return an empty cart
      cart = new Cart({ userId: req.params.userId, items: [], totalItems: 0, cartTotalPrice: 0 });
      await cart.save();
    }

    res.status(200).json(cart);
  } catch (error) {
    console.error('Error fetching cart:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @openapi
 * /api/cart/{userId}/add:
 *   post:
 *     summary: Add a new item to the user's cart or update quantity if item already exists.
 *     tags:
 *       - Cart
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - mealId
 *               - planId
 *               - quantity
 *               - startDate
 *             properties:
 *               mealId:
 *                 type: string
 *               planId:
 *                 type: string
 *               quantity:
 *                 type: number
 *               startDate:
 *                 type: string
 *                 format: date
 *               personDetails:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     phoneNumber:
 *                       type: string
 *     responses:
 *       200:
 *         description: Updated cart object.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Cart'
 *       400:
 *         description: Invalid mealId or planId or validation error
 *       403:
 *         description: Unauthorized access to cart
 *       500:
 *         description: Internal server error
 */
router.post('/:userId/add', protect, async (req, res) => {
  try {
    if (req.user._id.toString() !== req.params.userId) {
      return res.status(403).json({ message: 'Unauthorized access to cart' });
    }

    const { error: validationError } = cartItemAddSchema.validate(req.body);
    if (validationError) {
      return res.status(400).json({ message: validationError.details[0].message });
    }

    const { mealId, planId, quantity, startDate, personDetails } = req.body;

    const meal = await Meal.findById(mealId);
    const plan = await Plan.findById(planId);

    if (!meal || !plan) {
      return res.status(400).json({ message: 'Invalid mealId or planId' });
    }

    let cart = await Cart.findOne({ userId: req.params.userId });
    if (!cart) {
      cart = new Cart({ userId: req.params.userId, items: [] });
    }

    const existingCartItem = await CartItem.findOne({
      userId: req.params.userId,
      meal: mealId,
      plan: planId,
      startDate: new Date(startDate),
    });

    if (existingCartItem) {
      // Update quantity of existing item
      existingCartItem.quantity += quantity;
      existingCartItem.itemTotalPrice = existingCartItem.quantity * meal.price * plan.durationDays;
      if (personDetails) {
        existingCartItem.personDetails = personDetails;
      }
      await existingCartItem.save();
    } else {
      // Add new item
      const endDate = moment(startDate).add(plan.durationDays - 1, 'days').toDate();
      const itemTotalPrice = quantity * meal.price * plan.durationDays;

      const newCartItem = new CartItem({
        userId: req.params.userId,
        meal: mealId,
        plan: planId,
        quantity,
        personDetails: personDetails || [],
        startDate: new Date(startDate),
        endDate,
        itemTotalPrice,
        addedDate: Date.now(),
      });
      await newCartItem.save();
      cart.items.push(newCartItem._id);
    }

    const updatedCart = await calculateCartTotals(cart);
    await updatedCart.populate({
      path: 'items',
      populate: [{ path: 'meal' }, { path: 'plan' }]
    });

    res.status(200).json(updatedCart);
  } catch (error) {
    console.error('Error adding/updating cart item:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @openapi
 * /api/cart/{userId}/update-quantity/{cartItemId}:
 *   put:
 *     summary: Update the quantity of a specific item in the cart.
 *     tags:
 *       - Cart
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: User ID
 *       - in: path
 *         name: cartItemId
 *         schema:
 *           type: string
 *         required: true
 *         description: Cart Item ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - quantity
 *             properties:
 *               quantity:
 *                 type: number
 *                 minimum: 1
 *     responses:
 *       200:
 *         description: Updated cart object.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Cart'
 *       400:
 *         description: Validation error
 *       403:
 *         description: Unauthorized access to cart
 *       404:
 *         description: Cart item not found
 *       500:
 *         description: Internal server error
 */
router.put('/:userId/update-quantity/:cartItemId', protect, async (req, res) => {
  try {
    if (req.user._id.toString() !== req.params.userId) {
      return res.status(403).json({ message: 'Unauthorized access to cart' });
    }

    const { error: validationError } = cartItemUpdateQuantitySchema.validate(req.body);
    if (validationError) {
      return res.status(400).json({ message: validationError.details[0].message });
    }

    const { quantity } = req.body;

    const cartItem = await CartItem.findOne({ _id: req.params.cartItemId, userId: req.params.userId }).populate('meal plan');
    if (!cartItem) {
      return res.status(404).json({ message: 'Cart item not found' });
    }

    cartItem.quantity = quantity;
    cartItem.itemTotalPrice = cartItem.quantity * cartItem.meal.price * cartItem.plan.durationDays;
    await cartItem.save();

    const cart = await Cart.findOne({ userId: req.params.userId });
    const updatedCart = await calculateCartTotals(cart);
    await updatedCart.populate({
      path: 'items',
      populate: [{ path: 'meal' }, { path: 'plan' }]
    });

    res.status(200).json(updatedCart);
  } catch (error) {
    console.error('Error updating cart item quantity:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @openapi
 * /api/cart/{userId}/update-person-details/{cartItemId}:
 *   put:
 *     summary: Update person details for a specific cart item.
 *     tags:
 *       - Cart
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: User ID
 *       - in: path
 *         name: cartItemId
 *         schema:
 *           type: string
 *         required: true
 *         description: Cart Item ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - personDetails
 *             properties:
 *               personDetails:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     phoneNumber:
 *                       type: string
 *     responses:
 *       200:
 *         description: Updated cart object.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Cart'
 *       400:
 *         description: Validation error
 *       403:
 *         description: Unauthorized access to cart
 *       404:
 *         description: Cart item not found
 *       500:
 *         description: Internal server error
 */
router.put('/:userId/update-person-details/:cartItemId', protect, async (req, res) => {
  try {
    if (req.user._id.toString() !== req.params.userId) {
      return res.status(403).json({ message: 'Unauthorized access to cart' });
    }

    const { error: validationError } = cartItemUpdatePersonDetailsSchema.validate(req.body);
    if (validationError) {
      return res.status(400).json({ message: validationError.details[0].message });
    }

    const { personDetails } = req.body;

    const cartItem = await CartItem.findOne({ _id: req.params.cartItemId, userId: req.params.userId });
    if (!cartItem) {
      return res.status(404).json({ message: 'Cart item not found' });
    }

    cartItem.personDetails = personDetails;
    await cartItem.save();

    const cart = await Cart.findOne({ userId: req.params.userId });
    const updatedCart = await calculateCartTotals(cart);
    await updatedCart.populate({
      path: 'items',
      populate: [{ path: 'meal' }, { path: 'plan' }]
    });

    res.status(200).json(updatedCart);
  } catch (error) {
    console.error('Error updating cart item person details:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @openapi
 * /api/cart/{userId}/remove/{cartItemId}:
 *   delete:
 *     summary: Remove a specific item from the cart.
 *     tags:
 *       - Cart
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: User ID
 *       - in: path
 *         name: cartItemId
 *         schema:
 *           type: string
 *         required: true
 *         description: Cart Item ID
 *     responses:
 *       200:
 *         description: Updated cart object.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Cart'
 *       403:
 *         description: Unauthorized access to cart
 *       404:
 *         description: Cart item not found
 *       500:
 *         description: Internal server error
 */
router.delete('/:userId/remove/:cartItemId', protect, async (req, res) => {
  try {
    if (req.user._id.toString() !== req.params.userId) {
      return res.status(403).json({ message: 'Unauthorized access to cart' });
    }

    const cartItem = await CartItem.findOneAndDelete({ _id: req.params.cartItemId, userId: req.params.userId });
    if (!cartItem) {
      return res.status(404).json({ message: 'Cart item not found' });
    }

    const cart = await Cart.findOne({ userId: req.params.userId });
    if (cart) {
      cart.items = cart.items.filter(item => item.toString() !== req.params.cartItemId);
      const updatedCart = await calculateCartTotals(cart);
      await updatedCart.populate({
        path: 'items',
        populate: [{ path: 'meal' }, { path: 'plan' }]
      });
      return res.status(200).json(updatedCart);
    }

    res.status(200).json({ message: 'Cart item removed, but cart not found (should not happen)' });
  } catch (error) {
    console.error('Error removing cart item:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @openapi
 * /api/cart/{userId}/clear:
 *   delete:
 *     summary: Clear all items from the user's cart.
 *     tags:
 *       - Cart
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: User ID
 *     responses:
 *       200:
 *         description: Empty cart object for the user.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Cart'
 *       403:
 *         description: Unauthorized access to cart
 *       500:
 *         description: Internal server error
 */
router.delete('/:userId/clear', protect, async (req, res) => {
  try {
    if (req.user._id.toString() !== req.params.userId) {
      return res.status(403).json({ message: 'Unauthorized access to cart' });
    }

    const cart = await Cart.findOne({ userId: req.params.userId });
    if (cart) {
      // Delete all associated CartItems
      await CartItem.deleteMany({ _id: { $in: cart.items } });
      cart.items = [];
      const updatedCart = await calculateCartTotals(cart);
      await updatedCart.populate({
        path: 'items',
        populate: [{ path: 'meal' }, { path: 'plan' }]
      });
      return res.status(200).json(updatedCart);
    }

    // If no cart exists, return an empty cart representation
    res.status(200).json({
      id: null, // Or a new ID if you want to create an empty cart
      userId: req.params.userId,
      items: [],
      totalItems: 0,
      cartTotalPrice: 0,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error clearing cart:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
