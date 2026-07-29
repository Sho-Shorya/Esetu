import React from 'react'
import { Button } from './ui/button'
import { Link, Navigate } from 'react-router-dom'
const Hero = () => {
  return (
    <section className='bg-gradient-to-r from-blue-600 to-purple-600 text-white py-12'>
      <div className='max-w-6xl mx-auto py-8 px-4'>
        <div className='grid lg:grid-cols-2 gap-8 items-center'>
          <div>
            <h1 className='text-3xl sm:text-4xl md:text-5xl font-bold mb-4'>Latest Electronics at Best Prices</h1>
            <p className='text-base sm:text-lg mb-6 text-blue-100'>Discover cutting-edge technology with unbeatable deals on smartphones, laptops and more</p>
            <div className='flex flex-col sm:flex-row gap-3'>
              <Link to='/product' className="flex justify-center items-center w-full sm:w-auto text-[30px] bg-white font-thin text-blue-600 hover:bg-gray-200 "><p>Shop now</p></Link>
              <Link to='/product'  varient="outline" className="flex justify-center items-center text-[30px] font-thin text-[20px] w-full sm:w-auto bg-transparent border border-white/40 text-white hover:bg-white hover:text-blue-600"><p>View deals</p></Link>
            </div>
          </div>
          <div className="relative overflow-hidden">
            <div className="flex items-center justify-center">
              <img src="/led3.png" className="hidden md:block h-40 sm:h-56 md:h-72 lg:h-80 object-contain" />
              <img src="/Ekart-home1.png" className="hidden lg:block h-72 lg:h-96 object-contain" />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Hero