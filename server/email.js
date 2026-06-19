const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function sendPlanEmail(to, toName, fromEmail, message, bidDueDate, projectName, attachments) {
  const dueDateFormatted = bidDueDate
    ? new Date(bidDueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'TBD';

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #0f172a; padding: 24px; border-radius: 8px 8px 0 0;">
        <h1 style="color: #f97316; margin: 0; font-size: 24px;">🚀 Rocket Fuel</h1>
        <p style="color: #94a3b8; margin: 4px 0 0;">Construction Bid Management</p>
      </div>
      <div style="background: #ffffff; padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
        <h2 style="color: #0f172a; margin-top: 0;">Plans Available: ${projectName}</h2>
        <div style="background: #fff7ed; border-left: 4px solid #f97316; padding: 16px; margin-bottom: 24px; border-radius: 0 4px 4px 0;">
          <strong style="color: #c2410c;">Bids Due: ${dueDateFormatted}</strong>
        </div>
        <p style="color: #374151; line-height: 1.6;">${message.replace(/\n/g, '<br>')}</p>
        <p style="color: #374151; line-height: 1.6;">
          Plans are attached to this email. Please review and submit your bid by the due date above.
        </p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
        <p style="color: #6b7280; font-size: 14px;">
          Questions? Reply to this email to reach ${fromEmail}.
        </p>
      </div>
    </div>
  `;

  const msg = {
    to: { email: to, name: toName },
    from: {
      email: process.env.SENDGRID_FROM_EMAIL,
      name: 'Rocket Fuel',
    },
    replyTo: fromEmail,
    subject: `Plans Available: ${projectName} — Bids Due ${dueDateFormatted}`,
    html: htmlBody,
    text: `Plans Available: ${projectName}\n\nBids Due: ${dueDateFormatted}\n\n${message}\n\nPlans are attached. Reply to this email to reach ${fromEmail}.`,
    attachments: attachments.map((a) => ({
      content: a.content.toString('base64'),
      filename: a.filename,
      type: 'application/octet-stream',
      disposition: 'attachment',
    })),
  };

  return sgMail.send(msg);
}

module.exports = { sendPlanEmail };
