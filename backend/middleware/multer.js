import multer from "multer";

const storage = multer.memoryStorage();

const upload = multer({ storage });

export const singleUpload = (fieldName) => upload.single(fieldName);

export const multipleUpload = (fieldName, count = 10) =>
  upload.array(fieldName, count);

export const uploadAny = upload.any();
