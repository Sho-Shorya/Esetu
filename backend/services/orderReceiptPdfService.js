import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";

import { Order } from "../models/orderModel.js";

/*
====================================================
FONT SETUP
====================================================
*/

const REGULAR_FONT = path.join(
  process.cwd(),
  "fonts",
  "NotoSansDevanagari-Regular.ttf",
);

const BOLD_FONT = path.join(
  process.cwd(),
  "fonts",
  "NotoSansDevanagari-Bold.ttf",
);

const checkFonts = () => {
  if (!fs.existsSync(REGULAR_FONT)) {
    throw new Error(`Hindi font not found: ${REGULAR_FONT}`);
  }

  if (!fs.existsSync(BOLD_FONT)) {
    throw new Error(`Hindi bold font not found: ${BOLD_FONT}`);
  }
};

/*
====================================================
TRANSLATIONS / HELPERS
====================================================
*/

const formatMoney = (amount) => {
  return `₹${Number(amount || 0).toFixed(2)}`;
};

const formatDate = (date) => {
  if (!date) return "-";

  const d = new Date(date);

  if (Number.isNaN(d.getTime())) return "-";

  return d.toLocaleDateString("hi-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatTime = (date) => {
  if (!date) return "-";

  const d = new Date(date);

  if (Number.isNaN(d.getTime())) return "-";

  return d.toLocaleTimeString("hi-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const orderStatusHindi = {
  Pending: "पेंडिंग",
  Approved: "अनुमोदित",
  Preparing: "तैयार हो रहा है",
  "Out For Delivery": "डिलीवरी पर गया",
  Delivered: "वितरित",
  Cancelled: "रद्द",
  Declined: "अस्वीकृत",
};

const paymentMethodHindi = (method) =>
  method === "Online" ? "ऑनलाइन भुगतान" : "कैश ऑन डिलीवरी (COD)";

const paymentStatusHindi = (status) =>
  status === "Paid" ? "भुगतान हुआ ✓" : "बकाया (अभी देय)";

const getStatusColor = (status) =>
  status === "Paid" ? "#059669" : "#EA580C";

/*
====================================================
GENERATE SINGLE-ORDER RECEIPT PDF
====================================================
*/

export const generateOrderReceiptPDF = async (orderId, receiptNumber = "") => {
  checkFonts();

  const order = await Order.findById(orderId)
    .populate("userId", "firstName lastName phoneNumber place address zipCode")
    .lean();

  if (!order) {
    throw new Error("Order not found.");
  }

  const user = order.userId || {};

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");

  const deliveryAddress =
    order.shippingAddress || user.address || "पता उपलब्ध नहीं है";

  const place = user.place || "";

  const zipCode = user.zipCode || "";

  const locationBits = [place, zipCode ? `पिन: ${zipCode}` : ""].filter(
    Boolean,
  );

  const statusHindi = orderStatusHindi[order.status] || order.status;

  const paid = String(order.paymentStatus) === "Paid";

  const pdfDoc = new PDFDocument({
    size: "A4",
    margin: 40,
    bufferPages: true,
  });

  const chunks = [];

  pdfDoc.on("data", (chunk) => {
    chunks.push(chunk);
  });

  const pdfPromise = new Promise((resolve, reject) => {
    pdfDoc.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    pdfDoc.on("error", reject);
  });

  const BLACK = "#111827";
  const DARK = "#374151";
  const MUTED = "#6B7280";
  const FAINT = "#9CA3AF";
  const LIGHT = "#F3F4F6";
  const BORDER = "#E5E7EB";
  const GREEN = "#059669";
  const ORANGE = "#EA580C";

  const regular = () => pdfDoc.font(REGULAR_FONT);
  const bold = () => pdfDoc.font(BOLD_FONT);

  /* ==================================================
     HEADER
     Element 1: brand + title + EN subtitle
     Element 2: date + receipt number
  ================================================== */

  pdfDoc.moveDown(0.5);

  bold();

  pdfDoc.fillColor(GREEN).fontSize(28).text("ई-सेतु", 40, pdfDoc.y, {
    width: 515,
    align: "center",
  });

  pdfDoc.fillColor(BLACK).fontSize(15).text("ऑर्डर रसीद", {
    width: 515,
    align: "center",
  });

  regular();

  pdfDoc.fillColor(MUTED).fontSize(8).text("e-Setu Order Receipt", {
    width: 515,
    align: "center",
    characterSpacing: 0.8,
  });

  pdfDoc.moveDown(0.7);

  pdfDoc
    .moveTo(40, pdfDoc.y)
    .lineTo(555, pdfDoc.y)
    .lineWidth(1)
    .strokeColor(GREEN)
    .stroke();

  pdfDoc.moveDown(0.5);

  bold();

  pdfDoc
    .fillColor(GREEN)
    .fontSize(10)
    .text(`दिनांक: ${formatDate(order.createdAt)}`, 40, pdfDoc.y, {
      width: 515,
      align: "center",
    });

  regular();

  pdfDoc
    .fillColor(DARK)
    .fontSize(8)
    .text(`रसीद संख्या: ${receiptNumber || "-"}`, {
      width: 515,
      align: "center",
    });

  pdfDoc.moveDown(0.4);

  /* ==================================================
     PAYMENT STATUS BANNER
  ================================================== */

  const bannerY = pdfDoc.y + 20;

  pdfDoc.roundedRect(40, bannerY, 515, 40, 8).fill(paid ? "#ECFDF5" : "#FFF7ED");

  bold();

  pdfDoc
    .fillColor(paid ? GREEN : ORANGE)
    .fontSize(12)
    .text(
      `भुगतान स्थिति: ${paymentStatusHindi(order.paymentStatus)}`,
      60,
      bannerY + 12,
    );

  regular();

  pdfDoc
    .fillColor(DARK)
    .fontSize(9)
    .text(
      `भुगतान विधि: ${paymentMethodHindi(order.paymentMethod)} • आदेश अवस्था: ${statusHindi}`,
      60,
      bannerY + 26,
    );

  /* ==================================================
     CUSTOMER + ORDER INFO
  ================================================== */

  const infoTop = bannerY + 60;

  bold();

  pdfDoc.fillColor(BLACK).fontSize(9.5).text("ग्राहक की जानकारी", 40, infoTop);

  pdfDoc.fillColor(BLACK).fontSize(9.5).text("आदेश की जानकारी", 330, infoTop, {
    width: 225,
    align: "right",
  });

  pdfDoc
    .moveTo(40, infoTop + 14)
    .lineTo(555, infoTop + 14)
    .lineWidth(0.8)
    .strokeColor(BORDER)
    .stroke();

  regular();

  pdfDoc
    .fillColor(DARK)
    .fontSize(10)
    .text(fullName || "-", 40, infoTop + 24);

  if (user.phoneNumber) {
    pdfDoc
      .fillColor(MUTED)
      .fontSize(8.5)
      .text(`फोन: ${user.phoneNumber}`, 40, infoTop + 42);
  }

  /* --- ADDRESS (multiline on the left) --- */

  let addrLeft = infoTop + 60;

  pdfDoc
    .fillColor(MUTED)
    .fontSize(8.5)
    .text(`पता: ${deliveryAddress}`, 40, addrLeft, {
      width: 270,
    });

  addrLeft = pdfDoc.y + 4;

  if (locationBits.length) {
    pdfDoc
      .fillColor(MUTED)
      .fontSize(8.5)
      .text(locationBits.join(" • "), 40, addrLeft, {
        width: 270,
      });

    addrLeft = pdfDoc.y + 4;
  }

  /* --- ORDER INFO (right) --- */

  let orderRightY = infoTop + 22;

  const rightEntries = [
    {
      label: "आदेश",
      value: `#${String(order._id).slice(-8).toUpperCase()}`,
    },
    {
      label: "आदेश दिनांक",
      value: `${formatDate(order.createdAt)} • ${formatTime(order.createdAt)}`,
    },
    {
      label: "आदेश अवस्था",
      value: statusHindi,
    },
    {
      label: "भुगतान विधि",
      value: paymentMethodHindi(order.paymentMethod),
    },
  ];

  for (const entry of rightEntries) {
    regular();

    pdfDoc
      .fillColor(FAINT)
      .fontSize(8)
      .text(entry.label, 330, orderRightY, {
        width: 90,
        align: "left",
      });

    bold();

    pdfDoc
      .fillColor(DARK)
      .fontSize(9)
      .text(entry.value, 425, orderRightY, {
        width: 130,
        align: "right",
      });

    orderRightY += 18;
  }

  let infoBottom = Math.max(addrLeft, orderRightY) + 12;

  pdfDoc.y = infoBottom;

  /* ==================================================
     ITEMS TABLE
  ================================================== */

  const tableLeft = 40;
  const tableWidth = 515;
  const productX = 50;
  const productWidth = 150;
  const companyX = 210;
  const companyWidth = 80;
  const measurementX = 300;
  const measurementWidth = 60;
  const qtyX = 365;
  const qtyWidth = 30;
  const priceX = 400;
  const priceWidth = 65;
  const totalX = 470;
  const totalWidth = 75;
  const headerHeight = 30;
  const rowHeight = 48;

  const drawTableHeader = (yPos) => {
    pdfDoc
      .roundedRect(tableLeft, yPos, tableWidth, headerHeight, 6)
      .fill(LIGHT);

    bold();

    pdfDoc
      .fillColor(DARK)
      .fontSize(8.5)
      .text("उत्पाद", productX, yPos + 9, {
        width: productWidth,
      });

    pdfDoc.text("कंपनी", companyX, yPos + 9, {
      width: companyWidth,
    });

    pdfDoc.text("माप", measurementX, yPos + 9, {
      width: measurementWidth,
    });

    pdfDoc.text("मात्रा", qtyX, yPos + 9, {
      width: qtyWidth,
      align: "center",
    });

    pdfDoc.text("कीमत", priceX, yPos + 9, {
      width: priceWidth,
      align: "right",
    });

    pdfDoc.text("कुल", totalX, yPos + 9, {
      width: totalWidth,
      align: "right",
    });
  };

  let tableTop = pdfDoc.y;

  drawTableHeader(tableTop);

  let y = tableTop + headerHeight + 8;

  for (const item of order.items || []) {
    if (y + rowHeight > 720) {
      pdfDoc.addPage();
      y = 50;

      drawTableHeader(y);

      y += headerHeight + 8;
    }

    bold();

    pdfDoc
      .fillColor(BLACK)
      .fontSize(10)
      .text(item.name || "Product", productX, y, {
        width: productWidth,
        height: 18,
        ellipsis: true,
      });

    if (item.hinglishName) {
      regular();

      pdfDoc
        .fillColor(MUTED)
        .fontSize(7.5)
        .text(item.hinglishName, productX, y + 18, {
          width: productWidth,
          height: 14,
          ellipsis: true,
        });
    }

    regular();

    if (item.companyName) {
      pdfDoc
        .fillColor(GREEN)
        .fontSize(7.5)
        .text(item.companyName, companyX, y + 9, {
          width: companyWidth,
          height: 26,
          lineBreak: true,
          ellipsis: true,
        });
    }

    pdfDoc
      .fillColor(DARK)
      .fontSize(8.5)
      .text(item.measurement || "-", measurementX, y + 9, {
        width: measurementWidth,
      });

    pdfDoc.text(String(item.qty || 0), qtyX, y + 9, {
      width: qtyWidth,
      align: "center",
    });

    pdfDoc.text(formatMoney(item.price), priceX, y + 9, {
      width: priceWidth,
      align: "right",
    });

    bold();

    pdfDoc.fillColor(BLACK).text(formatMoney(item.total), totalX, y + 9, {
      width: totalWidth,
      align: "right",
    });

    pdfDoc
      .moveTo(tableLeft, y + rowHeight - 3)
      .lineTo(tableLeft + tableWidth, y + rowHeight - 3)
      .lineWidth(0.6)
      .strokeColor(BORDER)
      .stroke();

    y += rowHeight;
  }

  /* ==================================================
     SUMMARY
  ================================================== */

  y += 16;

  if (y > 690) {
    pdfDoc.addPage();
    y = 50;
  }

  pdfDoc
    .moveTo(320, y)
    .lineTo(555, y)
    .lineWidth(1)
    .strokeColor(BORDER)
    .stroke();

  y += 14;

  const summaryRows = [
    {
      label: "कुल मूल्य",
      value: formatMoney(order.originalTotalAmount || order.totalAmount),
      color: DARK,
    },
  ];

  if (Number(order.discountAmount) > 0) {
    summaryRows.push({
      label: "छूट",
      value: `- ${formatMoney(order.discountAmount)}`,
      color: GREEN,
    });
  }

  for (const row of summaryRows) {
    regular();

    pdfDoc.fillColor(MUTED).fontSize(9).text(row.label, 320, y, {
      width: 130,
      align: "right",
    });

    bold();

    pdfDoc.fillColor(row.color).fontSize(9).text(row.value, 462, y, {
      width: 93,
      align: "right",
    });

    y += 18;
  }

  y += 4;

  pdfDoc.roundedRect(320, y, 235, 54, 8).fill(paid ? "#ECFDF5" : "#FFF7ED");

  bold();

  pdfDoc
    .fillColor(paid ? GREEN : ORANGE)
    .fontSize(9)
    .text("कुल भुगतान राशि", 335, y + 10, {
      width: 205,
      align: "right",
    });

  pdfDoc
    .fontSize(15)
    .text(formatMoney(order.totalAmount), 335, y + 25, {
      width: 205,
      align: "right",
    });

  /* ==================================================
     FOOTER
  ================================================== */

  regular();

  pdfDoc
    .fillColor(MUTED)
    .fontSize(9)
    .text(
      `यह रसीद ई-सेतु द्वारा जारी की गई है। सवाल होने पर कृपया सपोर्ट से संपर्क करें।`,
      40,
      765,
      {
        width: 515,
        align: "center",
      },
    );

  pdfDoc
    .fillColor(GREEN)
    .fontSize(9)
    .text("ई-सेतु के साथ खरीदारी करने के लिए धन्यवाद 🙏", 40, 747, {
      width: 515,
      align: "center",
    });

  const range = pdfDoc.bufferedPageRange();

  for (let i = range.start; i < range.start + range.count; i++) {
    pdfDoc.switchToPage(i);

    pdfDoc
      .fillColor(FAINT)
      .fontSize(7)
      .text(`पृष्ठ ${i + 1 - range.start} / ${range.count}`, 40, 782, {
        width: 515,
        align: "right",
      });
  }

  pdfDoc.end();

  return await pdfPromise;
};