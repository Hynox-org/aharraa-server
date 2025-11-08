const getUserOrderConfirmationEmail = (order, user) => {
  let itemsHtml = '';
  order.items.forEach(item => {
    itemsHtml += `
      <tr>
        <td>${item.meal.name} (${item.plan.name})</td>
        <td>${item.quantity}</td>
        <td>$${item.itemTotalPrice}</td>
      </tr>
    `;
  });

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Order Confirmation</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { width: 80%; margin: 20px auto; border: 1px solid #ddd; padding: 20px; }
            .header { background-color: #f4f4f4; padding: 10px; text-align: center; }
            .content { margin-top: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f4f4f4; }
            .footer { margin-top: 30px; text-align: center; font-size: 0.9em; color: #777; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h2>Order Confirmation - #${order._id}</h2>
            </div>
            <div class="content">
                <p>Dear ${user.name},</p>
                <p>Thank you for your order! Your order #${order._id} has been successfully confirmed.</p>
                <p>Here are your order details:</p>
                <table>
                    <thead>
                        <tr>
                            <th>Item</th>
                            <th>Quantity</th>
                            <th>Price</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                </table>
                <p><strong>Total Amount: $${order.totalAmount}</strong></p>
                <p>We will notify you once your order is out for delivery.</p>
                <p>Thank you for choosing our service!</p>
            </div>
            <div class="footer">
                <p>&copy; ${new Date().getFullYear()} Aharraa. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
  `;
};

const getVendorOrderNotificationEmail = (order, vendor, vendorItems) => {
  let itemsHtml = '';
  vendorItems.forEach(item => {
    itemsHtml += `
      <tr>
        <td>${item.meal.name} (${item.plan.name})</td>
        <td>${item.quantity}</td>
        <td>$${item.itemTotalPrice}</td>
        <td>${item.personDetails ? item.personDetails.map(p => p.name).join(', ') : 'N/A'}</td>
        <td>${new Date(item.startDate).toLocaleDateString()} - ${new Date(item.endDate).toLocaleDateString()}</td>
      </tr>
    `;
  });

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Order Notification</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { width: 80%; margin: 20px auto; border: 1px solid #ddd; padding: 20px; }
            .header { background-color: #f4f4f4; padding: 10px; text-align: center; }
            .content { margin-top: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f4f4f4; }
            .footer { margin-top: 30px; text-align: center; font-size: 0.9em; color: #777; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h2>New Order Notification - Order #${order._id}</h2>
            </div>
            <div class="content">
                <p>Dear ${vendor.name},</p>
                <p>A new order has been placed that includes items from your menu. Please prepare the following:</p>
                <table>
                    <thead>
                        <tr>
                            <th>Item</th>
                            <th>Quantity</th>
                            <th>Price</th>
                            <th>Person Details</th>
                            <th>Delivery Dates</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                </table>
                <p><strong>Customer Name: ${order.userId.name || 'N/A'}</strong></p>
                <p><strong>Customer Email: ${order.userId.email || 'N/A'}</strong></p>
                <p><strong>Delivery Address:</strong></p>
                <ul>
                    ${Object.entries(order.deliveryAddresses).map(([category, address]) => `
                        <li><strong>${category}:</strong> ${address.street}, ${address.city}, ${address.zip}</li>
                    `).join('')}
                </ul>
                <p>Please log in to your dashboard for more details and to manage the order.</p>
                <p>Thank you,</p>
                <p>Aharraa Team</p>
            </div>
            <div class="footer">
                <p>&copy; ${new Date().getFullYear()} Aharraa. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
  `;
};

module.exports = {
  getUserOrderConfirmationEmail,
  getVendorOrderNotificationEmail,
};
