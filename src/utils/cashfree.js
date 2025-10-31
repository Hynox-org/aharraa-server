const { default: fetch } = require("node-fetch");

const createCashfreeOrder = async (orderId, orderAmount, customerDetails) => {
  let cashfreeBaseUrl;
  if (process.env.NODE_ENV === 'production') {
    cashfreeBaseUrl = 'https://api.cashfree.com';
  } else {
    cashfreeBaseUrl = 'https://sandbox.cashfree.com';
  }

  const url = process.env.CASHFREE_API_URL || `${cashfreeBaseUrl}/pg/orders`;
  const xApiVersion = process.env.CASHFREE_API_VERSION || "2022-09-01";
  const xClientId = process.env.CASHFREE_CLIENT_ID;
  const xClientSecret = process.env.CASHFREE_CLIENT_SECRET;

  if (!xClientId || !xClientSecret) {
    throw new Error("Cashfree API keys are not configured.");
  }

  const options = {
    method: "POST",
    headers: {
      "x-api-version": xApiVersion,
      "x-client-id": xClientId,
      "x-client-secret": xClientSecret,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      order_id: orderId,
      order_amount: orderAmount,
      order_currency: "INR", // Assuming INR as default currency
      customer_details: customerDetails,
      // Add other necessary fields as per Cashfree API documentation
      // For example, order_meta for return_url, notify_url etc.
      order_meta: {
        return_url:
          `${process.env.NEXT_FRONTEND_BASE_URL}/order-status/${orderId}`,
      },
    }),
  };

  try {
    const response = await fetch(url, options);
    const data = await response.json();

    if (response.ok) {
      return data;
    } else {
      throw new Error(`Cashfree API error: ${data.message || "Unknown error"}`);
    }
  } catch (error) {
    console.error("Error creating Cashfree order:", error);
    throw error;
  }
};

module.exports = {
  createCashfreeOrder,
};
