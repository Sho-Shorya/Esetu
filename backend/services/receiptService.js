import PDFDocument from "pdfkit";

export const generateOrderReceipt = (order) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: 45,
      });

      const chunks = [];

      doc.on("data", (chunk) => {
        chunks.push(chunk);
      });

      doc.on("end", () => {
        resolve(Buffer.concat(chunks));
      });

      doc.on("error", reject);

      /*
       * HEADER
       */

      doc.fontSize(26).font("Helvetica-Bold").text("e-Setu");

      doc
        .fontSize(11)
        .font("Helvetica")
        .fillColor("#666666")
        .text("आज का ऑर्डर");

      doc.moveDown(1);

      /*
       * ORDER INFO
       */

      doc
        .fillColor("#111111")
        .fontSize(11)
        .font("Helvetica-Bold")
        .text(`Order: ${order.orderNumber || order._id}`);

      doc
        .font("Helvetica")
        .text(
          `Date: ${new Date(order.createdAt || Date.now()).toLocaleDateString(
            "en-IN",
          )}`,
        );

      if (order.status) {
        doc.text(`Status: ${String(order.status).toUpperCase()}`);
      }

      doc.moveDown(1);

      /*
       * CUSTOMER
       */

      if (order.userId?.name) {
        doc.font("Helvetica-Bold").text("Customer");

        doc.font("Helvetica").text(order.userId.name);

        if (order.userId.phoneNumber) {
          doc.text(order.userId.phoneNumber);
        }

        doc.moveDown(1);
      }

      /*
       * TABLE HEADER
       */

      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .text("Product", 45, doc.y, {
          continued: true,
          width: 240,
        })
        .text("Qty", {
          continued: true,
          width: 60,
        })
        .text("Price", {
          continued: true,
          width: 80,
        })
        .text("Total", {
          width: 80,
        });

      doc.moveDown(0.5);

      doc.moveTo(45, doc.y).lineTo(550, doc.y).strokeColor("#dddddd").stroke();

      doc.moveDown(0.5);

      /*
       * ITEMS
       */

      const items = order.items || [];

      items.forEach((item) => {
        const itemTotal =
          Number(item.total) || Number(item.price || 0) * Number(item.qty || 0);

        const itemPrice =
          Number(item.price) || itemTotal / Math.max(Number(item.qty) || 1, 1);

        doc
          .font("Helvetica")
          .fontSize(10)
          .fillColor("#111111")
          .text(item.name || "Product", 45, doc.y, {
            continued: true,
            width: 240,
          })
          .text(`${item.qty || 1} ${item.measurement || ""}`, {
            continued: true,
            width: 60,
          })
          .text(`₹${itemPrice.toFixed(2)}`, {
            continued: true,
            width: 80,
          })
          .text(`₹${itemTotal.toFixed(2)}`, {
            width: 80,
          });

        doc.moveDown(0.5);
      });

      /*
       * TOTAL
       */

      doc.moveDown(1);

      doc.moveTo(350, doc.y).lineTo(550, doc.y).strokeColor("#cccccc").stroke();

      doc.moveDown(0.7);

      const totalAmount = Number(order.totalAmount) || 0;

      doc
        .font("Helvetica-Bold")
        .fontSize(16)
        .text(`Total: ₹${totalAmount.toFixed(2)}`, 350, doc.y, {
          width: 200,
          align: "right",
        });

      /*
       * APPROVED
       */

      doc.moveDown(2);

      doc.fontSize(12).fillColor("#059669").text("✓ Order Approved", {
        align: "center",
      });

      doc.moveDown(1);

      doc
        .fontSize(9)
        .fillColor("#777777")
        .font("Helvetica")
        .text("यह receipt e-Setu द्वारा automatically generate की गई है।", {
          align: "center",
        });

      doc.text("धन्यवाद 🙏", {
        align: "center",
      });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};
