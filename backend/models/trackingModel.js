import mongoose from "mongoose";

// --------------------------------------------------
// CURRENT LOCATION
// One document per supplier.
// This is what the user app will use for live tracking.
// --------------------------------------------------

const currentLocationSchema = new mongoose.Schema(
  {
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      unique: true,
      index: true,
    },

    routeId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },

    latitude: {
      type: Number,
      required: true,
    },

    longitude: {
      type: Number,
      required: true,
    },

    updatedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },

    trackingActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

export const CurrentLocation = mongoose.model(
  "CurrentLocation",
  currentLocationSchema,
);

// --------------------------------------------------
// ROUTE HISTORY
// Selected GPS points from a route.
// We DON'T need to save every 30-second update here.
// --------------------------------------------------

const routeLocationSchema = new mongoose.Schema(
  {
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    routeId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    latitude: {
      type: Number,
      required: true,
    },

    longitude: {
      type: Number,
      required: true,
    },

    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

// Helps us quickly get today's route for a supplier.
routeLocationSchema.index({
  supplierId: 1,
  routeId: 1,
  timestamp: 1,
});

export const RouteLocation = mongoose.model(
  "RouteLocation",
  routeLocationSchema,
);
