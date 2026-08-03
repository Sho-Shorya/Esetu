export const saveSubscriptionId = async (req, res) => {
  try {
    console.log("===== SAVE SUBSCRIPTION =====");
    console.log("User ID:", req.userId);
    console.log("Body:", req.body);

    const { subscriptionId } = req.body;

    if (!subscriptionId) {
      return res.status(400).json({
        success: false,
        message: "Subscription ID is required",
      });
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      {
        oneSignalSubscriptionId: subscriptionId,
      },
      { new: true },
    );

    console.log("Updated User:", user);

    res.status(200).json({
      success: true,
      message: "Subscription ID saved successfully",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
