const express = require('express');
const Meal = require('../models/Meal');

const router = express.Router();

/**
 * @openapi
 * /api/meals:
 *   get:
 *     summary: Retrieve a list of all meals, with optional filtering by vendor, category, or diet preference.
 *     tags:
 *       - Meals
 *     parameters:
 *       - in: query
 *         name: vendorId
 *         schema:
 *           type: string
 *         description: Filter meals by a specific vendor ID.
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [Breakfast, Lunch, Dinner]
 *         description: Filter meals by category.
 *       - in: query
 *         name: dietPreference
 *         schema:
 *           type: string
 *           enum: [All, Veg, Non-Veg, Vegan, Custom]
 *         description: Filter meals by diet preference.
 *     responses:
 *       200:
 *         description: A list of meals.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Meal'
 *       500:
 *         description: Internal server error
 */
router.get('/', async (req, res) => {
  try {
    const { vendorId, category, dietPreference } = req.query;
    const filter = {};

    if (vendorId) {
      filter.vendorId = vendorId;
    }
    if (category) {
      filter.category = category;
    }
    if (dietPreference && dietPreference != "All") {
      filter.dietPreference = dietPreference;
    }

    const meals = await Meal.find(filter).populate('vendorId'); // Populate vendor details if needed
    res.status(200).json(meals);
  } catch (error) {
    console.error('Error fetching meals:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @openapi
 * /api/meals/{id}:
 *   get:
 *     summary: Retrieve details for a specific meal.
 *     tags:
 *       - Meals
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Meal ID
 *     responses:
 *       200:
 *         description: Details of a specific meal.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Meal'
 *       404:
 *         description: Meal not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       500:
 *         description: Internal server error
 */
router.get('/:id', async (req, res) => {
  try {
    const meal = await Meal.findById(req.params.id).populate('vendorId');
    if (!meal) {
      return res.status(404).json({ message: 'Meal not found' });
    }
    res.status(200).json(meal);
  } catch (error) {
    console.error('Error fetching meal:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
