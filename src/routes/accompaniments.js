const express = require('express');
const Accompaniment = require('../models/Accompaniment');

const router = express.Router();

/**
 * @openapi
 * /api/accompaniments:
 *   get:
 *     summary: Retrieve a list of all available accompaniments.
 *     tags:
 *       - Accompaniments
 *     responses:
 *       200:
 *         description: A list of accompaniments.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Accompaniment'
 *       500:
 *         description: Internal server error
 */
router.get('/', async (req, res) => {
  try {
    const accompaniments = await Accompaniment.find();
    res.status(200).json(accompaniments);
  } catch (error) {
    console.error('Error fetching accompaniments:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
