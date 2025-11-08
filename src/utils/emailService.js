const nodemailer = require("nodemailer");

// Configure the email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  pool: true,              // Enable connection pooling
  maxConnections: 5,       // Limit concurrent connections
  maxMessages: 100,        // Messages per connection
  rateDelta: 1000,         // Time between messages (ms)
  rateLimit: 5             // Max emails per rateDelta
});

// Function to send an email
const sendEmail = async (
  to,
  subject,
  textContent,
  htmlContent,
  attachments = []
) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to,
      subject,
      text: textContent, // Use 'text' for plain text content
      html: htmlContent, // Use 'html' for HTML content
      attachments,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(
      `Email sent to ${to} with subject: ${subject}. Message ID: ${info.messageId}, Accepted: ${info.accepted}, Rejected: ${info.rejected}`
    );
  } catch (error) {
    console.error(
      `Error sending email to ${to} with subject "${subject}":`,
      error
    );
    // Re-throw the error to be handled by the caller
    throw new Error(`Failed to send email to ${to}: ${error.message}`);
  }
};

module.exports = {
  sendEmail,
};
