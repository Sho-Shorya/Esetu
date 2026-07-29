import nodemailer from "nodemailer"
import "dotenv/config"
import dns from "dns"

const SMTP_HOST = 'smtp.gmail.com'
const MAIL_USER = process.env.MAIL_USER?.trim()
const MAIL_PASS = process.env.MAIL_PASS?.replace(/\s+/g, '')

const makeTransport = (host) => nodemailer.createTransport({
  host,
  port: 587,
  secure: false,
  requireTLS: true,
  auth: { user: MAIL_USER, pass: MAIL_PASS },
  tls: { servername: SMTP_HOST },
  connectionTimeout: 10000,
})

const buildOrderHtml = (firstName, orderItems, orderTotal) => {
  const rows = orderItems.map((item) => `
    <tr>
      <td style="padding: 8px; border: 1px solid #e5e7eb;">${item.name}</td>
      <td style="padding: 8px; border: 1px solid #e5e7eb; text-align:center;">${item.quantity}</td>
      <td style="padding: 8px; border: 1px solid #e5e7eb; text-align:right;">₹${item.price}</td>
      <td style="padding: 8px; border: 1px solid #e5e7eb; text-align:right;">₹${item.total}</td>
    </tr>
  `).join('')

  return `
    <div style="font-family: Arial, sans-serif; color: #111827;">
      <h1 style="color: #111827;">Thank you for your order, ${firstName}!</h1>
      <p>Your order has been placed successfully. Below are your order details:</p>
      <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
        <thead>
          <tr>
            <th style="padding: 8px; border: 1px solid #e5e7eb; text-align:left; background:#f3f4f6;">Product</th>
            <th style="padding: 8px; border: 1px solid #e5e7eb; text-align:center; background:#f3f4f6;">Qty</th>
            <th style="padding: 8px; border: 1px solid #e5e7eb; text-align:right; background:#f3f4f6;">Price</th>
            <th style="padding: 8px; border: 1px solid #e5e7eb; text-align:right; background:#f3f4f6;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
      <p style="margin-top: 20px; font-size: 16px; font-weight: 600;">Order total: ₹${orderTotal}</p>
      <p>If you have any questions, reply to this email and we'll help you.</p>
      <p style="margin-top: 24px;">Warm regards,<br />Team Ekart</p>
    </div>
  `
}

export const sendOrderEmail = async (email, firstName, orderItems, orderTotal) => {
  const mailConfigurations = {
    from: MAIL_USER,
    to: email,
    subject: 'Thank you for your order from Ekart!',
    html: buildOrderHtml(firstName, orderItems, orderTotal),
  }

  try {
    const transporter = makeTransport(SMTP_HOST)
    try { await transporter.verify() } catch (v) { console.warn('sendOrderEmail: transporter.verify warning', v.message || v) }
    await transporter.sendMail(mailConfigurations)
    return true
  } catch (err) {
    console.error('sendOrderEmail: initial send failed', err.message || err)
    try {
      const { address } = await dns.promises.lookup(SMTP_HOST, { family: 4 })
      const transporter2 = makeTransport(address)
      transporter2.options = transporter2.options || {}
      transporter2.options.tls = transporter2.options.tls || {}
      transporter2.options.tls.servername = SMTP_HOST
      try { await transporter2.verify() } catch (v2) { console.warn('sendOrderEmail: transporter2.verify warning', v2.message || v2) }
      await transporter2.sendMail(mailConfigurations)
      return true
    } catch (err2) {
      console.error('sendOrderEmail: retry via IPv4 failed', err2.message || err2)
      return false
    }
  }
}
