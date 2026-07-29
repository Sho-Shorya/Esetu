import jwt from "jsonwebtoken";

export const generateToken = async (userId) => {
  try {
    const token = await jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '2y' })
    return token
  } catch (error) {
    throw new Error(`Generate token error: ${error.message}`)
  }
}