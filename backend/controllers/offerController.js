import { Offer } from "../models/offerModel.js"

export const listOffers = async (_, res) => {
  try {
    const offers = await Offer.find({}).sort({ createdAt: -1 })
    return res.status(200).json({ success: true, offers })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}

export const getOffer = async (req, res) => {
  try {
    const { id } = req.params
    const offer = await Offer.findById(id)
    if (!offer) return res.status(404).json({ success: false, message: "Offer not found" })
    return res.status(200).json({ success: true, offer })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}

export const createOffer = async (req, res) => {
  try {
    const { title, description, discountPercent, products, startDate, endDate, active } = req.body
    if (!title || discountPercent === undefined) return res.status(400).json({ success: false, message: "Title and discountPercent are required" })
    const offer = await Offer.create({ title, description, discountPercent: Number(discountPercent), products: products || [], startDate, endDate, active: active !== undefined ? !!active : true, createdBy: req.userId })
    return res.status(201).json({ success: true, offer })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}

export const updateOffer = async (req, res) => {
  try {
    const { id } = req.params
    const offer = await Offer.findById(id)
    if (!offer) return res.status(404).json({ success: false, message: "Offer not found" })
    const { title, description, discountPercent, products, startDate, endDate, active } = req.body
    if (title !== undefined) offer.title = title
    if (description !== undefined) offer.description = description
    if (discountPercent !== undefined) offer.discountPercent = Number(discountPercent)
    if (products !== undefined) offer.products = products
    if (startDate !== undefined) offer.startDate = startDate
    if (endDate !== undefined) offer.endDate = endDate
    if (active !== undefined) offer.active = !!active
    await offer.save()
    return res.status(200).json({ success: true, offer })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}

export const deleteOffer = async (req, res) => {
  try {
    const { id } = req.params
    const offer = await Offer.findById(id)
    if (!offer) return res.status(404).json({ success: false, message: "Offer not found" })
    await Offer.findByIdAndDelete(id)
    return res.status(200).json({ success: true, message: "Offer deleted" })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}
