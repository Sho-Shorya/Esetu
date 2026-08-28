import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";

import { Order } from "../models/orderModel.js";
import { User } from "../models/userModel.js";

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
HELPERS
====================================================
*/

const formatMoney = (amount) => {
  return `₹${Number(amount || 0).toFixed(2)}`;
};

const formatDate = (date) => {
  if (!date) return "-";

  const d = new Date(date);

  if (Number.isNaN(d.getTime())) return "-";

  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatTime = (date) => {
  if (!date) return "-";

  const d = new Date(date);

  if (Number.isNaN(d.getTime())) return "-";

  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

/*
====================================================
GENERATE SINGLE-ORDER RECEIPT PDF
====================================================
*/

export const generateOrderReceiptPDF = async (orderId) => {
  checkFonts();

  const order = await Order.findById(orderId)
    .populate("userId", "firstName lastName phoneNumber place address")
    .lean();

  if (!order) {
    throw new Error("Order not found.");
  }

  const user = order.userId || {};

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");

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
  const LIGHT = "#F3F4F6";
  const BORDER = "#E5E7EB";
  const GREEN = "#059669";

  const regular = () => pdfDoc.font(REGULAR_FONT);
  const bold = () => pdfDoc.font(BOLD_FONT);

  /* ==================================================
     HEADER
  ================================================== */

  bold();

  pdfDoc.fillColor(GREEN).fontSize(26).text("e-Setu", {
    align: "center",
  });

  pdfDoc.fillColor(BLACK).fontSize(13).text("ऑर्डर रसीद", {
    align: "center",
  });

  regular();

  pdfDoc.fillColor(MUTED).fontSize(8).text("ORDER RECEIPT", {
    align: "center",
    characterSpacing: 0.8,
  });

  pdfDoc.moveDown(0.8);

  pdfDoc
    .moveTo(40, pdfDoc.y)
    .lineTo(555, pdfDoc.y)
    .lineWidth(1)
    .strokeColor(BORDER)
    .stroke();

  /* ==================================================
     ORDER + CUSTOMER INFO
  ================================================== */

  pdfDoc.moveDown(1);

  const infoTop = pdfDoc.y;

  bold();

  pdfDoc.fillColor(BLACK).fontSize(9).text("ग्राहक", 40, infoTop);

  regular();

  pdfDoc
    .fillColor(DARK)
    .fontSize(10)
    .text(fullName || "N/A", 40, infoTop + 17);

  if (user.phoneNumber) {
    pdfDoc
      .fillColor(MUTED)
      .fontSize(8)
      .text(`फोन: ${user.phoneNumber}`, 40, infoTop + 35);
  }

  if (user.place) {
    pdfDoc.text(`स्थान: ${user.place}`, 40, infoTop + 50);
  }

  /* RIGHT SIDE */

  bold();

  pdfDoc.fillColor(BLACK).fontSize(9).text("ऑर्डर", 390, infoTop, {
    width: 165,
    align: "right",
  });

  regular();

  pdfDoc
    .fillColor(DARK)
    .fontSize(10)
    .text(String(order._id).slice(-8).toUpperCase(), 390, infoTop + 17, {
      width: 165,
      align: "right",
    });

  pdfDoc
    .fillColor(MUTED)
    .fontSize(8)
    .text(formatDate(order.createdAt), 390, infoTop + 35, {
      width: 165,
      align: "right",
    });

  pdfDoc.text(formatTime(order.createdAt), 390, infoTop + 50, {
    width: 165,
    align: "right",
  });

  let infoBottom = infoTop + 68;

  if (user.address) {
    regular();

    pdfDoc
      .fillColor(MUTED)
      .fontSize(8)
      .text(`पता: ${user.address}`, 40, infoBottom, {
        width: 500,
      });

    infoBottom += 18;
  }

  pdfDoc.y = infoBottom + 10;

  /* ==================================================
     TABLE
  ================================================== */

  const tableLeft = 40;
  const tableWidth = 515;
  const productX = 50;
  const measurementX = 255;
  const qtyX = 345;
  const priceX = 390;
  const totalX = 470;
  const productWidth = 195;
  const measurementWidth = 85;
  const qtyWidth = 35;
  const priceWidth = 75;
  const totalWidth = 75;
  const headerHeight = 30;
  const rowHeight = 48;

  let tableTop = pdfDoc.y;

  pdfDoc.roundedRect(tableLeft, tableTop, tableWidth, headerHeight, 6).fill(LIGHT);

  bold();

  pdfDoc
    .fillColor(DARK)
    .fontSize(8.5)
    .text("उत्पाद", productX, tableTop + 9, {
      width: productWidth,
    });

  pdfDoc.text("माप", measurementX, tableTop + 9, {
    width: measurementWidth,
  });

  pdfDoc.text("मात्रा", qtyX, tableTop + 9, {
    width: qtyWidth,
    align: "center",
  });

  pdfDoc.text("कीमत", priceX, tableTop + 9, {
    width: priceWidth,
    align: "right",
  });

  pdfDoc.text("कुल", totalX, tableTop + 9, {
    width: totalWidth,
    align: "right",
  });

  let y = tableTop + headerHeight + 8;

  for (const item of order.items || []) {
    if (y + rowHeight > 720) {
      pdfDoc.addPage();
      y = 50;

      pdfDoc.roundedRect(tableLeft, y, tableWidth, headerHeight, 6).fill(LIGHT);

      bold();

      pdfDoc
        .fillColor(DARK)
        .fontSize(8.5)
        .text("उत्पाद", productX, y + 9, {
          width: productWidth,
        });

      pdfDoc.text("माप", measurementX, y + 9, {
        width: measurementWidth,
      });

      pdfDoc.text("मात्रा", qtyX, y + 9, {
        width: qtyWidth,
        align: "center",
      });

      pdfDoc.text("कीमत", priceX, y + 9, {
        width: priceWidth,
        align: "right",
      });

      pdfDoc.text("कुल", totalX, y + 9, {
        width: totalWidth,
        align: "right",
      });

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

  y += 18;

  if (y > 700) {
    pdfDoc.addPage();
    y = 50;
  }

  pdfDoc
    .moveTo(350, y)
    .lineTo(555, y)
    .lineWidth(1)
    .strokeColor(BORDER)
    .stroke();

  y += 14;

  if (order.paymentMethod) {
    regular();

    pdfDoc
      .fillColor(MUTED)
      .fontSize(9)
      .text(
        `भुगतान: ${order.paymentMethod === "Online" ? "ऑनलाइन" : "कैश"}`,
        350,
        y,
        {
          width: 205,
          align: "right",
        },
      );

    y += 24;
  }

  pdfDoc.roundedRect(350, y, 205, 50, 8).fill("#ECFDF5");

  bold();

  pdfDoc
    .fillColor(GREEN)
    .fontSize(9)
    .text("कुल राशि", 365, y + 9, {
      width: 175,
      align: "right",
    });

  pdfDoc.fontSize(16).text(formatMoney(order.totalAmount), 365, y + 23, {
    width: 175,
    align: "right",
  });

  /* ==================================================
     FOOTER
  ================================================== */

  regular();

  pdfDoc
    .fillColor(MUTED)
    .fontSize(8)
    .text("e-Setu के साथ खरीदारी करने के लिए धन्यवाद 🙏", 40, 760, {
      width: 515,
      align: "center",
    });

  const range = pdfDoc.bufferedPageRange();

  for (let i = range.start; i < range.start + range.count; i++) {
    pdfDoc.switchToPage(i);

    pdfDoc
      .fillColor(MUTED)
      .fontSize(7)
      .text(`Page ${i + 1 - range.start} of ${range.count}`, 40, 775, {
        width: 515,
        align: "right",
      });
  }

  pdfDoc.end();

  return await pdfPromise;
};
