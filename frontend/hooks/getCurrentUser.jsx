import { useEffect } from "react";
import axios from "axios";
import { API_BASE_URL } from "../src/lib/constants";
import { useDispatch } from "react-redux";
import {
  clearSupplierData,
  clearUserData,
  setUserData,
  setSupplierData,
} from "../src/redux/userSlice";

const getCurrentUser = () => {
  const dispatch = useDispatch();

  useEffect(() => {
    const fetchUser = async () => {
      const token = localStorage.getItem("token");

      if (!token) {
        dispatch(clearUserData());
        dispatch(clearSupplierData());

        return;
      }

      try {
        const res = await axios.get(`${API_BASE_URL}/api/v1/user/current`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const user = res.data.user;

        if (user.role === "supplier") {
          dispatch(setSupplierData(user));
          dispatch(clearUserData());
        } else {
          dispatch(setUserData(user));
          dispatch(clearSupplierData());
        }
      } catch (error) {
        console.log(error);
        dispatch(clearUserData());
        dispatch(clearSupplierData());
      }
    };

    fetchUser();
  }, [dispatch]);

  return null;
};

export default getCurrentUser;
