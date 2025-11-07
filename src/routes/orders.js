const express = require("express");
const router = express.Router();
const Joi = require("joi");
const mongoose = require("mongoose"); // Import mongoose to use ObjectId validation
const authMiddleware = require("../middleware/auth");
const Order = require("../models/Order");
const Meal = require("../models/Meal");
const Plan = require("../models/Plan");
const Vendor = require("../models/Vendor");
const {
  createCashfreeOrder,
  getCashfreeOrderDetails,
} = require("../utils/cashfree");

// Joi schema for address
const addressSchema = Joi.object({
  street: Joi.string().required(),
  city: Joi.string().required(),
  zip: Joi.string().required(),
});

// Joi schema for order item
const personDetailsSchema = Joi.object({
  name: Joi.string().required(),
  phoneNumber: Joi.string().required(),
});

const checkoutItemSchema = Joi.object({
  id: Joi.string().required(), // Unique ID for the checkout item (from CartItem)
  meal: Joi.object({
    id: Joi.string().required(),
    name: Joi.string().required(),
    // Add other meal properties if needed for validation
  }).required(),
  plan: Joi.object({
    id: Joi.string().required(),
    name: Joi.string().required(),
    // Add other plan properties if needed for validation
  }).required(),
  quantity: Joi.number().integer().min(1).required(),
  personDetails: Joi.array().items(personDetailsSchema).optional(), // Optional array of person details
  startDate: Joi.string().isoDate().required(),
  endDate: Joi.string().isoDate().required(),
  itemTotalPrice: Joi.number().min(0).required(),
  vendor: Joi.object({
    id: Joi.string().required(),
    name: Joi.string().required(),
    // Add other vendor properties if needed for validation
  }).required(),
});

const deliveryAddressCategorySchema = Joi.object({
  street: Joi.string().required(),
  city: Joi.string().required(),
  zip: Joi.string().required(),
});

const checkoutDataSchema = Joi.object({
  id: Joi.string().required(), // Unique ID for the checkout session/order
  userId: Joi.string().required(),
  items: Joi.array().items(checkoutItemSchema).min(1).required(),
  deliveryAddresses: Joi.object({
    Breakfast: deliveryAddressCategorySchema.optional(),
    Lunch: deliveryAddressCategorySchema.optional(),
    Dinner: deliveryAddressCategorySchema.optional(),
  }).required(),
  totalPrice: Joi.number().min(0).required(),
  checkoutDate: Joi.string().isoDate().required(),
});

// Joi schema for order creation
const orderSchema = Joi.object({
  userId: Joi.string().required(),
  checkoutData: checkoutDataSchema.required(),
  paymentMethod: Joi.string().valid("COD", "CC", "UPI").required(),
  totalAmount: Joi.number().min(0).required(),
  currency: Joi.string().required(),
});

// Joi schema for order update
const orderUpdateSchema = Joi.object({
  status: Joi.string().valid("cancelled", "delivered", "pending", "confirmed", "failed").optional(), // Allow more status updates, but carefully
  deliveryAddresses: Joi.object({
    Breakfast: deliveryAddressCategorySchema.optional(),
    Lunch: deliveryAddressCategorySchema.optional(),
    Dinner: deliveryAddressCategorySchema.optional(),
  }).optional(),
  items: Joi.array().items(Joi.object({
    id: Joi.string().required(), // ID of the specific order item to update
    startDate: Joi.string().isoDate().optional(),
    endDate: Joi.string().isoDate().optional(),
    personDetails: Joi.array().items(personDetailsSchema).optional(),
  })).optional(),
  skippedDate: Joi.string().isoDate().optional(), // New field for skipping a date
  newEndDate: Joi.string().isoDate().optional(), // New field for updating the end date
}).min(1); // At least one field must be present for update

// POST /api/orders - Create a new order (for COD payments or after successful external payment)
router.post("/", authMiddleware.protect, async (req, res) => {
  try {
    const { orderId } = req.body;

    const order = await Order.findById(orderId);
    order.status = "confirmed";

    await order.save();

    res.status(201).json(order);
  } catch (error) {
    console.error("Error creating order:", error);
    if (
      error.message.includes("Product with ID") ||
      error.message.includes("Invalid product ID format")
    ) {
      return res
        .status(400)
        .json({ error: "Bad Request", details: error.message });
    }
    res
      .status(500)
      .json({
        error: "Internal Server Error",
        details: "Database error during order creation",
      });
  }
});

