const nodemailer = require('nodemailer');

// Create reusable transporter object using Gmail SMTP
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER, // Your Gmail address
      pass: process.env.SMTP_PASSWORD, // Your Gmail App Password
    },
  });
};

// Email template for payment confirmation
const getPaymentConfirmationEmailTemplate = (userName, planType, amount, currency, transactionId, reference, subscriptionExpiresAt) => {
  const planNames = {
    gold: 'Gold',
    diamond: 'Diamond',
    platinum: 'Platinum',
  };

  const planName = planNames[planType] || planType;
  const formattedAmount = `${amount} ${currency}`;
  const expiryDate = new Date(subscriptionExpiresAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return {
    subject: 'Payment Successful - 1Win Subscription',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Confirmation</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td align="center" style="padding: 40px 20px;">
              <table role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #3B82F6 0%, #1E40AF 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">Payment Successful!</h1>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                      Hello ${userName || 'Valued Customer'},
                    </p>
                    
                    <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                      We are pleased to confirm that your payment has been successfully processed.
                    </p>
                    
                    <!-- Payment Details Box -->
                    <table role="presentation" style="width: 100%; background-color: #f8f9fa; border-radius: 6px; padding: 20px; margin: 20px 0;">
                      <tr>
                        <td style="padding: 8px 0;">
                          <strong style="color: #1E40AF;">Plan Type:</strong>
                          <span style="color: #333333; margin-left: 10px;">${planName}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <strong style="color: #1E40AF;">Amount Paid:</strong>
                          <span style="color: #333333; margin-left: 10px;">${formattedAmount}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <strong style="color: #1E40AF;">Transaction ID:</strong>
                          <span style="color: #333333; margin-left: 10px; font-family: monospace;">${transactionId || 'N/A'}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <strong style="color: #1E40AF;">Reference:</strong>
                          <span style="color: #333333; margin-left: 10px; font-family: monospace;">${reference || 'N/A'}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <strong style="color: #1E40AF;">Subscription Expires:</strong>
                          <span style="color: #333333; margin-left: 10px;">${expiryDate}</span>
                        </td>
                      </tr>
                    </table>
                    
                    <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 30px 0 20px 0;">
                      Your subscription is now active and you can access all premium features.
                    </p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                      <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard" 
                         style="display: inline-block; background: linear-gradient(135deg, #3B82F6 0%, #1E40AF 100%); color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: bold; font-size: 16px;">
                        Go to Dashboard
                      </a>
                    </div>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8f9fa; padding: 20px 30px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e9ecef;">
                    <p style="color: #6c757d; font-size: 14px; margin: 0 0 10px 0;">
                      Thank you for choosing 1Win!
                    </p>
                    <p style="color: #6c757d; font-size: 12px; margin: 0;">
                      If you have any questions, please contact our support team.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    text: `
Payment Successful - 1Win Subscription

Hello ${userName || 'Valued Customer'},

We are pleased to confirm that your payment has been successfully processed.

Payment Details:
- Plan Type: ${planName}
- Amount Paid: ${formattedAmount}
- Transaction ID: ${transactionId || 'N/A'}
- Reference: ${reference || 'N/A'}
- Subscription Expires: ${expiryDate}

Your subscription is now active and you can access all premium features.

Thank you for choosing 1Win!
    `,
  };
};

// Send payment confirmation email
const sendPaymentConfirmationEmail = async (userEmail, userName, planType, amount, currency, transactionId, reference, subscriptionExpiresAt) => {
  try {
    // Check if email is provided
    if (!userEmail) {
      console.log('No email address provided for user, skipping email notification');
      return { success: false, message: 'No email address' };
    }

    const transporter = createTransporter();
    const emailContent = getPaymentConfirmationEmailTemplate(
      userName,
      planType,
      amount,
      currency,
      transactionId,
      reference,
      subscriptionExpiresAt
    );

    const mailOptions = {
      from: `"1Win" <${process.env.SMTP_USER}>`,
      to: userEmail,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Payment confirmation email sent:', info.messageId);
    
    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error('Error sending payment confirmation email:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

module.exports = {
  sendPaymentConfirmationEmail,
  createTransporter,
};
