const PDFDocument = require('pdfkit');
const generateInvoicePdf = async (order, user) => {
  const { default: getStream } = await import('get-stream'); // To convert PDF stream to buffer
  const doc = new PDFDocument({ margin: 50 });

  // Collect the PDF into a buffer
  const pdfPromise = getStream(doc, { encoding: 'buffer' });

    // Header
    doc.fontSize(25).text('Invoice', { align: 'center' });
    doc.moveDown();

    // Order Details
    doc.fontSize(12).text(`Order ID: ${order._id}`);
    doc.text(`Order Date: ${new Date(order.orderDate).toLocaleDateString()}`);
    doc.text(`Customer Name: ${user.name}`);
    doc.text(`Customer Email: ${user.email}`);
    doc.moveDown();

    // Items Table Header
    doc.fontSize(14).text('Order Items:', { underline: true });
    doc.moveDown();

    const tableTop = doc.y;
    const itemCol = 50;
    const quantityCol = 250;
    const priceCol = 350;
    const totalCol = 450;

    doc.fontSize(10)
      .text('Item', itemCol, tableTop, { width: 200 })
      .text('Quantity', quantityCol, tableTop, { width: 100, align: 'right' })
      .text('Price', priceCol, tableTop, { width: 100, align: 'right' })
      .text('Total', totalCol, tableTop, { width: 100, align: 'right' });

    doc.moveTo(itemCol, tableTop + 20)
      .lineTo(totalCol + 100, tableTop + 20)
      .stroke();

    let i = 0;
    for (const item of order.items) {
      const itemY = tableTop + 30 + (i * 20);
      doc.fontSize(10)
        .text(`${item.meal.name} (${item.plan.name})`, itemCol, itemY, { width: 200 })
        .text(item.quantity, quantityCol, itemY, { width: 100, align: 'right' })
        .text(`$${item.itemTotalPrice / item.quantity}`, priceCol, itemY, { width: 100, align: 'right' })
        .text(`$${item.itemTotalPrice}`, totalCol, itemY, { width: 100, align: 'right' });
      i++;
    }

    doc.moveDown();
    doc.moveDown();

    // Total Amount
    doc.fontSize(16).text(`Total Amount: ₹${order.totalAmount}`, { align: 'right' });
    doc.moveDown();

    // Footer
    doc.fontSize(10).text('Thank you for your order!', { align: 'center' });

    doc.end(); // Finalize the PDF and end the stream

  return pdfPromise; // Resolve with the buffer
};

module.exports = {
  generateInvoicePdf,
};
