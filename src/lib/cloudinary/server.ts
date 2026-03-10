import { v2 as cloudinary } from 'cloudinary'

const hasExplicitConfig = Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
)

if (hasExplicitConfig) {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
    })
} else {
    // Falls back to CLOUDINARY_URL if present
    cloudinary.config(true)
}

export { cloudinary }
