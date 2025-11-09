const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);
// sgMail.setDataResidency('eu'); // uncomment the above line if you are sending mail using a regional EU subuser

// Function to send an email
const sendEmail = async (
  to,
  subject,
  textContent,
  htmlContent,
  attachments = []
) => {
  try {
    const msg = {
      to,
      from: process.env.SENDGRID_FROM_EMAIL, // Use a verified sender email
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
    console.log(`Email sent to ${to} with subject: ${subject}`);
  } catch (error) {
    console.error(
      `Error sending email to ${to} with subject "${subject}":`,
      error.response ? error.response.body.errors : error
    );
    // Re-throw the error to be handled by the caller
    throw new Error(`Failed to send email to ${to}: ${error.message}`);
  }
};

module.exports = {
  sendEmail,
};
