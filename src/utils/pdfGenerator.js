const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");
const { supabaseServiceRole } = require("../config/supabase");

// Helper functions for calculations
function calculateDeliveryCost(
  uniqueMealCategories,
  totalPlanDays,
  deliveryCostPerCategory
) {
  return uniqueMealCategories.length * deliveryCostPerCategory * totalPlanDays;
}

function calculatePlatformCost(subtotal) {
  return subtotal * 0.1;
}

function calculateGstCost(subtotal) {
  return subtotal * 0.05;
}

function calculateGrandTotal({
  subtotal,
  deliveryCost,
  platformCost,
  gstCost,
}) {
  return subtotal + deliveryCost + platformCost + gstCost;
}

const generateInvoicePdf = async (order, user) => {
  let browser;
  if (process.env.SERVER_ENVIRONMENT === 'production') {
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: "new",
      ignoreHTTPSErrors: true,
      userDataDir: '/tmp',
    });
  } else {
    const executablePath =
      process.env.PUPPETEER_EXECUTABLE_PATH ||
      (process.platform === 'win32' && 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe') ||
      (process.platform === 'darwin' && '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome') ||
      (process.platform === 'linux' && '/usr/bin/google-chrome');

    if (!executablePath) {
      console.error("No Chrome/Chromium executable found. Please install Chrome or set PUPPETEER_EXECUTABLE_PATH environment variable.");
      throw new Error("No Chrome/Chromium executable found for development environment.");
    }

    browser = await puppeteer.launch({
      executablePath: executablePath,
      headless: "new",
      ignoreHTTPSErrors: true,
    });
  }
  const page = await browser.newPage();
  await page.setDefaultNavigationTimeout(0);

  const orderDate = new Date(order.orderDate).toLocaleDateString("en-IN");

  // Calculate subtotal from items
  const subtotal = order.items.reduce(
    (sum, item) => sum + item.itemTotalPrice,
    0
  );

  // Calculate total plan days
  const totalPlanDays = order.items.reduce((sum, item) => {
    return sum + (item.plan.durationDays || 1);
  }, 0);

  // Get unique meal categories
  const uniqueMealCategories = [
    new Set(order.items.map((item) => item.meal.category || "General")),
  ];

  // Calculate costs
  const deliveryCostPerCategory = 33.33;
  const deliveryCost = calculateDeliveryCost(
    uniqueMealCategories,
    totalPlanDays,
    deliveryCostPerCategory
  );
  const platformCost = calculatePlatformCost(subtotal);
  const gstCost = calculateGstCost(subtotal);
  const grandTotal = calculateGrandTotal({
    subtotal,
    deliveryCost,
    platformCost,
    gstCost,
  });

  // Generate items HTML
  const itemsHtml = order.items
    .map((item, index) => {
      const unitPrice = item.itemTotalPrice / item.quantity;
      const startDate = new Date(item.startDate).toLocaleDateString("en-IN");
      const endDate = new Date(item.endDate).toLocaleDateString("en-IN");

      return `
      <tr>
        <td class="item-number">${index + 1}</td>
        <td class="item-details">
          <div class="meal-name">${item.meal.name}</div>
          <div class="item-meta">
            <span class="meta-badge plan-badge">${item.plan.name}</span>
            <span class="meta-badge date-badge">${startDate} - ${endDate}</span>
          </div>
          <div class="vendor-name">🏪 ${item.vendor.name}</div>
        </td>
        <td class="text-center qty-cell">${item.quantity}</td>
        <td class="text-right">₹${unitPrice.toFixed(2)}</td>
        <td class="text-right amount-cell">₹${item.itemTotalPrice.toFixed(2)}</td>
      </tr>
    `;
    })
    .join("");

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Invoice - ${order._id}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        
        * { 
          margin: 0; 
          padding: 0; 
          box-sizing: border-box; 
        }
        
        body { 
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          color: #1a1a1a;
          line-height: 1.6;
          background: #f8f9fa;
          padding: 30px 20px;
        }
        
        .invoice-container {
          max-width: 850px;
          margin: 0 auto;
          background: #ffffff;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 24px rgba(0,0,0,0.08);
        }
        
        .invoice-header {
          background: linear-gradient(135deg, #2d5f3f 0%, #3a7a52 100%);
          padding: 40px 50px;
          color: white;
          position: relative;
          overflow: hidden;
        }
        
        .invoice-header::before {
          content: '';
          position: absolute;
          top: -50%;
          right: -10%;
          width: 300px;
          height: 300px;
          background: rgba(255,255,255,0.05);
          border-radius: 50%;
        }
        
        .header-content {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          position: relative;
          z-index: 1;
        }
        
        .logo-section {
          flex: 1;
        }
        
        .logo {
          width: 160px;
          height: auto;
          filter: brightness(0) invert(1);
        }
        
        .invoice-title-section {
          text-align: right;
        }
        
        .invoice-label {
          font-size: 14px;
          font-weight: 500;
          letter-spacing: 2px;
          text-transform: uppercase;
          opacity: 0.9;
          margin-bottom: 8px;
        }
        
        .invoice-number {
          font-size: 24px;
          font-weight: 700;
          margin-bottom: 8px;
        }
        
        .invoice-date {
          font-size: 13px;
          opacity: 0.85;
        }
        
        .status-badge {
          display: inline-block;
          padding: 6px 16px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          background: rgba(255,255,255,0.2);
          backdrop-filter: blur(10px);
          margin-top: 12px;
          border: 1px solid rgba(255,255,255,0.3);
        }
        
        .invoice-body {
          padding: 40px 50px;
        }
        
        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 40px;
          margin-bottom: 40px;
          padding-bottom: 30px;
          border-bottom: 2px solid #f0f0f0;
        }
        
        .info-block {
          background: #f8f9fa;
          padding: 24px;
          border-radius: 10px;
          border-left: 4px solid #2d5f3f;
        }
        
        .info-block h3 {
          color: #2d5f3f;
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 14px;
        }
        
        .info-block p {
          font-size: 13px;
          color: #4a4a4a;
          margin: 6px 0;
          line-height: 1.6;
        }
        
        .info-block p strong {
          color: #1a1a1a;
          font-weight: 600;
        }
        
        .info-label {
          color: #6b6b6b;
          font-size: 12px;
          font-weight: 500;
        }
        
        .section-title {
          color: #1a1a1a;
          font-size: 18px;
          font-weight: 700;
          margin-bottom: 24px;
          padding-bottom: 12px;
          border-bottom: 3px solid #2d5f3f;
          position: relative;
        }
        
        .section-title::after {
          content: '';
          position: absolute;
          bottom: -3px;
          left: 0;
          width: 60px;
          height: 3px;
          background: #5fa878;
        }
        
        table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          margin-bottom: 30px;
          background: white;
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid #e8e8e8;
        }
        
        th {
          background: linear-gradient(to bottom, #f8f9fa, #f0f1f3);
          color: #2d2d2d;
          font-weight: 700;
          padding: 16px 14px;
          text-align: left;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 2px solid #e0e0e0;
        }
        
        td {
          padding: 18px 14px;
          border-bottom: 1px solid #f0f0f0;
          font-size: 13px;
          vertical-align: top;
        }
        
        tbody tr:last-child td {
          border-bottom: none;
        }
        
        tbody tr {
          transition: background-color 0.2s ease;
        }
        
        tbody tr:hover {
          background-color: #f8fdf9;
        }
        
        .item-number {
          color: #999;
          font-weight: 600;
          width: 40px;
        }
        
        .item-details {
          padding-left: 8px;
        }
        
        .meal-name {
          font-weight: 600;
          color: #1a1a1a;
          font-size: 14px;
          margin-bottom: 8px;
        }
        
        .item-meta {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 6px;
        }
        
        .meta-badge {
          font-size: 11px;
          padding: 3px 10px;
          border-radius: 4px;
          font-weight: 500;
        }
        
        .plan-badge {
          background: #e3f2fd;
          color: #1565c0;
        }
        
        .date-badge {
          background: #fff3e0;
          color: #e65100;
        }
        
        .vendor-name {
          font-size: 12px;
          color: #666;
          margin-top: 4px;
        }
        
        .text-center {
          text-align: center;
        }
        
        .text-right {
          text-align: right;
        }
        
        .qty-cell {
          font-weight: 600;
          color: #2d5f3f;
        }
        
        .amount-cell {
          font-weight: 700;
          color: #1a1a1a;
        }
        
        .summary-wrapper {
          display: flex;
          justify-content: flex-end;
          margin-top: 30px;
        }
        
        .summary-box {
          width: 380px;
          background: #f8f9fa;
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }
        
        .summary-row {
          display: flex;
          justify-content: space-between;
          padding: 14px 24px;
          font-size: 13px;
          border-bottom: 1px solid #e8e8e8;
        }
        
        .summary-row:last-child {
          border-bottom: none;
        }
        
        .summary-row.subtotal-row {
          background: white;
          font-weight: 600;
          padding-top: 16px;
        }
        
        .summary-row.total-row {
          background: linear-gradient(135deg, #2d5f3f 0%, #3a7a52 100%);
          color: white;
          font-size: 16px;
          font-weight: 700;
          padding: 18px 24px;
        }
        
        .summary-label {
          color: #5a5a5a;
          font-weight: 500;
        }
        
        .summary-row.total-row .summary-label {
          color: white;
        }
        
        .summary-value {
          font-weight: 700;
          color: #1a1a1a;
        }
        
        .summary-row.total-row .summary-value {
          color: white;
          font-size: 18px;
        }
        
        .info-card {
          background: linear-gradient(to right, #f8f9fa, #ffffff);
          padding: 24px;
          margin-top: 28px;
          border-radius: 10px;
          border: 1px solid #e8e8e8;
          border-left: 4px solid #2d5f3f;
        }
        
        .info-card h3 {
          color: #2d5f3f;
          font-size: 13px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          margin-bottom: 14px;
        }
        
        .info-card p {
          font-size: 13px;
          color: #4a4a4a;
          margin: 8px 0;
          line-height: 1.6;
        }
        
        .info-card p strong {
          color: #1a1a1a;
          font-weight: 600;
        }
        
        .footer {
          margin-top: 50px;
          padding: 30px 50px;
          background: #f8f9fa;
          text-align: center;
          border-top: 2px solid #e8e8e8;
        }
        
        .footer-title {
          color: #2d5f3f;
          font-weight: 700;
          font-size: 15px;
          margin-bottom: 8px;
        }
        
        .footer p {
          color: #666;
          font-size: 12px;
          margin: 6px 0;
        }
        
        .footer-note {
          font-size: 11px;
          color: #999;
          margin-top: 16px;
          font-style: italic;
        }
        
        small {
          font-size: 11px;
          color: #888;
        }
      </style>
    </head>
    <body>
      <div class="invoice-container">
        <!-- Header -->
        <div class="invoice-header">
          <div class="header-content">
            <div class="logo-section">
              <img src="${process.env.PDF_LOGO_URL}" alt="Aharra Logo" class="logo">
            </div>
            <div class="invoice-title-section">
              <div class="invoice-label">Invoice</div>
              <div class="invoice-number">#${order._id.toString().slice(-8).toUpperCase()}</div>
              <div class="invoice-date">${orderDate}</div>
              <div class="status-badge">${order.status}</div>
            </div>
          </div>
        </div>

        <!-- Body -->
        <div class="invoice-body">
          <!-- Info Grid -->
          <div class="info-grid">
            <div class="info-block">
              <h3>Bill To</h3>
              <p><strong>${user.fullName || user.metadata?.full_name || "N/A"}</strong></p>
              <p>${user.email}</p>
              <p>${user.phoneNumber || "N/A"}</p>
              ${
                user.breakfastDeliveryLocation
                  ? `
                <p>${user.breakfastDeliveryLocation.street || ""}</p>
                <p>${user.breakfastDeliveryLocation.state || ""} - ${
                      user.breakfastDeliveryLocation.pincode || ""
                    }</p>
              `
                  : ""
              }
            </div>
            <div class="info-block">
              <h3>Order Details</h3>
              <p><span class="info-label">Order ID:</span> <strong>${order._id}</strong></p>
              <p><span class="info-label">Order Date:</span> <strong>${orderDate}</strong></p>
              <p><span class="info-label">Payment:</span> <strong>${order.paymentMethod}</strong></p>
              ${
                order.paymentConfirmedAt
                  ? `<p><span class="info-label">Paid On:</span> <strong>${new Date(
                      order.paymentConfirmedAt
                    ).toLocaleDateString("en-IN")}</strong></p>`
                  : ""
              }
            </div>
          </div>

          <!-- Order Items -->
          <h2 class="section-title">Order Items</h2>
          <table>
            <thead>
              <tr>
                <th style="width: 5%;">#</th>
                <th style="width: 45%;">Item Description</th>
                <th style="width: 12%; text-align: center;">Qty</th>
                <th style="width: 18%; text-align: right;">Unit Price</th>
                <th style="width: 20%; text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <!-- Summary -->
          <div class="summary-wrapper">
            <div class="summary-box">
              <div class="summary-row subtotal-row">
                <span class="summary-label">Subtotal (Items)</span>
                <span class="summary-value">₹${subtotal.toFixed(2)}</span>
              </div>
              <div class="summary-row">
                <span class="summary-label">Delivery Charges</span>
                <span class="summary-value">₹${deliveryCost.toFixed(2)}</span>
              </div>
              <div class="summary-row">
                <span class="summary-label">Platform Fee (10%)</span>
                <span class="summary-value">₹${platformCost.toFixed(2)}</span>
              </div>
              <div class="summary-row">
                <span class="summary-label">GST (5%)</span>
                <span class="summary-value">₹${gstCost.toFixed(2)}</span>
              </div>
              <div class="summary-row total-row">
                <span class="summary-label">Total Amount</span>
                <span class="summary-value">₹${grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <!-- Payment Info -->
          <div class="info-card">
            <h3>Payment Information</h3>
            <p><strong>Payment Method:</strong> ${order.paymentMethod}</p>
            <p><strong>Amount Paid:</strong> ₹${order.totalAmount.toFixed(2)}</p>
            <p><strong>Currency:</strong> ${order.currency}</p>
          </div>

          <!-- Delivery Addresses -->
          ${
            order.deliveryAddresses &&
            Object.keys(order.deliveryAddresses).length > 0
              ? `
            <div class="info-card">
              <h3>Delivery Addresses</h3>
              ${Array.from(order.deliveryAddresses || new Map()).map(([category, address]) => {
                  const plainAddress = address.toObject ? address.toObject() : address;
                  if (plainAddress && plainAddress.street && plainAddress.city && plainAddress.zip) {
                      return `<p><strong>${category}:</strong> ${plainAddress.street}, ${plainAddress.city}, ${plainAddress.zip}</p>`;
                  }
                  return '';
              }).filter(Boolean).join('')}
            </div>
          `
              : ""
          }
        </div>

        <!-- Footer -->
        <div class="footer">
          <p class="footer-title">Thank you for your order!</p>
          <p>For any queries, please contact us at support@aharra.com</p>
          <p class="footer-note">This is a computer-generated invoice and does not require a signature.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await page.setContent(htmlContent, { waitUntil: "domcontentloaded" });

  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: {
      top: "20px",
      right: "20px",
      bottom: "20px",
      left: "20px",
    },
  });

  await browser.close();

  // Upload to Supabase
  const fileName = `invoice-${order._id}.pdf`;
  const { data: listData, error: listError } = await supabaseServiceRole.storage
    .from("AharraaInvoices")
    .list("", { search: fileName });

  let publicUrl;

  if (listError) {
    console.error("Error listing files in Supabase:", listError);
    throw new Error("Failed to check for existing invoice PDF.");
  }

  const { data, error } = await supabaseServiceRole.storage
    .from("AharraaInvoices")
    .upload(fileName, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (error) {
    console.error("Error uploading PDF to Supabase:", error);
    throw new Error("Failed to upload invoice PDF.");
  }

  const { data: publicUrlData } = supabaseServiceRole.storage
    .from("AharraaInvoices")
    .getPublicUrl(fileName);
  publicUrl = publicUrlData.publicUrl;

  return `${publicUrl}?v=${new Date().getTime()}`;
};

module.exports = {
  generateInvoicePdf,
};
