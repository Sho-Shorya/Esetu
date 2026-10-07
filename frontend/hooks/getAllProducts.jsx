import { useEffect } from "react";
import axios from "axios";
import { API_BASE_URL } from "../src/lib/constants";
import { useDispatch, useSelector } from "react-redux";
import {
  setCartData,
  setProdLoading,
  setProductData,
} from "../src/redux/ProductSlice";

export const fetchAllProducts = async (dispatch, supplierId = null) => {
  dispatch(setProdLoading(true));

  try {
    const token = localStorage.getItem("token");

    if (!token) {
      dispatch(setProdLoading(false));
      return;
    }
    const query = supplierId
      ? `?supplierId=${encodeURIComponent(supplierId)}`
      : "";
    const res = await axios.get(`${API_BASE_URL}/api/v1/product/${query}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const resCart = await axios.get(`${API_BASE_URL}/api/v1/cart/`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    dispatch(setProductData(res.data.products));
    dispatch(setCartData(resCart.data.cart));
  } catch (error) {
    console.log(error);
  } finally {
    dispatch(setProdLoading(false));
  }
};

const useGetAllProducts = () => {
  const dispatch = useDispatch();
  const { userData, supplierData } = useSelector((state) => state.user);
  const selectedSupplierId = userData?.selectedSupplier || null;

  useEffect(() => {
    // A shopkeeper sees only the catalog of the supplier they picked in the
    // "सप्लायर चुनें" bar; a supplier's own management panel keeps the full
    // catalog so nothing has to be re-typed.
    fetchAllProducts(dispatch, supplierData ? null : selectedSupplierId);
  }, [dispatch, userData, supplierData, selectedSupplierId]);
};

export default useGetAllProducts;