router.post("/payment", authMiddleware.protect, async (req, res) => {
  let order; // Declare order here so it's accessible in catch blocks
  try {
    const { error } = orderSchema.validate(req.body);
    if (error) {
      return res
        .status(400)
        .json({
          error: "Bad Request",
          details: `Validation failed: ${error.details[0].message}`,
        });
    }

    const {
      userId,
      checkoutData,
      paymentMethod,
      totalAmount,
      currency,
    } = req.body;

    // Map checkoutData items to OrderItemSchema
    const orderItems = checkoutData.items.map((item) => ({
      id: item.id,
      meal: {
        _id: item.meal.id,
        name: item.meal.name,
      },
      plan: {
        _id: item.plan.id,
        name: item.plan.name,
      },
      quantity: item.quantity,
      personDetails: item.personDetails,
      startDate: new Date(item.startDate),
      endDate: new Date(item.endDate),
      itemTotalPrice: item.itemTotalPrice,
      vendor: {
        _id: item.vendor.id,
        name: item.vendor.name,
      },
    }));

    order = new Order({
      userId: checkoutData.userId,
      items: orderItems,
      paymentMethod,
      totalAmount: checkoutData.totalPrice,
      currency, // Assuming currency is still passed separately or derived
      orderDate: new Date(checkoutData.checkoutDate),
      status: "pending", // Initial status before payment gateway interaction
      deliveryAddresses: checkoutData.deliveryAddresses,
    });

    await order.save(); // Save the order to get its _id

    const customerDetails = {
      customer_id: userId,
      customer_phone: req.user.phone || "9898989898",
      customer_email: req.user.email || "test@example.com",
      customer_name: req.user.name || "Test User",
    };

    const MAX_CASHFREE_AMOUNT = 100000;
    const roundedTotalAmount = parseFloat(totalAmount.toFixed(2));

    if (roundedTotalAmount > MAX_CASHFREE_AMOUNT) {
      order.status = "failed";
      await order.save();
      return res
        .status(400)
        .json({
          error: "Payment Gateway Error",
          details: `Order amount ${roundedTotalAmount} exceeds the maximum allowed limit of ${MAX_CASHFREE_AMOUNT}.`,
        });
    }

    try {
      console.log(
        `Attempting to create Cashfree order for amount: ${roundedTotalAmount}`
      );
      const cashfreeOrder = await createCashfreeOrder(
        order._id.toString(), // Use MongoDB order ID as Cashfree order_id
        roundedTotalAmount,
        customerDetails
      );

      order.paymentSessionId = cashfreeOrder.payment_session_id;
      order.status = "pending"; // Keep as pending until payment is confirmed by webhook or verification
      await order.save();

      return res
        .status(201)
        .json({
          paymentSessionId: cashfreeOrder.payment_session_id,
          orderId: order._id,
        });
    } catch (cashfreeError) {
      console.error("Error creating Cashfree payment session:", cashfreeError);
      order.status = "failed";
      await order.save();
      return res
        .status(500)
        .json({
          error: "Payment Gateway Error",
          details: cashfreeError.message,
        });
    }
  } catch (error) {
    console.error("Error in payment session creation:", error);
    if (order && order._id) {
      order.status = "failed";
      await order.save();
    }
    if (
      error.message.includes("Product with ID") ||
      error.message.includes("Invalid product ID format")
    ) {
      return res
        .status(400)
        .json({ error: "Bad Request", details: error.message });
    }
    res
      .status(500)
      .json({
        error: "Internal Server Error",
        details: "Database error during payment session creation",
      });
  }
});

