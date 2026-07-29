import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { API_BASE_URL } from '@/lib/constants'

const Offers = () => {
  const [offers, setOffers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetch = async () => {
      setLoading(true)
      try {
        const res = await axios.get(`${API_BASE_URL}/api/v1/offers`)
        setOffers(res.data.offers || [])
      } catch (err) {
        setError(err?.response?.data?.message || err.message)
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [])

  if (loading) return <div className="p-8 text-center">Loading offers...</div>
  if (error) return <div className="p-8 text-center text-red-600">{error}</div>

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Offers</h1>
      {offers.length === 0 ? (
        <div className='flex flex-col justify-center items-center text-center'>
          <img src='error.png ' alt='error' className='h-full m-5'></img>
          <span className='text-[60px] text-red-600'>Oh No!</span>
          <p className='text-[20px] text-gray-400'>No active offers currently.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {offers.map((o) => (
            <div key={o._id} className="p-4 border rounded bg-white">
              <h2 className="font-semibold">{o.title} — {o.discountPercent}%</h2>
              <p className="text-sm text-gray-500 mt-1">{o.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Offers
