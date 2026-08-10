import mongoose from "mongoose";

const routeSchema = new mongoose.Schema(
  {
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    startedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },

    endedAt: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: ["active", "completed"],
      default: "active",
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

// Quickly find active route for a supplier
routeSchema.index({
  supplierId: 1,
  status: 1,
});

const Route = mongoose.model("Route", routeSchema);

export default Route;
