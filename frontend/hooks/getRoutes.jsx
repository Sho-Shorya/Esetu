import { useEffect } from "react";
import axios from "axios";
import { useDispatch } from "react-redux";
import { API_BASE_URL } from "@/lib/constants";
import { setSuppliers } from "@/redux/routeSlice";

const getRoutes = () => {
  const dispatch = useDispatch();

  useEffect(() => {
    const getSuppliers = async () => {
      try {
        const response = await axios.get(
          `${API_BASE_URL}/api/v1/user/get-suppIds`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          },
        );

        if (response.data.success) {
          dispatch(setSuppliers(response.data.suppliers));
        }
      } catch (error) {
        console.error(
          "Error fetching suppliers:",
          error.response?.data || error.message,
        );
      }
    };

    getSuppliers();
  }, [dispatch]);

  return null;
};

export default getRoutes;
