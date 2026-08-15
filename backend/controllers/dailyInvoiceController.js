import { generateDailyInvoices } from "../services/dailyInvoiceService.js";

export const generateDailyInvoicesNow = async (req, res) => {
  try {
    console.log("🧪 Manual daily invoice generation started");

    const result = await generateDailyInvoices();

    return res.status(200).json({
      success: true,
      message: "Daily invoices generated successfully.",
      result,
    });
  } catch (error) {
    console.error("❌ Manual Daily Invoice Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to generate daily invoices.",
      error: error.message,
    });
  }
};
