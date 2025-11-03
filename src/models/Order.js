const mongoose = require('mongoose');

const AddressSchema = new mongoose.Schema({
  street: { type: String, required: true },
  city: { type: String, required: true },
  zip: { type: String, required: true },
}, { _id: false });

const OrderItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Meal', required: true },
  quantity: { type: Number, required: true },
  price: { type: Number, required: true },
  mealName: { type: String },
  planName: { type: String },
  vendorId: { type: String },
}, { _id: false });

const OrderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items: [{ type: OrderItemSchema, required: true }],
  shippingAddress: { type: AddressSchema, required: true },
  billingAddress: { type: AddressSchema, required: true },
  paymentMethod: { type: String, required: true },
  totalAmount: { type: Number, required: true },
  currency: { type: String, required: true },
  orderDate: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ["pending", "confirmed", "delivered", "cancelled", "failed"],
    default: "pending",
  },
  paymentSessionId: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  deliveryAddresses: { type: Map, of: AddressSchema, required: true }
});

module.exports = mongoose.model('Order', OrderSchema);
