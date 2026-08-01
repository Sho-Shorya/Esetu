export const sendMobileNotification = async ({ phone, title, body }) => {
  if (!phone) return false;
  console.log(`Mobile notification -> ${phone}: ${title} | ${body}`);
  return true;
};
