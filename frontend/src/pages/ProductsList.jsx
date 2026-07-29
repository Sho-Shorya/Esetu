import React, { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useSelector } from "react-redux";

const ProductsList = () => {
  const { productData } = useSelector((state) => state.product);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const location = useLocation();

  const searchQuery =
    new URLSearchParams(location.search).get("search")?.trim().toLowerCase() ||
    "";

  const products = useMemo(() => {
    if (!Array.isArray(productData)) return [];

    if (!searchQuery) return productData;

    const terms = searchQuery.split(/\s+/).filter(Boolean);

    return productData.filter((product) => {
      const searchableText = [
        product?.name,
        product?.hinglishName,
        String(product?.price),
        product?.availability,
        ...(product?.measurement || []),
        ...(product?.companies || []),
      ]
        .join(" ")
        .toLowerCase();

      return terms.every((term) => searchableText.includes(term));
    });
  }, [productData, searchQuery]);

  const handleProductClick = (product) => {
    setSelectedProduct(product);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Your order logic
  };

  return (
    <div className="w-full min-h-screen bg-white">
      {searchQuery && (
        <p className="text-center mt-3 text-gray-600">
          {" "}
          :के लिए नतीजे दिखाए जा रहे हैं
          <span className="font-semibold">{searchQuery}</span>
        </p>
      )}

      {products.length === 0 ? (
        <div className="text-center mt-20 text-gray-500">No Products Found</div>
      ) : (
        <div id="Home-items-div" className="mb-20 mt-2 relative">
          {products.map((item, idx) => (
            <div
              key={idx}
              onClick={() => handleProductClick(item)}
              className="relative bg-gray-100 flex m-2 p-2 rounded cursor-pointer"
            >
              <div className="flex items-center">
                <img
                  className="h-18"
                  src={item.image || "chips.png"}
                  alt={item.name}
                />
              </div>

              <div className="flex flex-col justify-between ml-3">
                <div>
                  <h1 className="text-[17px] max-w-[220px]">
                    {item.name} / {item.hinglishName}
                  </h1>

                  <h1 className="text-xl text-red-600 p-[2px]">
                    ₹ {item.price}/-
                  </h1>
                </div>

                <div>
                  <h1 className="text-[15px]">{item.availability}</h1>
                </div>

                <h1 className="absolute right-3 bottom-8 text-xl">➕</h1>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedProduct && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="fixed bottom-0 left-0 right-0 h-[80%] bg-gray-200 rounded-t-3xl border-t-4 border-red-600 p-5 z-50"
        >
          <div className="flex justify-between">
            <div className="flex items-center">
              <img
                className="h-20"
                src={selectedProduct.image || "chips.png"}
                alt={selectedProduct.name}
              />
            </div>

            <div className="font-semibold">
              <h1 className="text-[20px] max-w-[220px]">
                {selectedProduct.name} / {selectedProduct.hinglishName}
              </h1>

              <h1 className="text-red-600 text-xl">
                ₹ {selectedProduct.price}/-
              </h1>
            </div>

            <button
              onClick={() => setSelectedProduct(null)}
              className="text-3xl"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
            {selectedProduct.companies?.length > 0 && (
              <>
                <label>कंपनी👇</label>

                <select className="p-2 bg-gray-300 rounded-lg">
                  <option value="">--कोई भी--</option>

                  {selectedProduct.companies.map((company, id) => (
                    <option key={id}>{company}</option>
                  ))}
                </select>
              </>
            )}

            {selectedProduct.type?.length > 0 && (
              <>
                <label>प्रकार👇</label>

                <select required className="p-2 bg-gray-300 rounded-lg">
                  <option value="">--कोई भी--</option>

                  {selectedProduct.type.map((type, id) => (
                    <option key={id}>{type}</option>
                  ))}
                </select>
              </>
            )}

            <div className="flex gap-2">
              <input
                required
                type="number"
                placeholder="मात्रा"
                className="w-[65%] p-2 border-2 border-red-600 rounded-lg outline-none"
              />

              {selectedProduct.measurement?.length > 0 && (
                <select className="p-2 bg-gray-300 rounded-lg">
                  <option value="">--चुने--</option>

                  {selectedProduct.measurement.map((measure, id) => (
                    <option key={id}>{measure}</option>
                  ))}
                </select>
              )}
            </div>

            <button className="fixed bottom-10 left-[5%] w-[90%] bg-red-600 text-white rounded-lg py-3 font-bold">
              ऑर्डर ✅
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default ProductsList;