// GET /api/orders - Get all orders for the authenticated user
router.get("/", authMiddleware.protect, async (req, res) => {
  try {
    const userId = req.user.id; // Get userId from authenticated user

    const orders = await Order.find({ userId: userId })
      .populate("items.meal._id") // Populate the meal details
      .populate("items.plan._id") // Populate the plan details
      .populate("items.vendor._id") // Populate the vendor details
      .sort({ orderDate: -1 });

    res.status(200).json(orders);
  } catch (error) {
    console.error("Error fetching user orders:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// PUT /api/orders/:orderId - Update an order by ID (for users)
router.put("/:orderId", authMiddleware.protect, async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id; // Get userId from authenticated user

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Invalid order ID format" });
    }

    const { error, value } = orderUpdateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: "Bad Request", details: `Validation failed: ${error.details[0].message}` });
    }

    const order = await Order.findOne({ _id: orderId, userId: userId });

    if (!order) {
      return res.status(404).json({ message: "Order not found or not authorized to update" });
    }

    // Apply updates based on the validated request body
    if (value.status) {
      // Specific logic for status updates
      if (value.status === "cancelled" && (order.status === "pending" || order.status === "confirmed")) {
        order.status = value.status;
      } else if (value.status === "delivered" && order.status === "confirmed") {
        // Example: Allow setting to delivered if confirmed (might be admin-only in a real app)
        order.status = value.status;
      } else {
        return res.status(400).json({ message: `Invalid status update from ${order.status} to ${value.status}` });
      }
    }

    if (value.deliveryAddresses) {
      order.deliveryAddresses = value.deliveryAddresses;
    }

    if (value.items && Array.isArray(value.items)) {
      value.items.forEach(updatedItem => {
        const existingItem = order.items.id(updatedItem.id); // Assuming order.items is a Mongoose subdocument array
        if (existingItem) {
          if (updatedItem.startDate) {
            existingItem.startDate = new Date(updatedItem.startDate);
          }
          if (updatedItem.endDate) {
            existingItem.endDate = new Date(updatedItem.endDate);
          }
          if (updatedItem.personDetails) {
            existingItem.personDetails = updatedItem.personDetails;
          }
        }
      });
    }

    // Handle skippedDate
    if (value.skippedDate) {
      if (!order.skippedDates) {
        order.skippedDates = [];
      }
      order.skippedDates.push(new Date(value.skippedDate));
    }

    // Handle newEndDate for all items
    if (value.newEndDate) {
      order.items.forEach(item => {
        item.endDate = new Date(value.newEndDate);
      });
    }

    order.updatedAt = new Date();
    await order.save();

    res.status(200).json(order);
  } catch (error) {
    console.error("Error updating order:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/orders/details/:orderId - Get details of a specific order
router.get("/details/:orderId", authMiddleware.protect, async (req, res) => {
  try {
    const { orderId } = req.params;
    // Validate orderId format before querying
    console.log(orderId);
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res
        .status(404)
        .json({ message: "Order not found or invalid ID format" });
    }

    const order = await Order.findById(orderId)
      .populate("items.meal._id")
      .populate("items.plan._id")
      .populate("items.vendor._id");

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Optional: Add authorization check to ensure the requesting user is the owner of the order
    // Ensure order.userId exists and is a valid ID before comparison
    const orderUserId = order.userId ? order.userId.toString() : null;

    if (!req.user || !orderUserId || req.user.id !== orderUserId) {
      return res
        .status(403)
        .json({
          message: "Access denied. You can only view your own order details.",
        });
    }

    res.status(200).json(order);
  } catch (error) {
    console.error("Error fetching order details:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/orders/verify-payment/:orderId - Verify payment details for a specific order
router.get(
  "/verify-payment/:orderId",
  authMiddleware.protect,
  async (req, res) => {
    try {
      const { orderId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(orderId)) {
        return res
          .status(400)
          .json({ error: "Bad Request", details: "Invalid order ID format." });
      }

      const order = await Order.findById(orderId);

      if (!order) {
        return res
          .status(404)
          .json({ error: "Not Found", details: "Order not found." });
      }

      // Optional: Add authorization check to ensure the requesting user is the owner of the order
      const orderUserId = order.userId ? order.userId.toString() : null;
      if (!req.user || !orderUserId || req.user.id !== orderUserId) {
        return res
          .status(403)
          .json({
            message:
              "Access denied. You can only verify your own order details.",
          });
      }

      if (order.paymentMethod === "COD") {
        return res
          .status(200)
          .json({
            message: "COD order, no external payment verification needed.",
            order,
          });
      }

      if (!order.paymentSessionId) {
        return res
          .status(400)
          .json({
            error: "Bad Request",
            details:
              "Order does not have a payment session ID for verification.",
          });
      }

      try {
        const cashfreeDetails = await getCashfreeOrderDetails(order._id); // Assuming Cashfree orderId is stored in paymentSessionId

        // Compare cashfreeDetails.order_status with order.status and update if necessary
        if (
          cashfreeDetails.order_status === "PAID" &&
          order.status !== "confirmed"
        ) {
          order.status = "confirmed";
          await order.save();
        } else if (
          cashfreeDetails.order_status === "FAILED" &&
          order.status !== "failed"
        ) {
          order.status = "failed";
          await order.save();
        }
        // Add other status mappings as needed (e.g., 'PENDING' to 'pending')

        return res.status(200).json({ order, cashfreeDetails });
      } catch (cashfreeError) {
        console.error("Error verifying Cashfree payment:", cashfreeError);
        return res
          .status(500)
          .json({
            error: "Payment Gateway Error",
            details: cashfreeError.message,
          });
      }
    } catch (error) {
      console.error("Error verifying order payment:", error);
      res
        .status(500)
        .json({
          error: "Internal Server Error",
          details: "Database error during order payment verification",
        });
    }
  }
);

module.exports = router;
