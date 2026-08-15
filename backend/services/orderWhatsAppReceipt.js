import WhatsAppReceipt from "../models/WhatsAppReceipt.js";
import { generateOrderReceipt } from "./receiptService.js";
import { sendPdfReceiptToWhatsApp } from "./whatsappService.js";

const getPhone = (person) => {
  if (!person) return null;

  return (
    person.phoneNumber ||
    person.phone ||
    person.mobile ||
    person.mobileNumber ||
    null
  );
};

export const sendOrderReceiptToRecipient = async ({
  order,
  recipientType,
  phoneNumber,
  name,
}) => {
  if (!phoneNumber) {
    console.log(`⚠️ No phone number for ${recipientType}`);

    return null;
  }

  /*
   * Prevent duplicate WhatsApp receipts.
   */

  const existing = await WhatsAppReceipt.findOne({
    orderId: order._id,
    recipientType,
  });

  if (existing?.status === "sent") {
    console.log(`⏭️ Receipt already sent to ${recipientType}`);

    return existing;
  }

  let notification = existing;

  if (!notification) {
    notification = await WhatsAppReceipt.create({
      orderId: order._id,
      recipientType,
      phoneNumber,
      status: "pending",
    });
  }

  try {
    /*
     * Generate receipt.
     */

    const pdfBuffer = await generateOrderReceipt(order);

    /*
     * Send PDF.
     */

    const result = await sendPdfReceiptToWhatsApp({
      phoneNumber,
      pdfBuffer,
      orderNumber: order.orderNumber || String(order._id),

      recipientName: name,
    });

    notification.status = "sent";

    notification.whatsappMessageId = result.messageId;

    notification.sentAt = new Date();

    notification.error = null;

    await notification.save();

    console.log(`✅ WhatsApp receipt sent to ${recipientType}`);

    return notification;
  } catch (error) {
    console.error(
      `❌ WhatsApp receipt failed for ${recipientType}:`,
      error.response?.data || error.message,
    );

    notification.status = "failed";

    notification.error = error.response?.data
      ? JSON.stringify(error.response.data)
      : error.message;

    await notification.save();

    return null;
  }
};

/*
 * Send receipt to both:
 *
 * Customer
 * Supplier
 */

export const sendOrderReceiptToWhatsApp = async (order) => {
  const results = [];

  /*
   * CUSTOMER
   */

  const userPhone = getPhone(order.userId);

  if (userPhone) {
    const result = await sendOrderReceiptToRecipient({
      order,

      recipientType: "user",

      phoneNumber: userPhone,

      name: order.userId?.name || "Customer",
    });

    results.push(result);
  }

  /*
   * SUPPLIER
   */

  const supplierPhone = getPhone(order.supplierId);

  if (supplierPhone) {
    const result = await sendOrderReceiptToRecipient({
      order,

      recipientType: "supplier",

      phoneNumber: supplierPhone,

      name: order.supplierId?.name || "Supplier",
    });

    results.push(result);
  }

  return results;
};
