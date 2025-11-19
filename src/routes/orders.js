const express = require("express");
const router = express.Router();
const Joi = require("joi");
const mongoose = require("mongoose"); // Import mongoose to use ObjectId validation
const authMiddleware = require("../middleware/auth");
const Order = require("../models/Order");
const Meal = require("../models/Meal");
const Plan = require("../models/Plan");
const Vendor = require("../models/Vendor");
const User = require("../models/User"); // Import User model
const Cart = require("../models/Cart"); // Import Cart model
const CartItem = require("../models/CartItem"); // Import CartItem model
const {
  createCashfreeOrder,
  getCashfreeOrderDetails,
} = require("../utils/cashfree");
const { sendEmail } = require("../utils/emailService"); // Import email service
const { generateInvoicePdf } = require("../utils/pdfGenerator"); // Import PDF generator
const {
  getUserOrderConfirmationEmail,
  getVendorOrderNotificationEmail,
} = require("../utils/emailTemplates"); // Import email templates
const { getGoogleSheetClient } = require("../utils/googleSheets"); // Import Google Sheets client
const { syncOrdersToGoogleSheet } = require("../cron/syncOrdersCron"); // Import sync function

// Joi schema for the test endpoint
const testEmailPdfSchema = Joi.object({
  orderId: Joi.string().required(),
});

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
  menu: Joi.string().required(), // Changed from meal object to menu ID
  plan: Joi.string().required(), // Changed from plan object to plan ID
  quantity: Joi.number().integer().min(1).required(),
  personDetails: Joi.array().items(personDetailsSchema).optional(), // Optional array of person details
  startDate: Joi.string().isoDate().required(),
  endDate: Joi.string().isoDate().required(),
  skippedDates: Joi.array().items(Joi.string().isoDate()).optional(), // Added skippedDates
  itemTotalPrice: Joi.number().min(0).required(),
  vendor: Joi.string().required(), // Changed from vendor object to vendor ID
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
  status: Joi.string()
    .valid("cancelled", "delivered", "pending", "confirmed", "failed")
    .optional(), // Allow more status updates, but carefully
  deliveryAddresses: Joi.object({
    Breakfast: deliveryAddressCategorySchema.optional(),
    Lunch: deliveryAddressCategorySchema.optional(),
    Dinner: deliveryAddressCategorySchema.optional(),
  }).optional(),
  items: Joi.array()
    .items(
      Joi.object({
        id: Joi.string().required(), // ID of the specific order item to update
        startDate: Joi.string().isoDate().optional(),
        endDate: Joi.string().isoDate().optional(),
        skippedDates: Joi.array().items(Joi.string().isoDate()).optional(), // Added skippedDates to allow updating for specific items
        personDetails: Joi.array().items(personDetailsSchema).optional(),
      })
    )
    .optional(),
  itemId: Joi.string().optional(), // Top-level itemId for specific item updates
  skippedDate: Joi.string().isoDate().optional(), // Top-level skippedDate for a specific item
  newEndDate: Joi.string().isoDate().optional(), // Top-level newEndDate for a specific item
}).min(1); // At least one field must be present for update

