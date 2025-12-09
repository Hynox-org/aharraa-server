const express = require('express');
const router = express.Router();
const Menu = require('../models/Menu'); // Assuming the Menu model exists

// GET all menus
router.get('/', async (req, res) => {
  try {
    const menus = await Menu.find().populate('menuItems.meal').lean();
    res.json(menus);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
