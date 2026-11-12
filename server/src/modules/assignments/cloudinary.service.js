import { v2 as cloudinary } from "cloudinary";
import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import { Readable } from "node:stream";
import { HttpError } from "../../utils/http-error.js";

let configured = false;

function rawDocumentPublicId(publicId, format) {
  const extension = String(format || "").replace(/^\./, "").toLowerCase();
  if (!extension || publicId.toLowerCase().endsWith(`.${extension}`)) return publicId;
  return `${publicId}.${extension}`;
}

function getCloudinaryErrorMessage(error, config) {
  const providerError = error?.error ?? error;
  const message = typeof providerError?.message === "string"
    ? providerError.message
    : "Unknown Cloudinary error";
  return [config.CLOUDINARY_API_KEY, config.CLOUDINARY_API_SECRET]
    .filter(Boolean)
    .reduce((result, credential) => result.replaceAll(credential, "[redacted]"), message)
    .slice(0, 240);
}

function throwUploadError(error, config, logMessage, userMessage) {
  const providerMessage = getCloudinaryErrorMessage(error, config);
  const providerError = error?.error ?? error;
  const status = Number.isInteger(providerError?.http_code)
    ? ` (HTTP ${providerError.http_code})`
    : "";
  console.error(logMessage, `${providerMessage}${status}`);
  const diagnostic = config.NODE_ENV === "development"
    ? ` Cloudinary: ${providerMessage}${status}`
    : "";
  throw new HttpError(502, `${userMessage}${diagnostic}`);
}

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
    throwUploadError(
      error,
      config,
      "Cloudinary settings image upload failed:",
      "The image could not be stored. Please try again.",
    );
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
  const extension = extname(file.originalname).toLowerCase();
  const documentId = `${randomUUID()}${extension}`;
  const upload = new Promise((resolve, reject) => {
    const stream = client.uploader.upload_stream(
      {
        resource_type: "raw",
        type: "authenticated",
        folder: `afterschool/${organizationId}`,
        public_id: documentId,
        filename: documentId,
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
    throwUploadError(
      error,
      config,
      "Cloudinary assignment upload failed:",
      "The document could not be stored. Please try again.",
    );
  }
  const format = asset.format || extension.slice(1) || "bin";
  return {
    publicId: rawDocumentPublicId(asset.public_id, format),
    originalFilename: file.originalname.replace(/[^\w.\- ()]/g, "_").slice(0, 180),
    format,
    bytes: asset.bytes,
  };
}

export async function uploadVideo(file, organizationId, config) {
  const client = getCloudinary(config);
  const upload = new Promise((resolve, reject) => {
    const stream = client.uploader.upload_stream(
      {
        resource_type: "video",
        type: "authenticated",
        folder: `afterschool/${organizationId}/class-videos`,
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
    throwUploadError(
      error,
      config,
      "Cloudinary class video upload failed:",
      "The video could not be stored. Please try again.",
    );
  }
  return {
    publicId: asset.public_id,
    originalFilename: file.originalname.replace(/[^\w.\- ()]/g, "_").slice(0, 180),
    format: asset.format || "mp4",
    bytes: asset.bytes,
  };
}

export async function deleteDocument(attachment, config) {
  if (!attachment?.publicId) return;
  const client = getCloudinary(config);
  try {
    await client.uploader.destroy(rawDocumentPublicId(attachment.publicId, attachment.format), {
      resource_type: "raw",
      type: "authenticated",
      invalidate: true,
    });
  } catch (error) {
    console.error("Cloudinary document cleanup failed:", error.message);
  }
}

export async function deleteVideo(attachment, config) {
  if (!attachment?.publicId) return;
  const client = getCloudinary(config);
  try {
    await client.uploader.destroy(attachment.publicId, {
      resource_type: "video",
      type: "authenticated",
      invalidate: true,
    });
  } catch (error) {
    console.error("Cloudinary class video cleanup failed:", error.message);
  }
}

export function privateDocumentUrl(attachment, config) {
  const client = getCloudinary(config);
  return client.utils.private_download_url(
    rawDocumentPublicId(attachment.publicId, attachment.format),
    attachment.format,
    {
      resource_type: "raw",
      type: "authenticated",
      attachment: attachment.originalFilename,
      expires_at: Math.floor(Date.now() / 1000) + 300,
    },
  );
}

export function privateVideoUrl(attachment, config) {
  const client = getCloudinary(config);
  return client.utils.private_download_url(attachment.publicId, attachment.format, {
    resource_type: "video",
    type: "authenticated",
    attachment: false,
    expires_at: Math.floor(Date.now() / 1000) + 300,
  });
}
