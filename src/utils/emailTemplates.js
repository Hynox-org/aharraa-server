const getUserOrderConfirmationEmail = (order, user) => {
  let itemsHtml = '';
  order.items.forEach(item => {
    itemsHtml += `
      <tr>
        <td>${item.meal.name} (${item.plan.name})</td>
        <td>${item.quantity}</td>
        <td>₹${item.itemTotalPrice}</td>
        <td>${item.vendor.name}</td>
        <td>
          ${
            item.personDetails && item.personDetails.length > 0
              ? `<ul style="margin:0;padding-left:16px;">${item.personDetails.map(p => `<li>${p.name} (${p.phoneNumber})</li>`).join('')}</ul>`
              : 'N/A'
          }
        </td>
        <td>${new Date(item.startDate).toLocaleDateString()} - ${new Date(item.endDate).toLocaleDateString()}</td>
        <td>
          ${
            item.skippedDates && item.skippedDates.length > 0
              ? `<ul style="margin:0;padding-left:16px;">${item.skippedDates.map(d => `<li>${new Date(d).toLocaleDateString()}</li>`).join('')}</ul>`
              : 'N/A'
          }
        </td>
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
        body {
          margin:0;padding:0; background:#f8f9fa; font-family:Arial, sans-serif; color:#333;
        }
        .container {
          max-width: 600px; margin: 20px auto; background: #fff; border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05); padding: 24px;
        }
        .header {
          background: #005fa3; color:#fff; padding: 22px 0; text-align:center; border-radius:8px 8px 0 0;
        }
        h2 { margin:0; font-size:1.6em; font-weight:600; }
        .content { margin-top:20px; padding:0 6px;}
        table {
          width:100%; border-collapse:collapse; margin-top:15px;
        }
        th, td {
          padding:10px; border-bottom:1px solid #e4e9ee; text-align:left;
        }
        th { background: #efefef; font-size:1em;}
        .footer {
          margin-top:28px; text-align: center; font-size:0.95em; color:#777;
        }
        @media(max-width:600px){
          .container { padding:12px; }
          .header { font-size:1.2em; padding:16px 0; }
          table, th, td { font-size:0.98em;}
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>Order Confirmation - #${order._id}</h2>
        </div>
        <div class="content">
          <p>Dear ${user.name || user.fullname || user.email},</p>
          <p>Thank you for your order! Your order <strong>#${order._id}</strong> has been successfully confirmed.</p>
          <p>Order Details:</p>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Quantity</th>
                <th>Price</th>
                <th>Vendor</th>
                <th>Person Details</th>
                <th>Delivery Dates</th>
                <th>Skipped Dates</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          <p><strong>Total Amount: ₹${order.totalAmount} ${order.currency}</strong></p>
          <p><strong>Payment Method: ${order.paymentMethod}</strong></p>
          <p><strong>Order Date: ${new Date(order.orderDate).toLocaleDateString()}</strong></p>
          <p><strong>Order Status: ${order.status}</strong></p>
          ${order.paymentSessionId ? `<p><strong>Payment Session ID: ${order.paymentSessionId}</strong></p>` : ''}
          <p><strong>Order Created At: ${new Date(order.createdAt).toLocaleString()}</strong></p>
          <p><strong>Order Last Updated At: ${new Date(order.updatedAt).toLocaleString()}</strong></p>
          <p><strong>Delivery Address:</strong></p>
          <p>
            ${Array.from(order.deliveryAddresses || new Map()).map(([category, address]) => {
                const plainAddress = address.toObject ? address.toObject() : address;
                if (plainAddress && plainAddress.street && plainAddress.city && plainAddress.zip) {
                    return `<strong>${category}:</strong> ${plainAddress.street}, ${plainAddress.city}, ${plainAddress.zip}<br>`;
                }
                return '';
            }).join('')}
          </p>
          <p>We’ll notify you when your order is out for delivery. Thank you for choosing Aharraa!</p>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} Aharraa. All rights reserved.
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
        <td>₹${item.itemTotalPrice}</td>
        <td>
          ${
            item.personDetails && item.personDetails.length > 0
              ? `<ul style="margin:0;padding-left:16px;">${item.personDetails.map(p => `<li>${p.name} (${p.phoneNumber})</li>`).join('')}</ul>`
              : 'N/A'
          }
        </td>
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
        body {
          margin:0;padding:0; background:#f8f9fa; font-family:Arial, sans-serif; color:#333;
        }
        .container {
          max-width:600px; margin:20px auto; background:#fff; border-radius:8px;
          box-shadow:0 2px 8px rgba(0,0,0,0.05); padding:24px;
        }
        .header {
          background:#007962; color:#fff; padding:22px 0; text-align:center; border-radius:8px 8px 0 0;
        }
        .content { margin-top:18px; padding:0 6px;}
        table {
          width:100%; border-collapse:collapse; margin-top:14px;
        }
        th, td {
          padding:9px; border-bottom:1px solid #e4e9ee; text-align:left;
        }
        th { background:#efefef; font-size:1em;}
        ul { margin:0 0 7px 0; padding-left:18px; }
        .footer {
          margin-top:26px; text-align:center; font-size:0.95em; color:#777;
        }
        @media(max-width:600px){
          .container { padding:12px; }
          .header { font-size:1.15em; padding:16px 0;}
          table, th, td { font-size:0.98em;}
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>New Order Notification - #${order._id}</h2>
        </div>
        <div class="content">
          <p>Dear ${vendor.name},</p>
          <p>A new order includes items from your menu. Please prepare the following:</p>
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
          <p><strong>Total Amount: ₹${order.totalAmount} ${order.currency}</strong></p>
          <p><strong>Payment Method: ${order.paymentMethod}</strong></p>
          <p><strong>Order Date: ${new Date(order.orderDate).toLocaleDateString()}</strong></p>
          <p><strong>Order Status: ${order.status}</strong></p>
          ${order.paymentSessionId ? `<p><strong>Payment Session ID: ${order.paymentSessionId}</strong></p>` : ''}
          <p><strong>Order Created At: ${new Date(order.createdAt).toLocaleString()}</strong></p>
          <p><strong>Order Last Updated At: ${new Date(order.updatedAt).toLocaleString()}</strong></p>
          <p><strong>Delivery Address:</strong></p>
          <p>
            ${Array.from(order.deliveryAddresses || new Map()).map(([category, address]) => {
                const plainAddress = address.toObject ? address.toObject() : address;
                if (plainAddress && plainAddress.street && plainAddress.city && plainAddress.zip) {
                    return `<strong>${category}:</strong> ${plainAddress.street}, ${plainAddress.city}, ${plainAddress.zip}<br>`;
                }
                return '';
            }).join('')}
          </p>
          <p>Please log in to your dashboard for more details and to manage the order.</p>
          <p>Thank you,<br/>Aharraa Team</p>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} Aharraa. All rights reserved.
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
