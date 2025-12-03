const { TransactionalEmailsApi, SendSmtpEmail, TransactionalEmailsApiApiKeys } = require("@getbrevo/brevo");

// Brevo API initialization
const brevoEmailAPI = new TransactionalEmailsApi();

if (process.env.BREVO_API_KEY) {
  try {
    // Method 1: Using setApiKey (preferred method)
    brevoEmailAPI.setApiKey(TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);
    console.log('Brevo API configured successfully');
  } catch (authError) {
    console.error('setApiKey failed, trying alternative method:', authError);
    // Method 2: Direct property access (fallback)
    brevoEmailAPI.authentications = {
      apiKey: {
        apiKey: process.env.BREVO_API_KEY
      }
    };
  }
} else {
  console.warn(
    "Brevo API is not configured. Please set BREVO_API_KEY environment variable."
  );
}

const sendEmail = async (
  to,
  subject,
  textContent,
  htmlContent,
  attachments = []
) => {
  const brevoFromEmail = process.env.BREVO_FROM_EMAIL || "noreply@aharraa.com";
  const brevoFromName = process.env.BREVO_FROM_NAME || "Aharraa";

  if (!process.env.BREVO_API_KEY) {
    throw new Error(`Failed to send email to ${to}: BREVO_API_KEY is not configured`);
  }

  try {
    const sendSmtpEmail = new SendSmtpEmail();
    sendSmtpEmail.sender = { email: brevoFromEmail, name: brevoFromName };
    sendSmtpEmail.to = [{ email: to }];
    sendSmtpEmail.subject = subject;
    sendSmtpEmail.textContent = textContent;
    sendSmtpEmail.htmlContent = htmlContent;

    // Only add attachment field if there are attachments
    if (attachments && attachments.length > 0) {
      sendSmtpEmail.attachment = attachments.map((attachment) => ({
        content: attachment.content.toString("base64"),
        name: attachment.filename,
      }));
    }

    const result = await brevoEmailAPI.sendTransacEmail(sendSmtpEmail);
    console.log(`Email sent successfully via Brevo to ${to} with subject: ${subject}`);
    console.log('Brevo Response:', result);
    return result;
  } catch (brevoError) {
    console.error(
      `Error sending email via Brevo to ${to} with subject "${subject}":`,
      brevoError.message
    );
    
    // Log detailed error information
    if (brevoError.response) {
      console.error("Brevo API Status Code:", brevoError.response.status);
      console.error("Brevo API Error Details:", brevoError.response.data || brevoError.response.body);
    }
    
    throw new Error(`Failed to send email to ${to} via Brevo: ${brevoError.message}`);
  }
};

module.exports = {
  sendEmail,
};