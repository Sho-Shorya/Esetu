import { ShoppingCart } from 'lucide-react';
import React from 'react'
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { setCart } from '../redux/ProductSlice';
import { API_BASE_URL } from '@/lib/constants';

const ProductCard = ({ product, loading }) => {
    const { productImg, productPrice, productName } = product
    const accessToken = localStorage.getItem('accessToken')
    const dispatch = useDispatch()
    const navigate = useNavigate()
    const [isAdding, setIsAdding] = React.useState(false)

    const addToCart = async(productId)=>{
        if (!accessToken) {
            toast.error('Please login to add products to cart');
            navigate('/login');
            return;
        }
        setIsAdding(true)
        try {
            const res = await axios.post(`${API_BASE_URL}/api/v1/cart/add-cart`, { productId }, {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            })
            if (res.data.success) {
                toast.success(res.data.message || "Product added to cart")
                dispatch(setCart(res.data.cart || { items: [] }))
                localStorage.setItem('cart', JSON.stringify(res.data.cart?.items || []))
            } else {
                toast.error(res.data.message || 'Unable to add to cart')
            }
        } catch (error) {
            console.error(error)
            toast.error(error.response?.data?.message || 'Failed to add product to cart')
        } finally {
            setIsAdding(false)
        }
    }
    return (
        <div className='flex h-full flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition-shadow duration-200 hover:shadow-md sm:shadow-lg'>
            <div className='aspect-square w-full overflow-hidden bg-gray-50'>
                {
                    loading ? <Skeleton className='h-full w-full rounded-none bg-gray-300' /> : <img src={productImg[0]?.url} alt={productName} className='h-full w-full object-cover transition-transform duration-300 hover:scale-105 cursor-pointer' />

                }
            </div>
            {
                loading ? <div className='space-y-2 px-3 py-3 sm:px-4'>
                    <Skeleton className='h-4 w-full' />
                    <Skeleton className='h-4 w-24' />
                    <Skeleton className='h-9 w-full' />
                </div> :
                    <div className='flex flex-1 flex-col gap-2 px-3 py-3 sm:px-4 sm:py-4'>
                        <h1 className='min-h-[2.5rem] text-sm font-semibold leading-5 text-gray-800 line-clamp-2 sm:text-base'>
                            {productName}
                        </h1>
                        <h2 className='text-lg font-bold text-emerald-700'>
                            ₹{productPrice}
                        </h2>
                        <Button 
                            onClick={()=> (addToCart(product._id))} 
                            disabled={isAdding}
                            className={`mt-auto flex w-full items-center justify-center gap-2 rounded-lg bg-pink-600 py-2 text-sm font-medium sm:py-2.5 transition-all duration-300 ${
                                isAdding ? 'opacity-75 scale-95 animate-pulse' : 'hover:scale-105 active:scale-95'
                            }`}
                        >
                            <ShoppingCart className={`h-4 w-4 transition-transform ${
                                isAdding ? 'animate-bounce' : ''
                            }`} />
                            {isAdding ? 'Adding...' : 'Add to Cart'}
                        </Button>
                    </div>
            }
        </div>
    )
}
export default ProductCard;