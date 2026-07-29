import streamifier from "streamifier";
import cloudinary from "./cloudinary.js";

export const uploadOnCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "e-setu" },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      },
    );

    streamifier.createReadStream(buffer).pipe(stream);
  });
};
