import React from "react";
import { Link } from "react-router-dom";
import {
  FaFacebookF,
  FaInstagram,
  FaWhatsapp,
  FaYoutube,
} from "react-icons/fa";
import { MapPin, Phone, Clock, User, Mail } from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-black text-gray-300 border-t-4 border-red-600 mt-16">
      <div className="max-w-7xl mx-auto px-6 py-10">
        {/* Top */}
        <div className="grid md:grid-cols-3 gap-10">
          {/* Left */}
          <div>
            <img src="/logo.png" alt="ई-सेतु" className="h-20 mb-3" />

            <h2 className="text-2xl font-bold text-white">
              <span className="text-red-600">ई-सेतु</span>
            </h2>

            <p className="mt-3 text-gray-400 leading-7 text-sm">
              दुकानदारों के लिए थोक किराना सामान की भरोसेमंद आपूर्ति। उचित दाम,
              तेज़ सेवा और आसान ऑर्डर।
            </p>

            {/* <div className="flex gap-3 mt-6">
              <a
                href="#"
                className="h-10 w-10 rounded-full bg-red-600 flex items-center justify-center hover:bg-white hover:text-red-600 transition"
              >
                <FaFacebookF />
              </a>

              <a
                href="#"
                className="h-10 w-10 rounded-full bg-red-600 flex items-center justify-center hover:bg-white hover:text-red-600 transition"
              >
                <FaInstagram />
              </a>

              <a
                href="#"
                className="h-10 w-10 rounded-full bg-red-600 flex items-center justify-center hover:bg-white hover:text-red-600 transition"
              >
                <FaWhatsapp />
              </a>

              <a
                href="#"
                className="h-10 w-10 rounded-full bg-red-600 flex items-center justify-center hover:bg-white hover:text-red-600 transition"
                >
                <FaYoutube />
                </a>
                </div> */}
          </div>
          <div>
            <h3 className="text-white text-xl font-semibold border-l-4 border-red-600 pl-3 mb-5">
              संपर्क करें
            </h3>

            <div className="space-y-5 text-sm">
              <div className="flex gap-3">
                <User className="text-red-600 mt-1" size={18} />
                <div>
                  <p className="font-medium text-white">Owner/Creater</p>
                  <p className="text-gray-400 text-[16px]">Shorya</p>
                </div>
              </div>
              <div className="flex gap-3">
                <MapPin className="text-red-600 mt-1" size={18} />
                <div>
                  <p className="font-medium text-white">पता</p>
                  <p className="text-gray-400 text-[16px]">
                    611/13, जगदीश कॉलोनी, हांसी, हरियाणा
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <Phone className="text-red-600 mt-1" size={18} />
                <div>
                  <p className="font-medium text-white">फ़ोन</p>
                  <p className="text-gray-400 text-[16px]">+91 8397067785</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Mail className="text-red-600 mt-1" size={18} />
                <div>
                  <p className="font-medium text-white">Gmail</p>
                  <p className="text-gray-400 text-[16px]">
                    shoryaconnects308@gmail.com
                  </p>
                  <p className="text-gray-400 text-[16px]">
                    shoryachhabra308@gmail.com
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Middle */}
          <div>
            <h3 className="text-white text-xl font-semibold border-l-4 border-red-600 pl-3 mb-5">
              महत्वपूर्ण लिंक
            </h3>

            <div className="grid grid-cols-2 gap-y-3 text-sm">
              <Link to="/" className="hover:text-red-500">
                🏠 होम
              </Link>

              <Link to="/products" className="hover:text-red-500">
                🛒 सभी उत्पाद
              </Link>
              {/* 
              <Link to="/categories" className="hover:text-red-500">
                📦 श्रेणियाँ
              </Link>

              <Link to="/offers" className="hover:text-red-500">
                🎁 ऑफ़र
              </Link> */}

              <Link to="/cart" className="hover:text-red-500">
                🛍️ कार्ट
              </Link>

              <Link to="/order-history" className="hover:text-red-500">
                📋 मेरे ऑर्डर
              </Link>
            </div>
          </div>

          {/* Right */}
        </div>

        {/* Bottom */}

        <div className="border-t border-gray-800 mt-10 pt-5 flex flex-col md:flex-row justify-between items-center gap-3 pb-35">
          <p className="text-sm text-gray-500 text-center">
            © {new Date().getFullYear()}{" "}
            <span className="text-red-600 font-semibold">ई-सेतु</span> • सभी
            अधिकार सुरक्षित।
          </p>

          <p className="text-sm text-gray-500">❤️ भारत में बनाया गया</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
