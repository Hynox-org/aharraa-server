const puppeteer = require("puppeteer-core"); // Use puppeteer-core for production environments
const supabase = require("../config/supabase");

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
  const browser = await puppeteer.launch({
    headless: "new", // Use "new" for modern headless mode
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    // executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath(),
    // For Render, you might need to set PUPPETEER_EXECUTABLE_PATH in your environment variables
    // to point to the Chromium executable, e.g., /usr/bin/chromium or /usr/bin/google-chrome
    // If not set, puppeteer-core will try to find a bundled Chromium or a globally installed one.
    // The error message suggests /opt/render/.cache/puppeteer, so you might need to point to that.
    // A common value for Render is '/usr/bin/chromium-browser' or '/usr/bin/google-chrome'
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser', // Fallback for common Render path
  });
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
  const logoBase64 =
    "data:image/svg+xml;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/4QC8RXhpZgAASUkqAAgAAAAGABIBAwABAAAAAQAAABoBBQABAAAAVgAAABsBBQABAAAAXgAAACgBAwABAAAAAgAAABMCAwABAAAAAQAAAGmHBAABAAAAZgAAAAAAAABgAAAAAQAAAGAAAAABAAAABgAAkAcABAAAADAyMTABkQcABAAAAAECAwAAoAcABAAAADAxMDABoAMAAQAAAP//AAACoAMAAQAAAPQBAAADoAMAAQAAAPQBAAAAAAAA/+EONGh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8APD94cGFja2V0IGJlZ2luPSfvu78nIGlkPSdXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQnPz4KPHg6eG1wbWV0YSB4bWxuczp4PSdhZG9iZTpuczptZXRhLyc+CjxyZGY6UkRGIHhtbG5zOnJkZj0naHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyc+CgogPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9JycKICB4bWxuczpBdHRyaWI9J2h0dHA6Ly9ucy5hdHRyaWJ1dGlvbi5jb20vYWRzLzEuMC8nPgogIDxBdHRyaWI6QWRzPgogICA8cmRmOlNlcT4KICAgIDxyZGY6bGkgcmRmOnBhcnNlVHlwZT0nUmVzb3VyY2UnPgogICAgIDxBdHRyaWI6Q3JlYXRlZD4yMDI1LTEwLTI2PC9BdHRyaWI6Q3JlYXRlZD4KICAgICA8QXR0cmliOkV4dElkPmEyNTY0OTQ5LTI3N2MtNDhlOC05YjM3LTc2ZTU4MGVmYWRkMDwvQXR0cmliOkV4dElkPgogICAgIDxBdHRyaWI6RmJJZD41MjUyNjU5MTQxNzk1ODA8L0F0dHJpYjpGYklkPgogICAgIDxBdHRyaWI6VG91Y2hUeXBlPjI8L0F0dHJpYjpUb3VjaFR5cGU+CiAgICA8L3JkZjpsaT4KICAgPC9yZGY6U2VxPgogIDwvQXR0cmliOkFkcz4KIDwvcmRmOkRlc2NyaXB0aW9uPgoKIDxyZGY6RGVzY3JpcHRpb24gcmRmOmFib3V0PScnCiAgeG1sbnM6ZGM9J2h0dHA6Ly9wdXJsLm9yZy9kYy9lbGVtZW50cy8xLjEvJz4KICA8ZGM6dGl0bGU+CiAgIDxyZGY6QWx0PgogICAgPHJkZjpsaSB4bWw6bGFuZz0neC1kZWZhdWx0Jz5haGFycmFhIC0gMzwvcmRmOmxpPgogICA8L3JkZjpBbHQ+CiAgPC9kYzp0aXRsZT4KIDwvcmRmOkRlc2NyaXB0aW9uPgoKIDxyZGY6RGVzY3JpcHRpb24gcmRmOmFib3V0PScnCiAgeG1sbnM6cGRmPSdodHRwOi8vbnMuYWRvYmUuY29tL3BkZi8xLjMvJz4KICA8cGRmOkF1dGhvcj5TdXJlbmRhciBWYXJtYW48L3BkZjpBdXRob3I+CiA8L3JkZjpEZXNjcmlwdGlvbj4KCiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0nJwogIHhtbG5zOnhtcD0naHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLyc+CiAgPHhtcDpDcmVhdG9yVG9vbD5DYW52YSAoUmVuZGVyZXIpIGRvYz1EQUcyeEtEcUVQRSB1c2VyPVVBRkNLbWFsWmN3IGJyYW5kPUh1ZXZlcnNlIHRlbXBsYXRlPTwveG1wOkNyZWF0b3JUb29sPgogPC9yZGY6RGVzY3JpcHRpb24+CjwvcmRmOlJERj4KPC94OnhtcG1ldGE+CiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCjw/eHBhY2tldCBlbmQ9J3cnPz7/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAH0AfQDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDyuiiikfEhRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQB6p+zx4aTW/GUl9dwrLZ6bF5hV1yrSNlUBH/AH0f+AivpptG0tvv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lfXOp6hcXt/M011cOZJZG6sx6mq1FFBm3fVhXaaN8T/F2i6Rbabpmq+TaW6lY1NvE5AyTjLKT3ri6KCoVJU3eDsd63xe8ct111vwtoR/7JWP4h8deJPEdj9j1rVZbq23B/LKIo3DoflA9a5qigqVerJWcm/mFFFFBkFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAH/9k=";
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
            <img src="${logoBase64}" alt="Aharra Logo" class="logo">
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
  const { data: listData, error: listError } = await supabase.storage
    .from("AharraaInvoices")
    .list("", { search: fileName });

  let publicUrl;

  if (listError) {
    console.error("Error listing files in Supabase:", listError);
    throw new Error("Failed to check for existing invoice PDF.");
  }

  const { data, error } = await supabase.storage
    .from("AharraaInvoices")
    .upload(fileName, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (error) {
    console.error("Error uploading PDF to Supabase:", error);
    throw new Error("Failed to upload invoice PDF.");
  }

  const { data: publicUrlData } = supabase.storage
    .from("AharraaInvoices")
    .getPublicUrl(fileName);
  publicUrl = publicUrlData.publicUrl;

  // Append a timestamp to the URL to prevent caching issues
  return `${publicUrl}?v=${new Date().getTime()}`;
};

module.exports = {
  generateInvoicePdf,
};
