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
  auth: {
    user: MAIL_USER,
    pass: MAIL_PASS,
  },
  tls: {
    servername: SMTP_HOST,
  },
  connectionTimeout: 10000,
})

export const verifyEmail = async (token, email) => {
  const safeToken = encodeURIComponent(token)
  const verifyUrl = `${process.env.FRONTEND_URL.replace(/\/$/, '')}/verify/${safeToken}`

  const mailConfigurations = {
    from: MAIL_USER,
    to: email,
    subject: 'Email Verification',
    text: `Hi!\nPlease follow the given link to verify your email:\n${verifyUrl}\n\nThanks`,
  }

  // Try sending normally first, then fallback to resolving an IPv4 address and retry.
  try {
    const transporter = makeTransport(SMTP_HOST)
    try {
      await transporter.verify()
      console.log('verifyEmail: transporter ready')
    } catch (vErr) {
      console.warn('verifyEmail: transporter.verify() warning', vErr.message || vErr)
    }
    await transporter.sendMail(mailConfigurations)
    return true
  } catch (err) {
    console.error('verifyEmail: initial send failed', err.message || err)
    // If the failure looks like an IPv6/network issue, try resolving A record (IPv4) and retry
    try {
      const { address } = await dns.promises.lookup(SMTP_HOST, { family: 4 })
      console.log('verifyEmail: resolved IPv4', address, '— retrying send')
      const transporter2 = makeTransport(address)
      // ensure TLS SNI matches hostname
      transporter2.options = transporter2.options || {}
      transporter2.options.tls = transporter2.options.tls || {}
      transporter2.options.tls.servername = SMTP_HOST
      try {
        await transporter2.verify()
        console.log('verifyEmail: transporter2 ready')
      } catch (v2) {
        console.warn('verifyEmail: transporter2.verify() warning', v2.message || v2)
      }
      await transporter2.sendMail(mailConfigurations)
      return true
    } catch (err2) {
      console.error('verifyEmail: retry via IPv4 failed', err2.message || err2)
      return false
    }
  }
}

