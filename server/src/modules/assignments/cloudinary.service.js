import { v2 as cloudinary } from "cloudinary";
import { Readable } from "node:stream";
import { HttpError } from "../../utils/http-error.js";

let configured = false;

export function getCloudinary(config) {
  if (!config.CLOUDINARY_CLOUD_NAME || !config.CLOUDINARY_API_KEY || !config.CLOUDINARY_API_SECRET) {
    throw new HttpError(503, "Document uploads are not configured. Set the Cloudinary server credentials.");
  }
  if (!configured) {
    cloudinary.config({
      cloud_name: config.CLOUDINARY_CLOUD_NAME,
      api_key: config.CLOUDINARY_API_KEY,
      api_secret: config.CLOUDINARY_API_SECRET,
      secure: true,
    });
    configured = true;
  }
  return cloudinary;
}

export async function uploadImage(file, folder, config) {
  const client = getCloudinary(config);
  const upload = new Promise((resolve, reject) => {
    const stream = client.uploader.upload_stream(
      {
        resource_type: "image",
        folder: `afterschool/${folder}`,
        use_filename: false,
        unique_filename: true,
        overwrite: false,
      },
      (error, result) => (error ? reject(error) : resolve(result)),
    );
    Readable.from(file.buffer).pipe(stream);
  });
  try {
    const asset = await upload;
    return { publicId: asset.public_id, url: asset.secure_url };
  } catch (error) {
    console.error("Cloudinary settings image upload failed:", error.message);
    throw new HttpError(502, "The image could not be stored. Please try again.");
  }
}

export async function deleteImage(publicId, config) {
  if (!publicId) return;
  const client = getCloudinary(config);
  try {
    await client.uploader.destroy(publicId, { resource_type: "image", invalidate: true });
  } catch (error) {
    console.error("Cloudinary settings image cleanup failed:", error.message);
  }
}

export async function uploadDocument(file, organizationId, config) {
  const client = getCloudinary(config);
  const upload = new Promise((resolve, reject) => {
    const stream = client.uploader.upload_stream(
      {
        resource_type: "raw",
        type: "authenticated",
        folder: `afterschool/${organizationId}`,
        use_filename: false,
        unique_filename: true,
      },
      (error, result) => (error ? reject(error) : resolve(result)),
    );
    Readable.from(file.buffer).pipe(stream);
  });

  let asset;
  try {
    asset = await upload;
  } catch (error) {
    console.error("Cloudinary assignment upload failed:", error.message);
    throw new HttpError(502, "The document could not be stored. Please try again.");
  }
  return {
    publicId: asset.public_id,
    originalFilename: file.originalname.replace(/[^\w.\- ()]/g, "_").slice(0, 180),
    format: asset.format || file.originalname.split(".").pop()?.toLowerCase() || "bin",
    bytes: asset.bytes,
  };
}

export async function deleteDocument(attachment, config) {
  if (!attachment?.publicId) return;
  const client = getCloudinary(config);
  try {
    await client.uploader.destroy(attachment.publicId, {
      resource_type: "raw",
      type: "authenticated",
      invalidate: true,
    });
  } catch (error) {
    console.error("Cloudinary document cleanup failed:", error.message);
  }
}

export function privateDocumentUrl(attachment, config) {
  const client = getCloudinary(config);
  return client.utils.private_download_url(attachment.publicId, attachment.format, {
    resource_type: "raw",
    type: "authenticated",
    attachment: attachment.originalFilename,
    expires_at: Math.floor(Date.now() / 1000) + 300,
  });
}
