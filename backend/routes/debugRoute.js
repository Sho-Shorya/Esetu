import { Router } from 'express'
import { verifyEmail } from '../emailVerify/verifyEmail.js'

const router = Router()

// POST /debug/send-test-email
// body: { email }
router.post('/send-test-email', async (req, res) => {
  const { email } = req.body
  if (!email) return res.status(400).json({ success: false, message: 'email is required' })
  try {
    const token = 'debug-' + Date.now()
    const sent = await verifyEmail(token, email)
    if (sent) return res.json({ success: true, message: 'Test email sent' })
    return res.status(500).json({ success: false, message: 'Mailer reported failure' })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || String(err) })
  }
})

export default router
