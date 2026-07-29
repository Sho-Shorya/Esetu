import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { setCart } from '@/redux/ProductSlice'
import { API_BASE_URL } from '@/lib/constants'

const Cart = () => {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { cart } = useSelector((store) => store.product || { cart: { items: [] } })
  const [loading, setLoading] = useState(false)
  const [updatingId, setUpdatingId] = useState(null)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutMessage, setCheckoutMessage] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const items = cart?.items || []
  const totalPrice = items.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 0), 0)
  const accessToken = localStorage.getItem('accessToken')

  const getProductImageUrl = (item) => {
    // Primary source: populated productId with productImg array
    if (item?.productId?.productImg?.[0]?.url) {
      return item.productId.productImg[0].url
    }
    // Fallback for direct productImg structure
    if (item?.productImg?.[0]?.url) {
      return item.productImg[0].url
    }
    // Fallback for old image format
    if (item?.productId?.image) {
      return item.productId.image
    }
    if (item?.image) {
      return item.image
    }
    return null
  }

  const syncCart = (newCart) => {
    const normalizedCart = newCart || { items: [] }
    dispatch(setCart(normalizedCart))
    localStorage.setItem('cart', JSON.stringify(normalizedCart.items || []))
  }

  const fetchCart = async (suppressLoading = false) => {
    if (!accessToken) return
    if (!suppressLoading) setLoading(true)
    try {
      const res = await axios.get(`${API_BASE_URL}/api/v1/cart`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      if (res.data.success) {
        syncCart(res.data.cart)
      }
    } catch (error) {
      console.error('Fetch cart failed', error)
      toast.error(error.response?.data?.message || 'Unable to load cart')
    } finally {
      if (!suppressLoading) setLoading(false)
    }
  }

  useEffect(() => {
    fetchCart()
  }, [])

  const updateQuantity = async (productId, type) => {
    if (!accessToken) {
      toast.error('Please login to update cart.')
      return
    }
    setUpdatingId(productId)
    try {
      const res = await axios.put(`${API_BASE_URL}/api/v1/cart/update-cart`, { productId, type }, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      if (res.data.success) {
        await fetchCart(true)
      } else {
        toast.error(res.data.message || 'Unable to update quantity')
      }
    } catch (error) {
      console.error('Update cart failed', error)
      toast.error(error.response?.data?.message || 'Unable to update quantity')
    } finally {
      setUpdatingId(null)
    }
  }

  const removeItem = async (productId) => {
    if (!accessToken) {
      toast.error('Please login to remove items.')
      return
    }
    setUpdatingId(productId)
    try {
      const res = await axios.delete(`${API_BASE_URL}/api/v1/cart/remove-cart`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: { productId }
      })
      if (res.data.success) {
        await fetchCart(true)
        toast.success('Item removed from cart')
      } else {
        toast.error(res.data.message || 'Unable to remove item')
      }
    } catch (error) {
      console.error('Remove cart item failed', error)
      toast.error(error.response?.data?.message || 'Unable to remove item')
    } finally {
      setUpdatingId(null)
    }
  }

  const handleCheckout = async () => {
    if (!accessToken) {
      toast.error('Please login to checkout.')
      return
    }
    setCheckoutLoading(true)
    try {
      const res = await axios.post(`${API_BASE_URL}/api/v1/cart/checkout`, {}, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      if (res.data.success) {
        syncCart(res.data.cart)
        setCheckoutMessage(res.data.message || 'Your order has been placed successfully!')
        setModalOpen(true)
        toast.success(res.data.message || 'Order placed successfully')
      } else {
        toast.error(res.data.message || 'Unable to complete checkout')
      }
    } catch (error) {
      console.error('Checkout failed', error)
      toast.error(error.response?.data?.message || 'Checkout failed')
    } finally {
      setCheckoutLoading(false)
    }
  }

  if (!accessToken) {
    return (
      <div className='mt-20 mx-auto max-w-4xl p-4 sm:mt-24 sm:p-6'>
        <h1 className='mb-4 text-2xl font-bold sm:text-4xl'>Your Cart</h1>
        <p className='text-gray-600'>Please login to view and manage your cart.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className='mt-20 mx-auto max-w-4xl p-4 text-center sm:mt-24 sm:p-6'>
        <p className='text-lg text-gray-600'>Loading cart...</p>
      </div>
    )
  }

  const showModal = modalOpen
  const closeModal = () => {
    setModalOpen(false)
    navigate('/')
  }

  if (!items.length && !showModal) {
    return (
      <div className='mt-20 mx-auto max-w-4xl p-4 sm:mt-24 sm:p-6'>
        <h1 className='mb-4 text-2xl font-bold sm:text-4xl'>Your Cart</h1>
        <p className='text-gray-600'>Your cart is empty. Add a product to see it here.</p>
      </div>
    )
  }

  return (
    <div className='mt-20 mx-auto max-w-6xl p-4 sm:mt-24 sm:p-6'>
      <div className='flex flex-col gap-4 sm:gap-6'>
        <div className='rounded-3xl bg-white p-4 shadow-sm sm:p-6'>
          <h1 className='mb-2 text-2xl font-bold sm:text-4xl'>Your Cart</h1>
          <p className='text-sm text-gray-500'>Manage cart items, adjust quantities and remove products before checkout.</p>
        </div>

        <div className='grid gap-4 sm:gap-6 lg:grid-cols-[1.9fr_1fr]'>
          <div className='space-y-4'>
            {items.map((item) => {
              const productId = item.productId?._id || item.productId
              const imageUrl = getProductImageUrl(item)
              return (
                <div key={productId} className='rounded-3xl border bg-white p-4 shadow-sm sm:p-5'>
                  <div className='flex flex-col gap-4 lg:flex-row'>
                    <div className='h-30 w-full rounded-2xl bg-gray-100 sm:h-36 sm:w-44'>
                      {imageUrl ? (
                        <img src={imageUrl} alt={item.productId?.productName || 'Cart item'} className='h-full w-full object-scale-down' />
                      ) : (
                        <div className='flex h-full w-full items-center justify-center bg-gray-200 text-sm text-gray-500'>No image</div>
                      )}
                    </div>
                    <div className='flex-1'>
                      <div className='flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-start lg:justify-between'>
                        <div>
                          <h2 className='text-lg font-semibold sm:text-xl'>{item.productId?.productName || 'Product'}</h2>
                          <p className='mt-2 text-sm text-gray-500 line-clamp-3'>{item.productId?.productDesc || 'No description available.'}</p>
                        </div>
                        <div className='text-left sm:text-right'>
                          <p className='text-xl font-bold sm:text-2xl'>₹{(item.price || 0) * (item.quantity || 0)}</p>
                          <p className='text-sm text-gray-500'>₹{item.price || 0} each</p>
                        </div>
                      </div>

                      <div className='mt-4 flex flex-col gap-3 sm:mt-5 sm:flex-row sm:items-center sm:justify-between'>
                        <div className='flex items-center justify-center gap-2 rounded-full border border-gray-200 bg-gray-50 p-1 sm:justify-start'>
                          <Button
                            onClick={() => updateQuantity(productId, 'decrease')}
                            className='h-9 w-9 rounded-full bg-white text-xl text-gray-700 hover:bg-gray-100 sm:h-10 sm:w-10'
                            disabled={item.quantity <= 1 || updatingId === productId}
                          >
                            -
                          </Button>
                          <span className='min-w-[2.5rem] text-center text-base font-semibold sm:text-lg'>{item.quantity}</span>
                          <Button
                            onClick={() => updateQuantity(productId, 'increase')}
                            className='h-9 w-9 rounded-full bg-white text-xl text-gray-700 hover:bg-gray-100 sm:h-10 sm:w-10'
                            disabled={updatingId === productId}
                          >
                            +
                          </Button>
                        </div>
                        <div className='flex flex-col gap-2 sm:flex-row'>
                          <Button
                            variant='destructive'
                            onClick={() => removeItem(productId)}
                            disabled={updatingId === productId}
                            className='w-full sm:w-auto'
                          >
                            Remove
                          </Button>
                          <Button
                            variant='outline'
                            onClick={() => toast.success('Saved for later feature coming soon')}
                            className='w-full sm:w-auto'
                          >
                            Save for later
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <aside className='space-y-4'>
            <div className='rounded-3xl border bg-white p-4 shadow-sm sm:p-6'>
              <h2 className='mb-3 text-xl font-semibold sm:text-2xl'>Order Summary</h2>
              <div className='space-y-3 text-sm text-gray-600'>
                <div className='flex items-center justify-between'>
                  <span>Subtotal</span>
                  <span>₹{totalPrice}</span>
                </div>
                <div className='flex items-center justify-between'>
                  <span>Items</span>
                  <span>{items.length}</span>
                </div>
                <div className='flex items-center justify-between'>
                  <span>Shipping</span>
                  <span>Calculated at checkout</span>
                </div>
              </div>
            </div>

            <div className='space-y-3 rounded-3xl border bg-white p-4 shadow-sm sm:p-6'>
              <Button onClick={handleCheckout} disabled={checkoutLoading} className='w-full py-3 text-base sm:py-4 sm:text-lg'>
                {checkoutLoading ? 'Processing...' : 'Proceed to Checkout'}
              </Button>
              <Button variant='outline' onClick={() => navigate('/')} className='w-full py-3 sm:py-4'>Continue Shopping</Button>
            </div>
          </aside>
        </div>
      </div>

      {showModal ? (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-8'>
          <div className='w-full max-w-xl rounded-[32px] border border-white/10 bg-white p-8 shadow-2xl backdrop-blur-lg transition-all duration-300 ease-out'>
            <div className='flex flex-col items-center gap-4 text-center'>
              <div className='flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-5xl animate-pulse'>🎉</div>
              <h2 className='text-3xl font-bold'>Thank you for your order!</h2>
              <p className='max-w-xl text-sm text-gray-600'>
                {checkoutMessage} A confirmation email has been sent to your registered email address.
              </p>
              <div className='grid w-full gap-3 sm:grid-cols-2'>
                <Button onClick={closeModal} className='w-full py-4'>Continue Shopping</Button>
                <Button variant='outline' onClick={closeModal} className='w-full py-4'>Close</Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default Cart