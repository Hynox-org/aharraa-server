const mongoose = require('mongoose');

const AddressSchema = new mongoose.Schema({
  street: { type: String, required: true },
  city: { type: String, required: true },
  zip: { type: String, required: true },
}, { _id: false });

const PersonDetailsSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phoneNumber: { type: String, required: true },
}, { _id: false });

const OrderItemSchema = new mongoose.Schema({
  id: { type: String, required: true }, // Unique ID for the checkout item (from CartItem)
  meal: {
    _id: { type: mongoose.Schema.Types.ObjectId, ref: 'Meal', required: true },
    name: { type: String, required: true },
  },
  plan: {
    _id: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', required: true },
    name: { type: String, required: true },
  },
  quantity: { type: Number, required: true },
  personDetails: [{ type: PersonDetailsSchema }], // Optional array of person details
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  itemTotalPrice: { type: Number, required: true },
  vendor: {
    _id: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
    name: { type: String, required: true },
  },
}, { _id: false });

const OrderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
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
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  deliveryAddresses: { type: Map, of: AddressSchema, required: true }
});

module.exports = mongoose.model('Order', OrderSchema);
