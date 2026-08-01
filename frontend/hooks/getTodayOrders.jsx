import axios from "axios";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { API_BASE_URL } from "../utils/constant";
import { setLoading, setTodayOrders, setError } from "../src/redux/orderSlice";

const useGetTodayOrders = () => {
  const dispatch = useDispatch();

  const { token } = useSelector((state) => state.user);

  useEffect(() => {
    const fetchTodayOrders = async () => {
      if (!token) return;

      dispatch(setLoading(true));

      try {
        const res = await axios.get(
          `${API_BASE_URL}/api/v1/order/today-orders`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (res.data.success) {
          dispatch(setTodayOrders(res.data.orders));
        }
      } catch (error) {
        dispatch(
          setError(
            error.response?.data?.message || "Failed to load today's orders.",
          ),
        );
      } finally {
        dispatch(setLoading(false));
      }
    };

    fetchTodayOrders();
  }, [dispatch, token]);
};

export default useGetTodayOrders;
