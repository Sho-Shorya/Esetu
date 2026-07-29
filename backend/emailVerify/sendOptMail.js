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

export const sendOptMail = async (otp, email) => {
  const mailConfigurations = {
    from: MAIL_USER,
    to: email,
    subject: 'Password reset otp',
    html: `<p>Your OTP for password reset is <b>${otp}</b></p>`,
  }

  try {
    const transporter = makeTransport(SMTP_HOST)
    try { await transporter.verify(); console.log('sendOptMail: transporter ready') } catch (v) { console.warn('sendOptMail: transporter.verify warning', v.message || v) }
    await transporter.sendMail(mailConfigurations)
    return true
  } catch (err) {
    console.error('sendOptMail: initial send failed', err.message || err)
    try {
      const { address } = await dns.promises.lookup(SMTP_HOST, { family: 4 })
      console.log('sendOptMail: resolved IPv4', address, '— retrying send')
      const transporter2 = makeTransport(address)
      transporter2.options = transporter2.options || {}
      transporter2.options.tls = transporter2.options.tls || {}
      transporter2.options.tls.servername = SMTP_HOST
      try { await transporter2.verify(); console.log('sendOptMail: transporter2 ready') } catch (v2) { console.warn('sendOptMail: transporter2.verify warning', v2.message || v2) }
      await transporter2.sendMail(mailConfigurations)
      return true
    } catch (err2) {
      console.error('sendOptMail: retry via IPv4 failed', err2.message || err2)
      return false
    }
  }
}

