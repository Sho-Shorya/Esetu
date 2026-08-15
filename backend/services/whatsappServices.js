import axios from "axios";
import FormData from "form-data";

const WHATSAPP_API_VERSION = process.env.WHATSAPP_API_VERSION || "v23.0";

const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

const GRAPH_URL = `https://graph.facebook.com/${WHATSAPP_API_VERSION}`;

const normalizeIndianNumber = (phone) => {
  if (!phone) return null;

  let value = String(phone).replace(/\D/g, "");

  // 10 digit Indian number
  if (value.length === 10) {
    value = `91${value}`;
  }

  // 0XXXXXXXXXX
  if (value.length === 11 && value.startsWith("0")) {
    value = `91${value.substring(1)}`;
  }

  return value;
};

/*
  Upload a PDF to WhatsApp.

  WhatsApp returns a media ID which can then
  be used to send the document.
*/
export const uploadPdfToWhatsApp = async (pdfBuffer, fileName) => {
  if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
    throw new Error("WhatsApp environment variables are missing.");
  }

  const form = new FormData();

  form.append("messaging_product", "whatsapp");

  form.append("file", pdfBuffer, {
    filename: fileName,
    contentType: "application/pdf",
  });

  const response = await axios.post(
    `${GRAPH_URL}/${PHONE_NUMBER_ID}/media`,
    form,
    {
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        ...form.getHeaders(),
      },

      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    },
  );

  return response.data.id;
};

/*
  Send the uploaded PDF as a WhatsApp document.
*/
export const sendWhatsAppDocument = async ({
  phoneNumber,
  mediaId,
  fileName,
  caption,
}) => {
  if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
    throw new Error("WhatsApp environment variables are missing.");
  }

  const recipient = normalizeIndianNumber(phoneNumber);

  if (!recipient) {
    throw new Error("Invalid WhatsApp recipient number.");
  }

  const response = await axios.post(
    `${GRAPH_URL}/${PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: "whatsapp",

      recipient_type: "individual",

      to: recipient,

      type: "document",

      document: {
        id: mediaId,

        caption: caption || "e-Setu Order Receipt",

        filename: fileName,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
    },
  );

  return response.data;
};

export const sendPdfReceiptToWhatsApp = async ({
  phoneNumber,
  pdfBuffer,
  orderNumber,
  recipientName,
}) => {
  const fileName = `e-Setu-${orderNumber}.pdf`;

  const mediaId = await uploadPdfToWhatsApp(pdfBuffer, fileName);

  const caption =
    `🧾 e-Setu आज का ऑर्डर\n\n` +
    `Order: ${orderNumber}\n` +
    `नाम: ${recipientName || "Customer"}\n\n` +
    `आपका ऑर्डर receipt संलग्न है।\n` +
    `धन्यवाद 🙏`;

  const result = await sendWhatsAppDocument({
    phoneNumber,
    mediaId,
    fileName,
    caption,
  });

  return {
    mediaId,
    messageId: result?.messages?.[0]?.id || null,
  };
};
