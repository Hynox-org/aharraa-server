const express = require('express');
const Vendor = require('../models/Vendor');
const Meal = require('../models/Meal');
const Plan = require('../models/Plan');
const Accompaniment = require('../models/Accompaniment');
const { protect } = require('../middleware/auth'); // Assuming admin access is protected

const router = express.Router();

// Dummy data for seeding
const dummyVendors = [
  {
    name: "Healthy Bites",
    description: "Fresh and organic meals.",
    image: "/public/vendor-healthy-bites.jpg",
    rating: 4.8
  },
  {
    name: "Spice Route",
    description: "Authentic Indian cuisine.",
    image: "/public/vendor-spice-route.jpg",
    rating: 4.5
  }
];

const dummyMeals = [
  {
    name: "Protein Pancakes",
    description: "Fluffy protein pancakes with berries and maple syrup.",
    dietPreference: "Veg",
    category: "Breakfast",
    subProducts: ["Pancakes", "Berries", "Maple Syrup"],
    nutritionalDetails: { protein: 30, carbs: 45, fats: 10, calories: 350 },
    price: 12.99,
    image: "/protein-pancakes-breakfast.png",
    vendorId: "vendor-1",
  },
  {
    name: "Oatmeal Breakfast Bowl",
    description: "Warm oatmeal with nuts, seeds, and fresh fruit.",
    dietPreference: "Vegan",
    category: "Breakfast",
    subProducts: ["Oatmeal", "Mixed Nuts", "Seasonal Fruit"],
    nutritionalDetails: { protein: 15, carbs: 50, fats: 8, calories: 300 },
    price: 9.99,
    image: "/oatmeal-breakfast-bowl.jpg",
    vendorId: "vendor-1",
  },
  {
    name: "Avocado Toast",
    description: "Whole grain toast with mashed avocado, poached egg, and chili flakes.",
    dietPreference: "Veg",
    category: "Breakfast",
    subProducts: ["Whole Grain Toast", "Avocado", "Poached Egg"],
    nutritionalDetails: { protein: 18, carbs: 30, fats: 15, calories: 400 },
    price: 11.50,
    image: "/avocado-toast.png",
    vendorId: "vendor-2",
  },
  {
    name: "Grilled Chicken Bowl",
    description: "Grilled chicken with quinoa, roasted vegetables, and a lemon-herb dressing.",
    dietPreference: "Non-Veg",
    category: "Lunch",
    subProducts: ["Grilled Chicken", "Quinoa", "Roasted Veggies"],
    nutritionalDetails: { protein: 40, carbs: 35, fats: 12, calories: 450 },
    price: 15.99,
    image: "/grilled-chicken-bowl-lunch.jpg",
    vendorId: "vendor-1",
  },
  {
    name: "Mediterranean Wrap",
    description: "Whole wheat wrap filled with hummus, falafel, and fresh salad.",
    dietPreference: "Vegan",
    category: "Lunch",
    subProducts: ["Whole Wheat Wrap", "Hummus", "Falafel", "Salad"],
    nutritionalDetails: { protein: 20, carbs: 50, fats: 10, calories: 420 },
    price: 13.50,
    image: "/mediterranean-wrap.png",
    vendorId: "vendor-2",
  },
  {
    name: "Salmon Salad",
    description: "Pan-seared salmon on a bed of mixed greens with a light vinaigrette.",
    dietPreference: "Non-Veg",
    category: "Lunch",
    subProducts: ["Pan-seared Salmon", "Mixed Greens", "Vinaigrette"],
    nutritionalDetails: { protein: 35, carbs: 20, fats: 18, calories: 480 },
    price: 17.99,
    image: "/salmon-salad-lunch.jpg",
    vendorId: "vendor-1",
  },
  {
    name: "Chicken Teriyaki Dinner",
    description: "Tender chicken in a sweet and savory teriyaki sauce with steamed rice and broccoli.",
    dietPreference: "Non-Veg",
    category: "Dinner",
    subProducts: ["Chicken Teriyaki", "Steamed Rice", "Broccoli"],
    nutritionalDetails: { protein: 45, carbs: 60, fats: 15, calories: 600 },
    price: 18.99,
    image: "/chicken-teriyaki-dinner.jpg",
    vendorId: "vendor-1",
  },
  {
    name: "Vegetable Stir-fry",
    description: "Assorted fresh vegetables stir-fried in a light soy-ginger sauce with noodles.",
    dietPreference: "Vegan",
    category: "Dinner",
    subProducts: ["Mixed Vegetables", "Noodles", "Soy-Ginger Sauce"],
    nutritionalDetails: { protein: 15, carbs: 70, fats: 10, calories: 550 },
    price: 16.50,
    image: "/vegetable-stir-fry.png",
    vendorId: "vendor-2",
  },
  {
    name: "Herb Roasted Salmon",
    description: "Oven-roasted salmon with herbs, served with roasted asparagus and sweet potato mash.",
    dietPreference: "Non-Veg",
    category: "Dinner",
    subProducts: ["Roasted Salmon", "Asparagus", "Sweet Potato Mash"],
    nutritionalDetails: { protein: 40, carbs: 40, fats: 20, calories: 620 },
    price: 20.99,
    image: "/herb-roasted-salmon-dinner.jpg",
    vendorId: "vendor-1",
  },
];

const dummyPlans = [
  {
    name: "3-Day Plan",
    durationDays: 3,
    price: 45.00, // Example total price for 3 days
  },
  {
    name: "5-Day Plan",
    durationDays: 5,
    price: 70.00, // Example total price for 5 days
  },
  {
    name: "7-Day Plan",
    durationDays: 7,
    price: 95.00, // Example total price for 7 days
  },
];

const dummyAccompaniments = [
  {
    name: "Extra Sauce",
    price: 1.50
  },
  {
    name: "Side Salad",
    price: 3.00
  }
];


/**
 * @openapi
 * /api/admin/seed-data:
 *   post:
 *     summary: Manually trigger to populate MongoDB with initial vendor and meal data.
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Database seeded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       500:
 *         description: Failed to seed database
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 error:
 *                   type: string
 */
router.post('/seed-data', async (req, res) => {
  try {
    // Clear existing data (optional, for development)
    await Vendor.deleteMany({});
    await Meal.deleteMany({});
    await Plan.deleteMany({});
    await Accompaniment.deleteMany({});

    // Seed Vendors
    const createdVendors = await Vendor.insertMany(dummyVendors);
    console.log('Vendors seeded:', createdVendors.length);

    // Assign vendor IDs to meals and seed Meals
    const mealsWithVendorIds = dummyMeals.map(meal => {
      const randomVendor = createdVendors[Math.floor(Math.random() * createdVendors.length)];
      return { ...meal, vendorId: randomVendor._id };
    });
    const createdMeals = await Meal.insertMany(mealsWithVendorIds);
    console.log('Meals seeded:', createdMeals.length);

    // Seed Plans
    const createdPlans = await Plan.insertMany(dummyPlans);
    console.log('Plans seeded:', createdPlans.length);

    // Seed Accompaniments
    const createdAccompaniments = await Accompaniment.insertMany(dummyAccompaniments);
    console.log('Accompaniments seeded:', createdAccompaniments.length);


    res.status(200).json({ message: 'Database seeded successfully' });
  } catch (error) {
    console.error('Failed to seed database:', error);
    res.status(500).json({ message: 'Failed to seed database', error: error.message });
  }
});

module.exports = router;
