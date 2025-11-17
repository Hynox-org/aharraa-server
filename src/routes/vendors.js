const express = require('express');
const Vendor = require('../models/Vendor');
const Menu = require('../models/Menu'); // Import the Menu model

const router = express.Router();

/**
 * @openapi
 * /api/vendors:
 *   get:
 *     summary: Retrieve a list of all available vendors.
 *     tags:
 *       - Vendors
 *     responses:
 *       200:
 *         description: A list of vendors.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Vendor'
 *       500:
 *         description: Internal server error
 */
router.get('/', async (req, res) => {
  try {
    const vendors = await Vendor.find();
    res.status(200).json(vendors);
  } catch (error) {
    console.error('Error fetching vendors:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @openapi
 * /api/vendors/{id}:
 *   get:
 *     summary: Retrieve details for a specific vendor.
 *     tags:
 *       - Vendors
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Vendor ID
 *     responses:
 *       200:
 *         description: Details of a specific vendor.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Vendor'
 *       404:
 *         description: Vendor not found
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
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }
    res.status(200).json(vendor);
  } catch (error) {
    console.error('Error fetching vendor:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @openapi
 * /api/vendors/{vendorId}/menus:
 *   get:
 *     summary: Retrieve a list of menus for a specific vendor.
 *     tags:
 *       - Vendors
 *     parameters:
 *       - in: path
 *         name: vendorId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID of the vendor to retrieve menus for
 *     responses:
 *       200:
 *         description: A list of menus for the specified vendor.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Menu'
 *       404:
 *         description: Vendor not found
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
router.get('/:vendorId/menus', async (req, res) => {
  try {
    const { vendorId } = req.params;

    // Check if the vendor exists
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    const menus = await Menu.find({ vendor: vendorId }).populate('menuItems.meal');
    res.status(200).json(menus);
  } catch (error) {
    console.error('Error fetching menus for vendor:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
