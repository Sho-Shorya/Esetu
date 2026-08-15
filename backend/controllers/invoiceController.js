import { generateInvoicePDF } from "../services/invoicePdfService.js";
import { DailyInvoice } from "../models/dailyInvoiceModel.js";

export const downloadInvoicePDF = async (req, res) => {
  try {
    const userId = req.userId;
    const { invoiceId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Please login first.",
      });
    }

    if (!invoiceId) {
      return res.status(400).json({
        success: false,
        message: "Invoice ID is required.",
      });
    }

    /*
    ==================================================
    CHECK INVOICE OWNERSHIP
    ==================================================
    */

    const invoice = await DailyInvoice.findOne({
      _id: invoiceId,
      userId,
    }).lean();

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found.",
      });
    }

    /*
    ==================================================
    GENERATE PDF
    ==================================================
    */

    const pdfBuffer = await generateInvoicePDF(invoiceId);

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="e-setu-invoice-${invoice.dateKey}.pdf"`,
      "Content-Length": pdfBuffer.length,
    });

    return res.send(pdfBuffer);
  } catch (error) {
    console.error("Download Invoice PDF Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to generate invoice PDF.",
      error: error.message,
    });
  }
};

/*
====================================================
GET MY INVOICE HISTORY
====================================================

Returns invoices belonging to the logged-in shopkeeper.

GET:
 /api/v1/user/invoice/my-invoices
*/

export const getMyInvoiceHistory = async (req, res) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Please login first.",
      });
    }

    const invoices = await DailyInvoice.find({
      userId,
    })
      .sort({
        dateKey: -1,
      })
      .lean();

    return res.status(200).json({
      success: true,
      count: invoices.length,
      invoices,
    });
  } catch (error) {
    console.error("Get My Invoice History Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch invoice history.",
      error: error.message,
    });
  }
};
