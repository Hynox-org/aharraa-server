const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium"); // Import chromium for executable path and args
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
      args: chromium.args, // Use only chromium's default args to avoid potential conflicts
      executablePath: await chromium.executablePath(), // Use chromium's executable path
      headless: "new", // Modern headless mode
      ignoreHTTPSErrors: true, // Ignore HTTPS errors, common in some environments
      userDataDir: '/tmp', // Explicitly set user data directory to /tmp for better compatibility in server environments
    });
  } else {
    // For local development, assume a local Chrome/Chromium is available
    // or puppeteer (not puppeteer-core) is installed to manage browser downloads.
    // For local development, puppeteer-core requires an executablePath.
    // We'll try common paths for Chrome/Chromium based on the OS.
    const executablePath =
      process.env.PUPPETEER_EXECUTABLE_PATH || // Allow user to specify via env var
      (process.platform === 'win32' && 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe') ||
      (process.platform === 'darwin' && '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome') ||
      (process.platform === 'linux' && '/usr/bin/google-chrome');

    if (!executablePath) {
      console.error("No Chrome/Chromium executable found. Please install Chrome or set PUPPETEER_EXECUTABLE_PATH environment variable.");
      throw new Error("No Chrome/Chromium executable found for development environment.");
    }

    browser = await puppeteer.launch({
      executablePath: executablePath,
      headless: "new", // Use 'new' headless mode
      ignoreHTTPSErrors: true,
    });
  }
  const page = await browser.newPage();
  // Set navigation timeout to 0 (unlimited) or a higher value
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
    .map((item) => {
      const unitPrice = item.itemTotalPrice / item.quantity;
      const startDate = new Date(item.startDate).toLocaleDateString("en-IN");
      const endDate = new Date(item.endDate).toLocaleDateString("en-IN");

      return `
      <tr>
        <td>
          <strong>${item.meal.name}</strong><br/>
          <small>${item.plan.name}</small><br/>
          <small>Period: ${startDate} - ${endDate}</small><br/>
          <small>Vendor: ${item.vendor.name}</small>
        </td>
        <td style="text-align: center;">${item.quantity}</td>
        <td style="text-align: right;">₹${unitPrice.toFixed(2)}</td>
        <td style="text-align: right;">₹${item.itemTotalPrice.toFixed(2)}</td>
      </tr>
    `;
    })
    .join("");

  // Base64 encoded logo (you can use any online tool to convert your logo)
  // For now, using a placeholder - replace with your actual base64 logo
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Invoice - ${order._id}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: 'Segoe UI', Arial, sans-serif; 
          color: #333;
          line-height: 1.6;
          padding: 40px;
        }
        .invoice-container {
          max-width: 800px;
          margin: 0 auto;
          background: white;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 40px;
          padding-bottom: 20px;
          border-bottom: 3px solid #2c5f2d;
        }
        .logo-section {
          flex: 1;
        }
        .logo {
          width: 180px;
          height: auto;
        }
        .invoice-title {
          flex: 1;
          text-align: right;
        }
        .invoice-title h1 {
          color: #2c5f2d;
          font-size: 36px;
          margin-bottom: 5px;
        }
        .invoice-title p {
          color: #666;
          font-size: 14px;
        }
        .details-section {
          display: flex;
          justify-content: space-between;
          margin-bottom: 40px;
        }
        .detail-block {
          flex: 1;
        }
        .detail-block h3 {
          color: #2c5f2d;
          font-size: 14px;
          margin-bottom: 10px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .detail-block p {
          font-size: 13px;
          margin: 3px 0;
          color: #555;
        }
        .order-items {
          margin-bottom: 30px;
        }
        .order-items h2 {
          color: #2c5f2d;
          font-size: 18px;
          margin-bottom: 15px;
          border-bottom: 2px solid #eee;
          padding-bottom: 10px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        th {
          background-color: #f8f9fa;
          color: #333;
          font-weight: 600;
          padding: 12px 10px;
          text-align: left;
          border-bottom: 2px solid #dee2e6;
          font-size: 13px;
          text-transform: uppercase;
        }
        td {
          padding: 15px 10px;
          border-bottom: 1px solid #eee;
          font-size: 13px;
        }
        tbody tr:hover {
          background-color: #f8f9fa;
        }
        .summary-section {
          display: flex;
          justify-content: flex-end;
          margin-top: 30px;
        }
        .summary-table {
          width: 350px;
        }
        .summary-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 15px;
          font-size: 14px;
        }
        .summary-row.subtotal {
          border-top: 1px solid #ddd;
          padding-top: 15px;
          font-weight: 500;
        }
        .summary-row.total {
          background-color: #2c5f2d;
          color: white;
          font-size: 18px;
          font-weight: bold;
          margin-top: 10px;
          border-radius: 4px;
        }
        .summary-label {
          color: #666;
        }
        .summary-value {
          font-weight: 600;
          text-align: right;
        }
        .summary-row.total .summary-label,
        .summary-row.total .summary-value {
          color: white;
        }
        .footer {
          margin-top: 50px;
          padding-top: 20px;
          border-top: 2px solid #eee;
          text-align: center;
          color: #777;
          font-size: 13px;
        }
        .payment-info {
          background-color: #f8f9fa;
          padding: 20px;
          margin-top: 30px;
          border-radius: 4px;
          border-left: 4px solid #2c5f2d;
        }
        .payment-info h3 {
          color: #2c5f2d;
          font-size: 14px;
          margin-bottom: 10px;
        }
        .payment-info p {
          font-size: 13px;
          color: #555;
          margin: 5px 0;
        }
        .status-badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          background-color: #d4edda;
          color: #155724;
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
        <div class="header">
          <div class="logo-section">
            <img src=${process.env.PDF_LOGO_URL} alt="Aharra Logo" class="logo">
          </div>
          <div class="invoice-title">
            <h1>INVOICE</h1>
            <p>Invoice #: ${order._id.toString().slice(-8).toUpperCase()}</p>
            <p>Date: ${orderDate}</p>
            <p><span class="status-badge">${order.status}</span></p>
          </div>
        </div>

        <!-- Details Section -->
        <div class="details-section">
          <div class="detail-block">
            <h3>Bill To</h3>
            <p><strong>${
              user.fullName || user.metadata?.full_name || "N/A"
            }</strong></p>
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
          <div class="detail-block" style="text-align: right;">
            <h3>Order Details</h3>
            <p><strong>Order ID:</strong> ${order._id}</p>
            <p><strong>Order Date:</strong> ${orderDate}</p>
            <p><strong>Payment Method:</strong> ${order.paymentMethod}</p>
            ${
              order.paymentConfirmedAt
                ? `<p><strong>Payment Date:</strong> ${new Date(
                    order.paymentConfirmedAt
                  ).toLocaleDateString("en-IN")}</p>`
                : ""
            }
          </div>
        </div>

        <!-- Order Items -->
        <div class="order-items">
          <h2>Order Items</h2>
          <table>
            <thead>
              <tr>
                <th style="width: 45%;">Item Description</th>
                <th style="width: 15%; text-align: center;">Quantity</th>
                <th style="width: 20%; text-align: right;">Unit Price</th>
                <th style="width: 20%; text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
        </div>

        <!-- Order Summary -->
        <div class="summary-section">
          <div class="summary-table">
            <div class="summary-row subtotal">
              <span class="summary-label">Subtotal (Items):</span>
              <span class="summary-value">₹${subtotal.toFixed(2)}</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">Delivery Charges:</span>
              <span class="summary-value">₹${deliveryCost.toFixed(2)}</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">Platform Fee (10%):</span>
              <span class="summary-value">₹${platformCost.toFixed(2)}</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">GST (5%):</span>
              <span class="summary-value">₹${gstCost.toFixed(2)}</span>
            </div>
            <div class="summary-row total">
              <span class="summary-label">Total Amount:</span>
              <span class="summary-value">₹${grandTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <!-- Payment Info -->
        <div class="payment-info">
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
          <div class="payment-info" style="margin-top: 20px;">
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

        <!-- Footer -->
        <div class="footer">
          <p><strong>Thank you for your order!</strong></p>
          <p>For any queries, please contact us at support@aharra.com</p>
          <p style="margin-top: 10px; font-size: 11px;">This is a computer-generated invoice and does not require a signature.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  // Change waitUntil option to avoid network timeout
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

  // Append a timestamp to the URL to prevent caching issues
  return `${publicUrl}?v=${new Date().getTime()}`;
};

module.exports = {
  generateInvoicePdf,
};
