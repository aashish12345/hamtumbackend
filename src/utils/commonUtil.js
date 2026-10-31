// const randomstring = require('randomstring');
const {MESSAGESENG,MESSAGESHN} = require('../constant');
const { v4: uuidv4 } = require("uuid");

const isValidEmail = (email) => {
    const pattern = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return new RegExp(pattern).test(email);
}

const isValidPhone = (phone, verifyCountryCode) => {
    const reExp = verifyCountryCode ? /^\+\d{6,10}$/ : /^\d{6,10}$/;
    return reExp.test(phone);
}
const rand = function() {
    return Math.random().toString(36).substring(2)+Math.random().toString(36).substring(2); // remove `0.`
};
const MessageBehalfOfLanguage = (language) => {
    if (language === 'en') {
        return MESSAGESENG;
    } else {
        return MESSAGESHN;
    }
}

const getValueFromConstant = (constantName,language) => {
    const constants = language === 'en' ? MESSAGESENG : MESSAGESHN;
    return constants?.MESSAGES[constantName];
};

const generateOtp = () => {
    // Declare a digits variable  
    // which stores all digits 
    var digits = '0123456789';
    let OTP = '';
    for (let i = 0; i < 4; i++) {
        OTP += digits[Math.floor(Math.random() * 10)];
    }
    return OTP;
};

const validateIPaddress = (ipAddress) => {
    const octet = '(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]?|0)';
    const regex = new RegExp(`^${octet}\\.${octet}\\.${octet}\\.${octet}$`);
    return regex.test(ipAddress);
};

const getUploadPayload = ({ req, defaultMimeType = "image/jpeg" }) => {
    const file = req?.file;
    const base64Data = req?.body?.fileDataBase64;
    const { v4: uuidv4 } = require("uuid");

    if (file?.buffer) {
        return {
            ok: true,
            fileBuffer: file.buffer,
            mimeType: file.mimetype || defaultMimeType,
            fileName: file.originalname || `${Date.now()}-${uuidv4()}`,
        };
    }

    if (typeof base64Data === "string" && base64Data.length > 0) {
        try {
            // Supports plain base64 and data URL format.
            const normalizedBase64 = base64Data.includes(",")
                ? base64Data.split(",").pop()
                : base64Data;

            const fileName = req?.body?.fileName || `${Date.now()}-${uuidv4()}`;
            const mimeType = req?.body?.mimeType || defaultMimeType;

            return {
                ok: true,
                fileBuffer: Buffer.from(normalizedBase64, "base64"),
                mimeType: mimeType,
                fileName: fileName,
            };
        } catch (error) {
            return {
                ok: false,
                statusCode: 400,
                message: "Invalid base64 file data",
            };
        }
    }

    return {
        ok: false,
        statusCode: 400,
        message: "Please upload a file",
    };
};

const validateUploadSize = ({ fileBuffer, mimeType, limits }) => {
    const isVideo = typeof mimeType === "string" && mimeType.startsWith("video/");
    const maxBytes = isVideo ? limits.video : limits.image;

    if (fileBuffer.length > maxBytes) {
        return {
            ok: false,
            statusCode: 413,
            message: isVideo
                ? "Video size exceeds the maximum limit of 100 MB"
                : "Image size exceeds the maximum limit of 10 MB",
        };
    }

    return {
        ok: true,
    };
};

const uploadToS3 = async ({ fileBuffer, mimeType, keyPath }) => {
    const { uploadImageToS3 } = require("../uploads/uploadFileAWS");
    const constant = require("../constant");
    const fileNameNew = Date.now() + "-" + uuidv4();
    const params = {
        Bucket: constant.AWS.AWS_DETAILS.S3BucketName,
        Key: `${keyPath}/${fileNameNew}`,
        Body: fileBuffer,
        ContentType: mimeType,
    };
    await uploadImageToS3(params);
    return fileNameNew;
};

module.exports = {
    isValidEmail,
    isValidPhone,
    generateOtp,
    validateIPaddress,
    rand,
    MessageBehalfOfLanguage,
    getValueFromConstant,
    getUploadPayload,
    validateUploadSize,
    uploadToS3
}