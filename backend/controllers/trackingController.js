import { CurrentLocation, RouteLocation } from "../models/trackingModel.js";

export const saveLocation = async (req, res) => {
  try {
    const { supplierId, routeId, latitude, longitude, timestamp } = req.body;

    // ------------------------------------------
    // Validate required fields
    // ------------------------------------------

    if (
      !supplierId ||
      !routeId ||
      latitude === undefined ||
      longitude === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: "supplierId, routeId, latitude and longitude are required",
      });
    }

    // ------------------------------------------
    // Validate coordinates
    // ------------------------------------------

    if (
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid latitude or longitude",
      });
    }

    const locationTime = timestamp ? new Date(timestamp) : new Date();

    // ------------------------------------------
    // 1. UPDATE CURRENT LOCATION
    // ------------------------------------------

    const currentLocation = await CurrentLocation.findOneAndUpdate(
      { supplierId },

      {
        supplierId,
        routeId,
        latitude,
        longitude,
        updatedAt: locationTime,
        trackingActive: true,
      },

      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      },
    );

    // ------------------------------------------
    // 2. SAVE ROUTE HISTORY
    //
    // For now we save the point.
    // We'll add 2-5 minute filtering next.
    // ------------------------------------------

    const routeLocation = await RouteLocation.create({
      supplierId,
      routeId,
      latitude,
      longitude,
      timestamp: locationTime,
    });

    return res.status(200).json({
      success: true,
      message: "Location updated",

      currentLocation: {
        supplierId: currentLocation.supplierId,
        routeId: currentLocation.routeId,
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        updatedAt: currentLocation.updatedAt,
        trackingActive: currentLocation.trackingActive,
      },

      routeLocationId: routeLocation._id,
    });
  } catch (error) {
    console.error("Save location error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to save location",
      error: error.message,
    });
  }
};

export const getCurrentLocation = async (req, res) => {
  try {
    const { supplierId } = req.params;

    if (!supplierId) {
      return res.status(400).json({
        success: false,
        message: "supplierId is required",
      });
    }

    const location = await CurrentLocation.findOne({
      supplierId,
    });

    if (!location) {
      return res.status(404).json({
        success: false,
        message: "No current location found",
      });
    }

    return res.status(200).json({
      success: true,
      location,
    });
  } catch (error) {
    console.error("Get current location error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get current location",
      error: error.message,
    });
  }
};
