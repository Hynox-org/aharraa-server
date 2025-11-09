const mongoose = require("mongoose");

const AddressSchema = new mongoose.Schema(
  {
    street: { type: String, required: true },
    city: { type: String, required: true },
    zip: { type: String, required: true },
  },
  { _id: false }
);

const PersonDetailsSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phoneNumber: { type: String, required: true },
  },
  { _id: false }
);

const OrderItemSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    meal: { type: mongoose.Schema.Types.ObjectId, ref: "Meal", required: true },
    plan: { type: mongoose.Schema.Types.ObjectId, ref: "Plan", required: true },
    quantity: { type: Number, required: true },
    personDetails: [{ type: PersonDetailsSchema }],
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    skippedDates: [{ type: Date }],
    itemTotalPrice: { type: Number, required: true },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },
  },
  { _id: false }
);

const OrderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  items: [{ type: OrderItemSchema, required: true }],
  paymentMethod: { type: String, required: true },
  totalAmount: { type: Number, required: true },
  currency: { type: String, required: true },
  orderDate: { type: Date, required: true }, // Changed to required as it comes from checkoutDate
  status: {
    type: String,
    enum: ["pending", "confirmed", "delivered", "cancelled", "failed"],
    default: "pending",
  },
  paymentSessionId: { type: String },
  paymentDetails: {
    cfPaymentId: { type: String },
    status: { type: String, enum: ["SUCCESS", "FAILED", "PENDING"] },
    paymentTime: { type: Date },
    bankReference: { type: String },
    method: { type: String },
  },
  paymentConfirmedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  deliveryAddresses: { type: Map, of: AddressSchema, required: true },
  invoiceUrl: { type: String }, // Add invoiceUrl field
});

module.exports = mongoose.model("Order", OrderSchema);
