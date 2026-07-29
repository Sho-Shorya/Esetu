import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { API_BASE_URL } from '@/lib/constants'

const Categories = () => {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetch = async () => {
      setLoading(true)
      try {
        const res = await axios.get(`${API_BASE_URL}/api/v1/categories`)
        setCategories(res.data.categories || [])
      } catch (err) {
        setError(err?.response?.data?.message || err.message)
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [])

  if (loading) return <div className="p-8 text-center">Loading categories...</div>
  if (error) return <div className="p-8 text-center text-red-600">{error}</div>

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Categories</h1>
      {categories.length === 0 ? (
        <div>No categories found.</div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {categories.map((c) => (
            <div key={c._id} className="p-4 border rounded bg-white">
              <h2 className="font-semibold">{c.name}</h2>
              <p className="text-sm text-gray-500 mt-1">{c.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Categories
