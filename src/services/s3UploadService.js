const crypto = require("crypto");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const env = require("../config/env");

let s3Client;

function getS3Client() {
  if (s3Client) {
    return s3Client;
  }

  if (!env.awsRegion || !env.awsS3Bucket || !env.awsAccessKeyId || !env.awsSecretAccessKey) {
    throw new Error("AWS S3 is not configured. Please set AWS credentials and bucket in backend .env");
  }

  s3Client = new S3Client({
    region: env.awsRegion,
    credentials: {
      accessKeyId: env.awsAccessKeyId,
      secretAccessKey: env.awsSecretAccessKey
    }
  });

  return s3Client;
}

function buildObjectKey(originalName, folderPrefix) {
  const randomPart = crypto.randomBytes(8).toString("hex");
  const safeName = originalName.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "");
  return `${folderPrefix}/${Date.now()}-${randomPart}-${safeName}`;
}

async function uploadFileToS3({ fileBuffer, contentType, originalName, folderPrefix }) {
  const client = getS3Client();
  const key = buildObjectKey(originalName, folderPrefix);
  const fileName = key.split("/").pop() || "";

  await client.send(
    new PutObjectCommand({
      Bucket: env.awsS3Bucket,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType
    })
  );

  return {
    key,
    fileName,
    url: `https://${env.awsS3Bucket}.s3.${env.awsRegion}.amazonaws.com/${key}`
  };
}

module.exports = {
  uploadFileToS3
};
