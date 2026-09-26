import mongoose from "mongoose"
import dotenv from "dotenv";
import dns from "dns";

dotenv.config({ quiet: true });

/**
 * Some networks (including a plain home router) refuse to resolve the
 * mongodb+srv parent record while still resolving the individual shard
 * hostnames, which surfaces as a confusing `querySrv ECONNREFUSED`. Pointing
 * Node at public resolvers fixes it. Opt-in so normal environments are
 * untouched.
 */
const applyDnsServers = () => {
  const configured = String(process.env.MONGO_DNS_SERVERS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (configured.length > 0) {
    dns.setServers(configured);
    console.log(`MongoDB using custom DNS resolvers: ${configured.join(", ")}`);
  }
};

// Optional explicit database name. The URI is used as-is when this is unset, so
// the current behaviour is preserved exactly.
const resolveUri = () => {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is not set.");
  const dbName = String(process.env.MONGO_DB_NAME || "").trim();
  if (!dbName) return uri;

  if (!/^mongodb(\+srv)?:\/\//.test(uri)) return uri;
  const [head, query = ""] = uri.split("?");
  const afterScheme = head.replace(/^mongodb(\+srv)?:\/\//, "");
  const slash = afterScheme.indexOf("/");
  const credentials = slash === -1 ? afterScheme : afterScheme.slice(0, slash);
  const rebuilt = `mongodb+srv://${credentials}/${encodeURIComponent(dbName)}`;
  return query ? `${rebuilt}?${query}` : rebuilt;
};

export const connectDb = async () => {
  try {
    applyDnsServers();
    await mongoose.connect(resolveUri(), {
      maxPoolSize: 10,
      minPoolSize: 1,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 60000,
      family: 4,
    });
    console.log(
      `MongoDB connected successfully (db "${mongoose.connection.name}" on ${mongoose.connection.host})`,
    );
    return true;
  }
  catch (error) {
    console.error("MongoDB connection failed:", error.message);
    if (/ECONNREFUSED|ENOTFOUND|querySrv/i.test(error.message) && !process.env.MONGO_DNS_SERVERS) {
      console.error(
        "Hint: this is usually the local resolver refusing the mongodb+srv lookup. " +
          "Set MONGO_DNS_SERVERS=8.8.8.8,1.1.1.1 in .env and retry.",
      );
    }
    return false;
  }
}
