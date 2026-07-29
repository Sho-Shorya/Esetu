import React, { useEffect } from "react";
import { useState } from "react";
import { useRef } from "react";
import { MdOutlineKeyboardBackspace } from "react-icons/md";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../lib/constants";
import { setUserData } from "../redux/userSlice";
import axios from "axios";
import { toast } from "sonner";

const EditProfile = () => {
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);
  const { userData } = useSelector((state) => state.user);
  const navigate = useNavigate();
  const imageInput = useRef();
  const [frontendImage, setFrontendImage] = useState(
    userData.profilePic || "/empty_dp.jpg",
  );
  const [backendImage, setBackendImage] = useState(null);
  const [name, setName] = useState(userData?.name || "");
  const [userName, setUserName] = useState(userData?.userName || "");
  const [bio, setBio] = useState(userData?.bio || "");
  const [profession, setProfession] = useState(userData?.profession || "");
  const [gender, setGender] = useState(userData?.gender || "");

  useEffect(() => {
    if (userData) {
      setFrontendImage(userData.profilePic || "/empty_dp.jpg");
      setName(userData.name || "");
      setUserName(userData.userName || "");
      setBio(userData.bio || "");
      setProfession(userData.profession || "");
      setGender(userData.gender || "");
    }
  }, [userData]);

  const handleImage = async (e) => {
    const file = e.target.files[0];
    setBackendImage(file);
    setFrontendImage(URL.createObjectURL(file));
  };
  const handleEditProfile = async () => {
    try {
      setLoading(true);
      const formdata = new FormData();
      formdata.append("name", name);
      formdata.append("userName", userName);
      formdata.append("bio", bio);
      formdata.append("profession", profession);
      formdata.append("gender", gender);
      if (backendImage) {
        formdata.append("profilePic", backendImage);
      }
      const token = localStorage.getItem("token");
      const result = await axios.post(
        `${API_BASE_URL}/api/user/editprofile`,
        formdata,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      navigate("/");
      dispatch(setProfileData(result.data.user));
      dispatch(setUserData(result.data.user));
      window.location.reload();
      // window.location.reload();
    } catch (error) {
      if (error.response && error.response.status === 400) {
        toast.error(error.response.data.message);
      } else {
        toast.error("Something went wrong");
      }

      console.log(error);
    } finally {
      toast.success("Profile Saved Successfully");
      setLoading(false);
    }
  };
  return (
    <div className="w-screen h-screen bg-[black] color-white">
      <div className="w-full flex justify-start gap-[20px] items-center px-[20px] pt-[20px]">
        <MdOutlineKeyboardBackspace
          className="text-white"
          size={24}
          onClick={() => navigate(`/profile/${userData.userName}`)}
        />
        <h1 className="font-semibold">Edit Profile</h1>
      </div>

      <div className="flex flex-col items-center">
        <div
          className="flex flex-col items-center"
          onClick={() => imageInput.current.click()}
        >
          <div className="w-[80px] h-[80px] md:w-[130px] md:h-[130px] rounded-full overflow-hidden border-2 border-gray-700 mt-[30px]">
            <input
              type="file"
              onChange={handleImage}
              accept="image/*"
              ref={imageInput}
              hidden
            />
            <img
              src={frontendImage || userData.profilePic}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
          <h1 className="text-blue-600 text-[15px] mt-2">
            Change your profile pic
          </h1>
        </div>

        {/* form fields */}
        <div className="w-[80%] md:w-full text-[18px] font-semibold  max-w-[500px] flex flex-col gap-[15px] mt-[30px]">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter Your Name"
            className="w-full h-[50px] bg-[#0d1a1a] border border-gray-700 rounded-[10px] px-[15px] text-white outline-none"
          />

          <input
            type="text"
            placeholder="Enter Your userName"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            className="w-full h-[50px] bg-[#0d1a1a] border border-gray-700 rounded-[10px] px-[15px] text-white outline-none"
          />

          <input
            type="text"
            placeholder="Bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="w-full h-[50px] bg-[#0d1a1a] border border-gray-700 rounded-[10px] px-[15px] text-white outline-none"
          />

          <input
            type="text"
            placeholder="Profession"
            value={profession}
            onChange={(e) => setProfession(e.target.value)}
            className="w-full h-[50px] bg-[#0d1a1a] border border-gray-700 rounded-[10px] px-[15px] text-white outline-none"
          />

          <input
            type="text"
            placeholder="Gender"
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            className="w-full h-[50px] bg-[#0d1a1a] border border-gray-700 rounded-[10px] px-[15px] text-white outline-none"
          />
        </div>

        {/* save button */}
        <div
          className="w-[60%] text-[black] text-[18px] font-semibold max-w-[500px] h-[50px] bg-white rounded-full flex items-center justify-center font-semibold cursor-pointer mt-[30px] mb-[40px]"
          onClick={handleEditProfile}
        >
          {loading ? "Saving..." : "Save Profile"}
        </div>
      </div>
    </div>
  );
};

export default EditProfile;
