export const saveSubscriptionId = async (req, res) => {
  try {
    const { subscriptionId } = req.body;

    if (!subscriptionId) {
      return res.status(400).json({
        success: false,
        message: "Subscription ID is required",
      });
    }

    await User.findByIdAndUpdate(req.user._id, {
      oneSignalSubscriptionId: subscriptionId,
    });

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
