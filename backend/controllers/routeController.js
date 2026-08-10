import Route from "../models/routeModel.js";
import { CurrentLocation, RouteLocation } from "../models/trackingModel.js";

// ---------------------------------------------
// START ROUTE
// ---------------------------------------------

export const startRoute = async (req, res) => {
  console.log("🔥 START ROUTE REQUEST RECEIVED");
  console.log("Body:", req.body);
  try {
    const { supplierId } = req.body;

    if (!supplierId) {
      return res.status(400).json({
        success: false,
        message: "supplierId is required",
      });
    }

    // Check if supplier already has an active route
    const existingRoute = await Route.findOne({
      supplierId,
      status: "active",
    });

    if (existingRoute) {
      return res.status(409).json({
        success: false,
        message: "Supplier already has an active route",
        route: existingRoute,
      });
    }

    const route = await Route.create({
      supplierId,
      startedAt: new Date(),
      status: "active",
    });

    return res.status(201).json({
      success: true,
      message: "Route started",
      route,
    });
  } catch (error) {
    console.error("Start route error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to start route",
      error: error.message,
    });
  }
};

// ---------------------------------------------
// END ROUTE
// ---------------------------------------------

export const endRoute = async (req, res) => {
  try {
    const { routeId } = req.body;

    if (!routeId) {
      return res.status(400).json({
        success: false,
        message: "routeId is required",
      });
    }

    const route = await Route.findOne({
      _id: routeId,
      status: "active",
    });

    if (!route) {
      return res.status(404).json({
        success: false,
        message: "Active route not found",
      });
    }

    route.status = "completed";
    route.endedAt = new Date();

    await route.save();

    // Mark current location as inactive
    await CurrentLocation.findOneAndUpdate(
      { supplierId: route.supplierId },
      {
        trackingActive: false,
      },
    );

    return res.status(200).json({
      success: true,
      message: "Route ended",
      route,
    });
  } catch (error) {
    console.error("End route error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to end route",
      error: error.message,
    });
  }
};
