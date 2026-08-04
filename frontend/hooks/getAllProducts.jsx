import { useEffect } from "react";
import axios from "axios";
import { API_BASE_URL } from "../src/lib/constants";
import { useDispatch, useSelector } from "react-redux";
import {
  setCartData,
  setLoading,
  setProductData,
} from "../src/redux/ProductSlice";
import { setUserData } from "../src/redux/userSlice";

export const fetchAllProducts = async (dispatch) => {
  dispatch(setLoading(true));

  try {
    const token = localStorage.getItem("token");
    if (!token) return;

    const res = await axios.get(`${API_BASE_URL}/api/v1/product/`, {
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
    dispatch(setLoading(false));
  }
};

const useGetAllProducts = () => {
  const dispatch = useDispatch();
  const { userData } = useSelector((state) => state.user);
  useEffect(() => {
    fetchAllProducts(dispatch);
  }, [dispatch, userData]);
};

export default useGetAllProducts;