router.post("/webhook", async (req, res) => {
  const { type, data, event_time } = req.body;

  if (type === "PAYMENT_SUCCESS_WEBHOOK") {
    try {
      const {
        order: orderData,
        payment: paymentData,
        customer_details: customerDetailsData,
      } = data;

      const orderId = orderData.order_id;
      const paymentStatus = paymentData.payment_status;
      const cfPaymentId = paymentData.cf_payment_id;
      const paymentTime = paymentData.payment_time;
      const bankReference = paymentData.bank_reference;

      if (!mongoose.Types.ObjectId.isValid(orderId)) {
        console.error(`Invalid order ID received in webhook: ${orderId}`);
        return res.status(400).json({ message: "Invalid order ID format" });
      }

      const order = await Order.findById(orderId)
        .populate("user")
        .populate("items.menu") // Changed from items.meal to items.menu
        .populate("items.plan")
        .populate("items.vendor");
      console.log(Order.schema.paths["items.menu"]); // Should show ref: 'Menu'
      console.log(Order.schema.paths["items.plan"]); // Should show ref: 'Plan'
      console.log(Order.schema.paths["items.vendor"]); // Should show ref: 'Vendor'
      if (!order) {
        console.error(`Order not found for ID: ${orderId}`);
        return res.status(404).json({ message: "Order not found" });
      }

      // Update order status and payment details
      order.paymentDetails = {
        cfPaymentId: cfPaymentId,
        status: paymentStatus,
        paymentTime: new Date(paymentTime),
        bankReference: bankReference,
        method: paymentData.payment_group, // Assuming payment_group is the method
      };
      console.log(
        `Order ${orderId} payment details updated:`,
        order.paymentDetails
      );

      if (paymentStatus === "SUCCESS") {
        order.status = "confirmed";
        order.paymentConfirmedAt = new Date();

        // Fetch user and vendor details for email and invoice
        const user = await User.findById(order.user);
        if (!user) {
          console.error(`User not found for order ${orderId}`);
          // Continue processing, but log the error
        }

        // Collect all unique vendor IDs from order items
        const vendorIds = [
          ...new Set(order.items.map((item) => item.vendor._id.toString())),
        ];
        const vendors = await Vendor.find({ _id: { $in: vendorIds } });

        // Generate Invoice PDF and get public URL
        let invoicePdfUrl = null;
        try {
          invoicePdfUrl = await generateInvoicePdf(order, user);
          order.invoiceUrl = invoicePdfUrl; // Save the invoice URL to the order
          console.log(`Invoice PDF generated and uploaded: ${invoicePdfUrl}`);
        } catch (pdfError) {
          console.error(
            `Failed to generate or upload invoice PDF for order ${order._id}:`,
            pdfError
          );
        }

        // Send Order Confirmation Email to User
        if (user && user.email) {
          const userEmailContent = getUserOrderConfirmationEmail(
            order,
            user,
            invoicePdfUrl
          );
          try {
            await sendEmail(
              user.email,
              `Order #${order._id} Confirmation - Aharraa`,
              userEmailContent.text, // Pass text content
              userEmailContent.html // Pass HTML content
            );
            console.log(
              `Order confirmation email sent to user ${user.email} for order ${order._id}`
            );
          } catch (emailError) {
            console.error(
              `Failed to send order confirmation email to user ${user.email} for order ${order._id}:`,
              emailError.message
            );
          }
        } else {
          console.warn(
            `User email not available for order ${order._id}, skipping user email.`
          );
        }

        // Send Order Notification Email to Vendors
        for (const vendor of vendors) {
          if (vendor.email) {
            // Filter order items relevant to the current vendor
            const vendorItems = order.items.filter(
              (item) => item.vendor._id.toString() === vendor._id.toString()
            );
            const vendorEmailContent = getVendorOrderNotificationEmail(
              order,
              vendor,
              vendorItems
            );
            try {
              await sendEmail(
                vendor.email,
                `New Order #${order._id} Notification - Aharraa`,
                vendorEmailContent.text, // Pass text content
                vendorEmailContent.html // Pass HTML content
              );
              console.log(
                `Order notification email sent to vendor ${vendor.email} for order ${order._id}`
              );
            } catch (emailError) {
              console.error(
                `Failed to send order notification email to vendor ${vendor.email} for order ${order._id}:`,
                emailError.message
              );
            }
          } else {
            console.warn(
              `Vendor email not available for vendor ${vendor._id}, skipping vendor email.`
            );
          }
        }

        // Clear user's cart and attached cart items after successful order
        try {
          const userCart = await Cart.findOne({ user: order.user });
          if (userCart) {
            await CartItem.deleteMany({ cart: userCart._id });
            await Cart.deleteOne({ _id: userCart._id });
            console.log(`Cart and cart items cleared for user ${order.user}`);
          }
        } catch (cartClearError) {
          console.error(
            `Failed to clear cart for user ${order.user} after order ${order._id}:`,
            cartClearError.message
          );
        }
      } else if (paymentStatus === "FAILED") {
        order.status = "failed";
      } else {
        // Handle other statuses if necessary, e.g., PENDING, REFUNDED
        console.log(
          `Webhook received for order ${orderId} with status: ${paymentStatus}. No status change applied.`
        );
      }
      await order.save();
      console.log(`Order ${orderId} updated to status: ${order.status}`);
      res.status(200).json({ message: "Webhook processed successfully" });
    } catch (error) {
      console.error("Error processing PAYMENT_SUCCESS_WEBHOOK:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  } else {
    console.log(
      `Received webhook of type: ${type}. No specific logic implemented for this type.`
    );
    res
      .status(200)
      .json({ message: `Webhook type ${type} received, but not processed.` });
  }
});

// POST /api/orders/test-email-pdf - Test endpoint to generate PDF and send email
router.post("/test-email-pdf", async (req, res) => {
  try {
    const { error } = testEmailPdfSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: "Bad Request",
        details: `Validation failed: ${error.details[0].message}`,
      });
    }

    const { orderId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Invalid order ID format" });
    }

    const order = await Order.findById(orderId)
      .populate("user")
      .populate("items.menu") // Changed from items.meal to items.menu
      .populate("items.plan")
      .populate("items.vendor");

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const user = await User.findById(order.user);
    if (!user) {
      console.error(`User not found for order ${orderId}`);
      return res.status(404).json({ message: "User not found for the order" });
    }

    // Collect all unique vendor IDs from order items
    const vendorIds = [
      ...new Set(order.items.map((item) => item.vendor._id.toString())),
    ];
    const vendors = await Vendor.find({ _id: { $in: vendorIds } });

    // Generate Invoice PDF and get public URL
    let invoicePdfUrl = null;
    try {
      invoicePdfUrl = await generateInvoicePdf(order, user);
      order.invoiceUrl = invoicePdfUrl; // Save the invoice URL to the order
      await order.save(); // Save the order with the invoice URL
      console.log(`Invoice PDF generated and uploaded: ${invoicePdfUrl}`);
    } catch (pdfError) {
      console.error(
        `Failed to generate or upload invoice PDF for order ${order._id}:`,
        pdfError
      );
      return res
        .status(500)
        .json({ message: "Failed to generate invoice PDF" });
    }

    // Send Order Confirmation Email to User
    if (user && user.email) {
      const userEmailContent = getUserOrderConfirmationEmail(
        order,
        user,
        invoicePdfUrl
      );
      try {
        await sendEmail(
          user.email,
          `Order #${order._id} Confirmation - Aharraa (Test)`,
          userEmailContent.text,
          userEmailContent.html
        );
        console.log(
          `Test order confirmation email sent to user ${user.email} for order ${order._id}`
        );
      } catch (emailError) {
        console.error(
          `Failed to send test order confirmation email to user ${user.email} for order ${order._id}:`,
          emailError.message
        );
        return res.status(500).json({ message: "Failed to send email" });
      }
    } else {
      return res.status(400).json({ message: "User email not available" });
    }

    // Send Order Notification Email to Vendors
    for (const vendor of vendors) {
      if (vendor.email) {
        // Filter order items relevant to the current vendor
        const vendorItems = order.items.filter(
          (item) => item.vendor._id.toString() === vendor._id.toString()
        );
        const vendorEmailContent = getVendorOrderNotificationEmail(
          order,
          vendor,
          vendorItems
        );
        try {
          await sendEmail(
            vendor.email,
            `New Order #${order._id} Notification - Aharraa (Test)`,
            vendorEmailContent.text, // Pass text content
            vendorEmailContent.html // Pass HTML content
          );
          console.log(
            `Test order notification email sent to vendor ${vendor.email} for order ${order._id}`
          );
        } catch (emailError) {
          console.error(
            `Failed to send test order notification email to vendor ${vendor.email} for order ${order._id}:`,
            emailError.message
          );
          // Do not return here, continue to send to other vendors
        }
      } else {
        console.warn(
          `Vendor email not available for vendor ${vendor._id}, skipping vendor email.`
        );
      }
    }

    res.status(200).json({
      message: "Test PDF generated and email sent successfully",
      invoiceUrl: invoicePdfUrl,
    });
  } catch (error) {
    console.error("Error in test-email-pdf endpoint:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.post("/", authMiddleware.protect, async (req, res) => {
  let order; // Declare order here so it's accessible in catch blocks
  try {
    const { error } = orderSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: "Bad Request",
        details: `Validation failed: ${error.details[0].message}`,
      });
    }

    const { userId, checkoutData, paymentMethod, totalAmount, currency } =
      req.body;

    // Map checkoutData items to OrderItemSchema
    const orderItems = checkoutData.items.map((item) => ({
      id: item.id,
      menu: item.menu, // Changed from item.meal.id to item.menu
      plan: item.plan,
      quantity: item.quantity,
      personDetails: item.personDetails,
      startDate: new Date(item.startDate),
      endDate: new Date(item.endDate),
      skippedDates: item.skippedDates
        ? item.skippedDates.map((date) => new Date(date))
        : [], // Added skippedDates
      itemTotalPrice: item.itemTotalPrice,
      vendor: item.vendor, // Changed from item.vendor.id to item.vendor
    }));

    order = new Order({
      user: checkoutData.userId,
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
      return res.status(400).json({
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

      return res.status(201).json({
        paymentSessionId: cashfreeOrder.payment_session_id,
        order: order,
      });
    } catch (cashfreeError) {
      console.error("Error creating Cashfree payment session:", cashfreeError);
      order.status = "failed";
      await order.save();
      return res.status(500).json({
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
    res.status(500).json({
      error: "Internal Server Error",
      details: "Database error during payment session creation",
    });
  }
});

// GET /api/orders - Get all orders for the authenticated user
router.get("/", authMiddleware.protect, async (req, res) => {
  try {
    const userId = req.user.id; // Get userId from authenticated user

    const orders = await Order.find({ user: userId })
      .populate("user")
      .populate("items.menu")
      .populate("items.plan")
      .populate("items.vendor")
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
      return res.status(400).json({
        error: "Bad Request",
        details: `Validation failed: ${error.details[0].message}`,
      });
    }

    const order = await Order.findOne({ _id: orderId, user: userId });

    if (!order) {
      return res
        .status(404)
        .json({ message: "Order not found or not authorized to update" });
    }

    // Apply updates based on the validated request body
    if (value.status) {
      // Specific logic for status updates
      if (
        value.status === "cancelled" &&
        (order.status === "pending" || order.status === "confirmed")
      ) {
        order.status = value.status;
      } else if (value.status === "delivered" && order.status === "confirmed") {
        // Example: Allow setting to delivered if confirmed (might be admin-only in a real app)
        order.status = value.status;
      } else {
        return res.status(400).json({
          message: `Invalid status update from ${order.status} to ${value.status}`,
        });
      }
    }

    if (value.deliveryAddresses) {
      order.deliveryAddresses = value.deliveryAddresses;
    }

    if (value.items && Array.isArray(value.items)) {
      value.items.forEach((updatedItem) => {
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
          if (updatedItem.skippedDates) {
            // Assuming skippedDates is an array of dates to be added or replaced
            existingItem.skippedDates = updatedItem.skippedDates.map(
              (date) => new Date(date)
            );
          }
        }
      });
    }

    // Handle top-level itemId, skippedDate, and newEndDate
    if (value.itemId) {
      const existingItem = order.items.find((item) => item.id == value.itemId);
      console.log({ existingItem });
      if (existingItem) {
        if (value.skippedDate) {
          if (!existingItem.skippedDates) {
            existingItem.skippedDates = [];
          }
          existingItem.skippedDates.push(new Date(value.skippedDate));
        }
        if (value.newEndDate) {
          existingItem.endDate = new Date(value.newEndDate);
        }
      } else {
        return res
          .status(404)
          .json({ message: "Order item not found for the provided itemId" });
      }
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
      .populate("user")
      .populate("items.menu")
      .populate("items.plan")
      .populate("items.vendor");

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Optional: Add authorization check to ensure the requesting user is the owner of the order
    // Ensure order.user exists and is a valid ID before comparison
    console.log(req.user.id, order.user);
    const orderUserId = order.user ? order.user._id.toString() : null;
    if (!req.user || !orderUserId || req.user.id !== orderUserId) {
      return res.status(403).json({
        message: "Access denied. You can only view your own order details.",
      });
    }
    console.log(order);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Map items to include only needed fields
    // Send the populated order object directly
    console.log("finalorder:", order);
    res.status(200).json({ order: order });
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

      // Optional: Add authorization check
      const orderUserId = order.user ? order.user.toString() : null;
      console.log({ orderUserId, reqUserId: req.user.id });
      if (!req.user || !orderUserId || req.user.id !== orderUserId) {
        return res.status(403).json({
          message: "Access denied. You can only verify your own order details.",
        });
      }

      if (order.paymentMethod === "COD") {
        return res.status(200).json({
          message: "COD order, no external payment verification needed.",
          order,
        });
      }

      if (!order.paymentSessionId) {
        return res.status(400).json({
          error: "Bad Request",
          details: "Order does not have a payment session ID for verification.",
        });
      }

      try {
        const cashfreeDetails = await getCashfreeOrderDetails(order._id);

        if (
          cashfreeDetails.order_status === "PAID" &&
          order.status !== "confirmed"
        ) {
          try {
            const token = req.headers.authorization.split(" ")[1];
            const resCartClear = await fetch(
              `${process.env.BACKEND_BASE_URL}/api/cart/${order.user}/clear`,
              {
                method: "DELETE",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
              }
            );
            if (!resCartClear.ok) {
              console.error("Failed to clear cart:", resCartClear);
            } else {
              console.log(`Cart cleared for user ${order.user}`);
            }
          } catch (err) {
            console.log(err);
          }
          order.status = "confirmed";
          await order.save();
        } else if (
          cashfreeDetails.order_status === "FAILED" &&
          order.status !== "failed"
        ) {
          order.status = "failed";
          await order.save();
        }

        console.log("Cashfree payment details verified:", cashfreeDetails);

        // Rename variable to avoid shadowing
        const processedOrder = {
          _id: order._id,
          user: order.user
            ? {
                id: order.user._id,
                name: order.user.name,
                email: order.user.email,
              }
            : null,
          items: order.items.map((item) => ({
            id: item.id,
            menu: item.menu
              ? {
                  id: item.menu._id,
                  name: item.menu.name,
                  image: item.menu.image,
                }
              : null,
            plan: item.plan
              ? {
                  id: item.plan._id,
                  name: item.plan.name,
                }
              : null,
            vendor: item.vendor
              ? {
                  id: item.vendor._id,
                  name: item.vendor.name,
                }
              : null,
            quantity: item.quantity,
            personDetails: item.personDetails,
            startDate: item.startDate,
            endDate: item.endDate,
            skippedDates: item.skippedDates,
            itemTotalPrice: item.itemTotalPrice,
          })),
          paymentMethod: order.paymentMethod,
          totalAmount: order.totalAmount,
          currency: order.currency,
          orderDate: order.orderDate,
          status: order.status,
          deliveryAddresses: order.deliveryAddresses,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
          // add other order-level fields as needed
        };

        // Return processedOrder instead of original order
        return res.status(200).json({ order: processedOrder, cashfreeDetails });
      } catch (cashfreeError) {
        console.error("Error verifying Cashfree payment:", cashfreeError);
        return res.status(500).json({
          error: "Payment Gateway Error",
          details: cashfreeError.message,
        });
      }
    } catch (error) {
      console.error("Error verifying order payment:", error);
      res.status(500).json({
        error: "Internal Server Error",
        details: "Database error during order payment verification",
      });
    }
  }
);

// GET /api/sync-orders - Manually trigger order synchronization
router.get("/sync-orders", async (req, res) => {
  try {
    const result = await syncOrdersToGoogleSheet();
    res.status(200).json(result);
  } catch (error) {
    console.error("Error triggering order synchronization:", error);
    res.status(500).json({
      status: "error",
      message: "Internal Server Error",
      timestamp: new Date().toISOString(),
      failedUpdates: [
        { error: error.message, timestamp: new Date().toISOString() },
      ],
    });
  }
});

module.exports = router;

module.exports = router;
