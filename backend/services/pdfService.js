const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

function formatCurrency(value) {
  return `₹${Number(value).toFixed(2)}`;
}

async function generateInvoicePdf(invoice, booking, user, provider, service, outputPath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const buffers = [];

    if (outputPath) {
      const directory = path.dirname(outputPath);
      if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
      }
      doc.pipe(fs.createWriteStream(outputPath));
    }

    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    doc.font('Helvetica');
    doc.fillColor('#0B2447');

    doc.rect(40, 40, 515, 80).fill('#0B2447');
    doc.fillColor('#ffffff').fontSize(24).text('Smart Service', 60, 55);
    doc.fontSize(10).text('Invoice', 60, 85);
    doc.fillColor('#ffffff').fontSize(10).text(`Invoice ID: ${invoice.invoice_number}`, 420, 55, { align: 'right' });
    doc.text(`Date: ${invoice.invoice_date}`, 420, 70, { align: 'right' });

    doc.moveDown(3);
    doc.fillColor('#0B2447').fontSize(16).text('Billing Details');
    doc.moveDown(0.5);

    const customerY = doc.y;
    doc.fontSize(10).fillColor('#333333').text(`Customer: ${user.name}`, 40, customerY);
    doc.text(`Email: ${user.email}`, 40);
    doc.text(`Phone: ${user.phone}`, 40);

    doc.text(`Provider: ${provider.name}`, 320, customerY);
    doc.text(`Service: ${service.title}`, 320);
    doc.text(`Payment Type: ${invoice.payment_method}`, 320);

    doc.moveDown(2);
    doc.fontSize(14).fillColor('#0B2447').text('Invoice Summary');
    doc.moveDown(0.5);

    const tableTop = doc.y;
    doc.fontSize(10);
    doc.text('Description', 40, tableTop);
    doc.text('Amount', 420, tableTop, { align: 'right' });
    doc.moveTo(40, tableTop + 15).lineTo(555, tableTop + 15).stroke('#e6e6e6');

    const itemY = tableTop + 25;
    doc.text(service.title, 40, itemY);
    doc.text(formatCurrency(invoice.amount), 420, itemY, { align: 'right' });

    doc.moveTo(40, itemY + 20).lineTo(555, itemY + 20).stroke('#e6e6e6');
    doc.fontSize(12).font('Helvetica-Bold').text('Total', 40, itemY + 30);
    doc.text(formatCurrency(invoice.amount), 420, itemY + 30, { align: 'right' });

    doc.moveDown(4);
    doc.fontSize(10).font('Helvetica').fillColor('#555555');
    doc.text('Thank you for choosing Smart Service. If you have questions about this invoice, contact our support team.');

    doc.end();
  });
}

module.exports = { generateInvoicePdf };