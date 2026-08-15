import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";

import { DailyInvoice } from "../models/dailyInvoiceModel.js";
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

const formatDate = (dateKey) => {
  if (!dateKey) return "-";

  const date = new Date(`${dateKey}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return dateKey;
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

/*
====================================================
GENERATE PDF
====================================================
*/

export const generateInvoicePDF = async (invoiceId) => {
  checkFonts();

  /*
  ================================================
  FETCH INVOICE
  ================================================
  */

  const invoice = await DailyInvoice.findById(invoiceId).lean();

  if (!invoice) {
    throw new Error("Invoice not found.");
  }

  /*
  ================================================
  FETCH SHOPKEEPER
  ================================================
  */

  const user = await User.findById(invoice.userId)
    .select("firstName lastName phoneNumber place address")
    .lean();

  if (!user) {
    throw new Error("Shopkeeper not found.");
  }

  /*
  ================================================
  PDF DOCUMENT
  ================================================
  */

  const doc = new PDFDocument({
    size: "A4",
    margin: 40,
    bufferPages: true,
  });

  const chunks = [];

  doc.on("data", (chunk) => {
    chunks.push(chunk);
  });

  const pdfPromise = new Promise((resolve, reject) => {
    doc.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    doc.on("error", reject);
  });

  /*
  ================================================
  COLORS
  ================================================
  */

  const BLACK = "#111827";
  const DARK = "#374151";
  const MUTED = "#6B7280";
  const LIGHT = "#F3F4F6";
  const BORDER = "#E5E7EB";
  const GREEN = "#059669";

  /*
  ================================================
  FONT HELPERS
  ================================================
  */

  const regular = () => {
    doc.font(REGULAR_FONT);
  };

  const bold = () => {
    doc.font(BOLD_FONT);
  };

  /*
  ================================================
  HEADER
  ================================================
  */

  bold();

  doc.fillColor(GREEN).fontSize(26).text("e-Setu", {
    align: "center",
  });

  doc.fillColor(BLACK).fontSize(13).text("दैनिक खरीदारी बिल", {
    align: "center",
  });

  regular();

  doc.fillColor(MUTED).fontSize(8).text("DAILY PURCHASE INVOICE", {
    align: "center",
    characterSpacing: 0.8,
  });

  doc.moveDown(0.8);

  /*
  ================================================
  HEADER LINE
  ================================================
  */

  doc
    .moveTo(40, doc.y)
    .lineTo(555, doc.y)
    .lineWidth(1)
    .strokeColor(BORDER)
    .stroke();

  /*
  ================================================
  SHOPKEEPER INFO
  ================================================
  */

  doc.moveDown(1);

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");

  const infoTop = doc.y;

  /*
  LEFT SIDE
  */

  bold();

  doc.fillColor(BLACK).fontSize(9).text("खरीदार", 40, infoTop);

  regular();

  doc
    .fillColor(DARK)
    .fontSize(10)
    .text(fullName || "N/A", 40, infoTop + 17);

  if (user.phoneNumber) {
    doc
      .fillColor(MUTED)
      .fontSize(8)
      .text(`फोन: ${user.phoneNumber}`, 40, infoTop + 35);
  }

  if (user.place) {
    doc.text(`स्थान: ${user.place}`, 40, infoTop + 50);
  }

  /*
  RIGHT SIDE
  */

  bold();

  doc.fillColor(BLACK).fontSize(9).text("बिल की तारीख", 390, infoTop, {
    width: 165,
    align: "right",
  });

  regular();

  doc
    .fillColor(DARK)
    .fontSize(10)
    .text(formatDate(invoice.dateKey), 390, infoTop + 17, {
      width: 165,
      align: "right",
    });

  if (invoice.totalOrders) {
    doc
      .fillColor(MUTED)
      .fontSize(8)
      .text(`कुल ऑर्डर: ${invoice.totalOrders}`, 390, infoTop + 35, {
        width: 165,
        align: "right",
      });
  }

  /*
  ADDRESS
  */

  let infoBottom = infoTop + 65;

  if (user.address) {
    regular();

    doc
      .fillColor(MUTED)
      .fontSize(8)
      .text(`पता: ${user.address}`, 40, infoBottom, {
        width: 500,
      });

    infoBottom += 18;
  }

  doc.y = infoBottom + 10;

  /*
  ================================================
  TABLE
  ================================================
  */

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

  let tableTop = doc.y;

  /*
  TABLE HEADER
  */

  doc.roundedRect(tableLeft, tableTop, tableWidth, headerHeight, 6).fill(LIGHT);

  bold();

  doc
    .fillColor(DARK)
    .fontSize(8.5)
    .text("उत्पाद", productX, tableTop + 9, {
      width: productWidth,
    });

  doc.text("माप", measurementX, tableTop + 9, {
    width: measurementWidth,
  });

  doc.text("मात्रा", qtyX, tableTop + 9, {
    width: qtyWidth,
    align: "center",
  });

  doc.text("कीमत", priceX, tableTop + 9, {
    width: priceWidth,
    align: "right",
  });

  doc.text("कुल", totalX, tableTop + 9, {
    width: totalWidth,
    align: "right",
  });

  /*
  ================================================
  TABLE ITEMS
  ================================================
  */

  let y = tableTop + headerHeight + 8;

  const rowHeight = 48;

  for (const item of invoice.items || []) {
    /*
    ==============================================
    PAGE BREAK
    ==============================================
    */

    if (y + rowHeight > 720) {
      doc.addPage();

      y = 50;

      /*
      Repeat table header on new page
      */

      doc.roundedRect(tableLeft, y, tableWidth, headerHeight, 6).fill(LIGHT);

      bold();

      doc
        .fillColor(DARK)
        .fontSize(8.5)
        .text("उत्पाद", productX, y + 9, {
          width: productWidth,
        });

      doc.text("माप", measurementX, y + 9, {
        width: measurementWidth,
      });

      doc.text("मात्रा", qtyX, y + 9, {
        width: qtyWidth,
        align: "center",
      });

      doc.text("कीमत", priceX, y + 9, {
        width: priceWidth,
        align: "right",
      });

      doc.text("कुल", totalX, y + 9, {
        width: totalWidth,
        align: "right",
      });

      y += headerHeight + 8;
    }

    /*
    ==============================================
    PRODUCT NAME
    ==============================================
    */

    bold();

    doc
      .fillColor(BLACK)
      .fontSize(10)
      .text(item.name || "Product", productX, y, {
        width: productWidth,
        height: 18,
        ellipsis: true,
      });

    /*
    HINGLISH NAME
    */

    if (item.hinglishName) {
      regular();

      doc
        .fillColor(MUTED)
        .fontSize(7.5)
        .text(item.hinglishName, productX, y + 18, {
          width: productWidth,
          height: 14,
          ellipsis: true,
        });
    }

    /*
    ==============================================
    MEASUREMENT
    ==============================================
    */

    regular();

    doc
      .fillColor(DARK)
      .fontSize(8.5)
      .text(item.measurement || "-", measurementX, y + 9, {
        width: measurementWidth,
      });

    /*
    ==============================================
    QUANTITY
    ==============================================
    */

    doc.text(String(item.qty || 0), qtyX, y + 9, {
      width: qtyWidth,
      align: "center",
    });

    /*
    ==============================================
    PRICE
    ==============================================
    */

    doc.text(formatMoney(item.price), priceX, y + 9, {
      width: priceWidth,
      align: "right",
    });

    /*
    ==============================================
    TOTAL
    ==============================================
    */

    bold();

    doc.fillColor(BLACK).text(formatMoney(item.total), totalX, y + 9, {
      width: totalWidth,
      align: "right",
    });

    /*
    ==============================================
    ROW DIVIDER
    ==============================================
    */

    doc
      .moveTo(tableLeft, y + rowHeight - 3)
      .lineTo(tableLeft + tableWidth, y + rowHeight - 3)
      .lineWidth(0.6)
      .strokeColor(BORDER)
      .stroke();

    y += rowHeight;
  }

  /*
  ================================================
  SUMMARY
  ================================================
  */

  y += 18;

  if (y > 700) {
    doc.addPage();
    y = 50;
  }

  /*
  SUMMARY LINE
  */

  doc.moveTo(350, y).lineTo(555, y).lineWidth(1).strokeColor(BORDER).stroke();

  y += 14;

  regular();

  doc
    .fillColor(MUTED)
    .fontSize(9)
    .text(`कुल ऑर्डर: ${invoice.totalOrders || 0}`, 350, y, {
      width: 205,
      align: "right",
    });

  y += 24;

  /*
  TOTAL BOX
  */

  doc.roundedRect(350, y, 205, 50, 8).fill("#ECFDF5");

  bold();

  doc
    .fillColor(GREEN)
    .fontSize(9)
    .text("कुल राशि", 365, y + 9, {
      width: 175,
      align: "right",
    });

  doc.fontSize(16).text(formatMoney(invoice.totalAmount), 365, y + 23, {
    width: 175,
    align: "right",
  });

  /*
  ================================================
  FOOTER
  ================================================
  */

  regular();

  doc
    .fillColor(MUTED)
    .fontSize(8)
    .text("e-Setu के साथ खरीदारी करने के लिए धन्यवाद 🙏", 40, 760, {
      width: 515,
      align: "center",
    });

  /*
  ================================================
  PAGE NUMBERS
  ================================================
  */

  const range = doc.bufferedPageRange();

  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);

    doc
      .fillColor(MUTED)
      .fontSize(7)
      .text(`Page ${i + 1 - range.start} of ${range.count}`, 40, 775, {
        width: 515,
        align: "right",
      });
  }

  /*
  ================================================
  FINISH PDF
  ================================================
  */

  doc.end();

  return await pdfPromise;
};
