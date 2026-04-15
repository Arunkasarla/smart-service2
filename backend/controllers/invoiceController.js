const path = require('path');
const fs = require('fs');
const db = require('../database');
const { generateInvoicePdf } = require('../services/pdfService');
const { sendInvoiceEmail } = require('../services/emailService');
const { sendInvoiceSms } = require('../services/smsService');

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

async function loadBookingForInvoice(bookingId) {
  const sql = `
    SELECT b.*, s.title AS service_title, s.price AS service_price,
      u.name AS customer_name, u.email AS customer_email, u.phone AS customer_phone,
      p.name AS provider_name, p.email AS provider_email, p.phone AS provider_phone
    FROM bookings b
    LEFT JOIN services s ON b.service_id = s.id
    LEFT JOIN users u ON b.user_id = u.id
    LEFT JOIN users p ON b.provider_id = p.id
    WHERE b.id = ?
  `;

  const booking = await dbGet(sql, [bookingId]);
  if (!booking) {
    throw new Error('Booking not found');
  }

  return booking;
}

async function getInvoiceRecord(bookingId) {
  return dbGet(`SELECT * FROM invoices WHERE booking_id = ?`, [bookingId]);
}

async function ensureInvoiceDirectory() {
  const invoiceDirectory = path.resolve(__dirname, '..', 'uploads', 'invoices');
  if (!fs.existsSync(invoiceDirectory)) {
    fs.mkdirSync(invoiceDirectory, { recursive: true });
  }
  return invoiceDirectory;
}

async function createInvoiceForBooking(bookingId) {
  const booking = await loadBookingForInvoice(bookingId);
  const existingInvoice = await getInvoiceRecord(bookingId);
  if (existingInvoice) {
    return existingInvoice;
  }

  const invoiceNumber = `INV-${Date.now()}-${bookingId}`;
  const invoiceDate = new Date().toISOString();
  const amount = Number(booking.service_price || 0);
  const payment_method = booking.payment_method || 'cash';

  const invoiceDirectory = await ensureInvoiceDirectory();
  const invoiceFilename = `invoice_${invoiceNumber}.pdf`;
  const invoiceFilePath = path.join(invoiceDirectory, invoiceFilename);
  const invoicePdfUrl = `uploads/invoices/${invoiceFilename}`;

  await generateInvoicePdf(
    {
      invoice_number: invoiceNumber,
      invoice_date: invoiceDate,
      amount,
      payment_method,
    },
    booking,
    {
      name: booking.customer_name,
      email: booking.customer_email,
      phone: booking.customer_phone,
    },
    {
      name: booking.provider_name,
      email: booking.provider_email,
      phone: booking.provider_phone,
    },
    {
      title: booking.service_title || 'Service',
      price: amount,
    },
    invoiceFilePath
  );

  const insertSql = `
    INSERT INTO invoices (
      booking_id,
      user_id,
      provider_id,
      service_id,
      invoice_number,
      amount,
      payment_method,
      invoice_date,
      pdf_path
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  await dbRun(insertSql, [
    bookingId,
    booking.user_id,
    booking.provider_id,
    booking.service_id,
    invoiceNumber,
    amount,
    payment_method,
    invoiceDate,
    invoicePdfUrl,
  ]);

  const invoice = await getInvoiceRecord(bookingId);
  if (!invoice) {
    throw new Error('Failed to create invoice record');
  }

  const emailText = `Your Smart Service invoice ${invoice.invoice_number} for ₹${amount.toFixed(2)} is ready.`;
  try {
    if (booking.customer_email) {
      await sendInvoiceEmail({
        to: booking.customer_email,
        subject: `Your Smart Service Invoice ${invoice.invoice_number}`,
        text: emailText,
        attachments: [
          {
            filename: invoiceFilename,
            path: invoiceFilePath,
          },
        ],
      });
    }
  } catch (emailErr) {
    console.error('Invoice email failed:', emailErr.message || emailErr);
  }

  try {
    if (booking.customer_phone) {
      await sendInvoiceSms(booking.customer_phone, emailText);
    }
  } catch (smsErr) {
    console.error('Invoice SMS failed:', smsErr.message || smsErr);
  }

  return invoice;
}

async function getInvoiceByBookingId(req, res) {
  try {
    const bookingId = Number(req.params.bookingId);
    if (!bookingId) {
      return res.status(400).json({ message: 'Invalid booking ID' });
    }

    let invoice = await getInvoiceRecord(bookingId);
    if (!invoice) {
      invoice = await createInvoiceForBooking(bookingId);
    }

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    if (req.user.role === 'user' && invoice.user_id !== req.user.id) {
      return res.status(403).json({ message: 'You are not authorized to view this invoice' });
    }

    res.json(invoice);
  } catch (error) {
    console.error('getInvoiceByBookingId error:', error);
    res.status(500).json({ message: 'Failed to retrieve invoice', error: error.message });
  }
}

async function getInvoiceDownload(req, res) {
  try {
    const bookingId = Number(req.params.bookingId);
    if (!bookingId) {
      return res.status(400).json({ message: 'Invalid booking ID' });
    }

    let invoice = await getInvoiceRecord(bookingId);
    if (!invoice) {
      invoice = await createInvoiceForBooking(bookingId);
    }

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    if (req.user.role === 'user' && invoice.user_id !== req.user.id) {
      return res.status(403).json({ message: 'You are not authorized to download this invoice' });
    }

    const pdfPath = path.resolve(__dirname, '..', invoice.pdf_path);
    if (!fs.existsSync(pdfPath)) {
      await createInvoiceForBooking(bookingId);
    }

    if (!fs.existsSync(pdfPath)) {
      return res.status(404).json({ message: 'Invoice file not found' });
    }

    res.download(pdfPath, `${invoice.invoice_number}.pdf`, (err) => {
      if (err) {
        console.error('Invoice file download failed:', err);
        if (!res.headersSent) {
          res.status(500).json({ message: 'Failed to download invoice file' });
        }
      }
    });
  } catch (error) {
    console.error('getInvoiceDownload error:', error);
    res.status(500).json({ message: 'Failed to download invoice', error: error.message });
  }
}

module.exports = {
  createInvoiceForBooking,
  getInvoiceByBookingId,
  getInvoiceDownload,
};
