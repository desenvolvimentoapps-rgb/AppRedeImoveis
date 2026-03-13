import { v2 as cloudinary } from 'cloudinary'

const normalizeEnv = (value?: string) => value?.trim().replace(/^['"]|['"]$/g, '')

const cloudName = normalizeEnv(process.env.CLOUDINARY_CLOUD_NAME)
const apiKey = normalizeEnv(process.env.CLOUDINARY_API_KEY)
const apiSecret = normalizeEnv(process.env.CLOUDINARY_API_SECRET)
const cloudinaryUrl = normalizeEnv(process.env.CLOUDINARY_URL)

if (cloudinaryUrl) {
    process.env.CLOUDINARY_URL = cloudinaryUrl
}

const hasExplicitConfig = Boolean(cloudName && apiKey && apiSecret)
const hasValidUrl = Boolean(
    cloudinaryUrl &&
    !cloudinaryUrl.includes('<') &&
    !cloudinaryUrl.includes('your_api_key') &&
    !cloudinaryUrl.includes('your_api_secret')
)

if (hasExplicitConfig) {
    cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
    })
} else if (hasValidUrl) {
    // Falls back to CLOUDINARY_URL if present and valid
    cloudinary.config(true)
}

export { cloudinary }
