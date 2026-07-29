import axios from 'axios'
import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { API_BASE_URL } from '@/lib/constants'

/* eslint-disable react-hooks/set-state-in-effect */

const VerifyEmail = () => {
  const { token } = useParams()
  const [status, setStatus] = useState('Verifying...')
  const navigate = useNavigate()

  const verifyEmail = useCallback(async () => {
    try {
      const rawToken = token ? decodeURIComponent(token) : token
      const res = await axios.post(`${API_BASE_URL}/api/v1/user/verify`, {}, {
        headers: {
          Authorization: `Bearer ${rawToken}`
        }
      })
      if (res.data.success) {
        setStatus("✅ Email Verified Successfully")
        setTimeout(() => {
          navigate("/login")
        }, 2000);
      }

    } catch {
      // Removed console.log for production
      setStatus("❌ Verification failed, Please try again")

    }
  }, [token, navigate])

  useEffect(() => {
    verifyEmail()
  }, [verifyEmail])
  return (
    <div className='relative w-full h-[760px] bg-emerald-100 overflow-hidden'>
      <div className='min-h-screen flex items-center justify-center'>
        <div className='bg-white p-6 rounded-2xl shadow-md text-center w-[90%] max-w-md'>
          <h2 className='text-xl font-semibold text-gray-800'>
            {status}
          </h2>
        </div>
      </div>
    </div>
  )
}

export default VerifyEmail