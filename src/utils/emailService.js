const sgMail = require('@sendgrid/mail');
const nodemailer = require('nodemailer');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Nodemailer transporter setup for Gmail fallback
const createNodemailerTransporter = () => {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
    console.warn("Nodemailer (Gmail) fallback is not fully configured. Please set GMAIL_USER and GMAIL_PASS environment variables.");
    return null;
  }
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
  });
};

let nodemailerTransporter = createNodemailerTransporter();

// Function to send an email
const sendEmail = async (
  to,
  subject,
  textContent,
  htmlContent,
  attachments = []
) => {
  const sendgridFromEmail = process.env.SENDGRID_FROM_EMAIL;
  const gmailFromEmail = process.env.GMAIL_USER || "info.aharraa@gmail.com";

  // Try SendGrid first
  if (sendgridFromEmail && process.env.SENDGRID_API_KEY) {
    try {
      const msg = {
        to,
        from: sendgridFromEmail,
        subject,
        text: textContent,
        html: htmlContent,
        attachments: attachments.map(attachment => ({
          content: attachment.content.toString('base64'),
          filename: attachment.filename,
          type: attachment.contentType,
          disposition: 'attachment',
          contentId: attachment.cid,
        })),
      };

      await sgMail.send(msg);
      console.log(`Email sent via SendGrid to ${to} with subject: ${subject}`);
      return; // Email sent successfully via SendGrid
    } catch (sendgridError) {
      console.error(
        `Error sending email via SendGrid to ${to} with subject "${subject}":`,
        sendgridError.response ? sendgridError.response.body.errors : sendgridError
      );
      console.warn("Attempting to send email via Nodemailer (Gmail) fallback...");
    }
  } else {
    console.warn("SendGrid is not fully configured (missing SENDGRID_FROM_EMAIL or SENDGRID_API_KEY). Attempting Nodemailer (Gmail) fallback...");
  }

  // Fallback to Nodemailer (Gmail)
  if (nodemailerTransporter && gmailFromEmail) {
    try {
      const mailOptions = {
        from: gmailFromEmail,
        to,
        subject,
        text: textContent,
        html: htmlContent,
        attachments: attachments.map(attachment => ({
          content: attachment.content, // Nodemailer expects Buffer or string, not base64 string
          filename: attachment.filename,
          contentType: attachment.contentType,
          cid: attachment.cid,
        })),
      };
      await nodemailerTransporter.sendMail(mailOptions);
      console.log(`Email sent via Nodemailer (Gmail) to ${to} with subject: ${subject}`);
      return; // Email sent successfully via Nodemailer
    } catch (nodemailerError) {
      console.error(
        `Error sending email via Nodemailer (Gmail) to ${to} with subject "${subject}":`,
        nodemailerError
      );
      throw new Error(`Failed to send email to ${to} via Nodemailer: ${nodemailerError.message}`);
    }
  } else {
    throw new Error(`Failed to send email to ${to}: No configured email service could send the email.`);
  }
};

module.exports = {
  sendEmail,
};
