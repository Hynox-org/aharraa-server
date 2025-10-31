const express = require('express');
const Plan = require('../models/Plan');

const router = express.Router();

/**
 * @openapi
 * /api/plans:
 *   get:
 *     summary: Retrieve a list of all available meal plans.
 *     tags:
 *       - Plans
 *     responses:
 *       200:
 *         description: A list of meal plans.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Plan'
 *       500:
 *         description: Internal server error
 */
router.get('/', async (req, res) => {
  try {
    const plans = await Plan.find();
    res.status(200).json(plans);
  } catch (error) {
    console.error('Error fetching plans:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
