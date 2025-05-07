const { dateTime } = require("./../../../../utils/date_time");
const util = require("util");
const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");
const outputPath = path.join(__dirname, "../../../../");

const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const ffprobePath = require("@ffprobe-installer/ffprobe").path;
const ffmpeg = require("fluent-ffmpeg");
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);


// Load Google Drive credentials
const KEY_FILE_PATH = "./client_secret.json"; // Replace with your file
const SCOPES = ["https://www.googleapis.com/auth/drive.file"];

// const auth = new google.auth.GoogleAuth({
//   keyFile: KEY_FILE_PATH,
//   scopes: SCOPES,
// });

const auth = new google.auth.GoogleAuth({
  keyFile: path.join(__dirname, "../../../../service_account.json"), // Make sure this file exists
  scopes: ["https://www.googleapis.com/auth/drive.file"],
});


const drive = google.drive({ version: "v3", auth });

const {
  successRes,
  errorRes,
  multiSuccessRes,
} = require("../../../../utils/common_fun");

const uploadMedia = async (req, res) => {
  try {
    let { multimedia_files } = req.files;

    const filesArray = Array.isArray(multimedia_files)
      ? multimedia_files
      : multimedia_files
      ? [multimedia_files]
      : [];

    if (
      filesArray.length === 0 ||
      (filesArray.length === 1 && filesArray[0].size === 0)
    ) {
      return errorRes(res, "No files uploaded");
    }

    console.log({ multimedia_files });

    const mediaData = [];

    const mediaFolder = path.join(outputPath, "public/chat_media");

    // Ensure the directory exists
    if (!fs.existsSync(mediaFolder)) {
      fs.mkdirSync(mediaFolder, { recursive: true });
    }

    for (const file of filesArray) {
      const fileExtension = file.originalFilename
        .split(".")
        .pop()
        .toLowerCase();
      const fileName = `${Math.floor(
        1000 + Math.random() * 9000
      )}_${Date.now()}.${fileExtension}`;
      const filePath = `public/chat_media/${fileName}`;
      const orginalfilePath = `chat_media/${fileName}`;

      // Process based on file type
      if (
        ["mp4", "mov", "wmv", "avi", "avchd", "mkv"].includes(fileExtension)
      ) {
        const thumbnailName = fileName.replace(/\.[^/.]+$/, ".jpeg");
        const thumbnailPath = `public/chat_media/${thumbnailName}`;
        const originalthumbnailPath = `chat_media/${thumbnailName}`;

        await fs.readFile(file.path, function (err, data) {
          if (err) throw err;

          fs.writeFile(filePath, data, function (err) {
            if (err) throw err;
          });

          ffmpeg(filePath)
            .screenshots({
              timestamps: ["50%"],
              filename: thumbnailName,
              folder: "public/chat_media",
            })
            .on("end", () => console.log("Thumbnail created"))
            .on("error", (err) => console.error("Thumbnail error:", err));
        });

        mediaData.push({
          file_type: "video",
          file_name: orginalfilePath,
          thumbnail: originalthumbnailPath,
        });
      } else if (
        ["jpeg", "jpg", "png", "raw", "jfif"].includes(fileExtension)
      ) {
        await fs.readFile(file.path, function (err, data) {
          if (err) throw err;

          fs.writeFile(filePath, data, function (err) {
            if (err) throw err;
          });
        });

        mediaData.push({ file_type: "image", file_name: orginalfilePath });
      } else if (["mp3", "mpeg", "aac", "m4a"].includes(fileExtension)) {
        await fs.readFile(file.path, function (err, data) {
          if (err) throw err;

          fs.writeFile(filePath, data, function (err) {
            if (err) throw err;
          });
        });

        mediaData.push({ file_type: "audio", file_name: orginalfilePath });
      }else if (["pdf", "zip", "doc", "txt"].includes(fileExtension)) {
        await fs.readFile(file.path, function (err, data) {
          if (err) throw err;

          fs.writeFile(filePath, data, function (err) {
            if (err) throw err;
          });
        });

        mediaData.push({ file_type: fileExtension, file_name: orginalfilePath,original_name:file.originalFilename,file_size:file.size });
      }
    }

    return successRes(res, "Files uploaded successfully", {
      media_files: mediaData,
    });
  } catch (error) {
    console.error("Error:", error);
    return errorRes(res, "Internal server error");
  }
};

const removeMedia = async (req, res) => {
  try {
    let { mediaFiles } = req.body;

    mediaFiles = JSON.parse(mediaFiles);
    // Expecting an array of media objects

    if (!Array.isArray(mediaFiles) || mediaFiles.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No media files provided." });
    }

    for (const media of mediaFiles) {
      let { file_type, file_name, thumbnail } = media;

      const filePath = `public/${file_name}`;
      const thumbnailPath = `public/${thumbnail}`;

      if (!file_type || !file_name) {
        console.warn("Invalid media object:", media);
        continue; // Skip invalid entries
      }

      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        console.log(`File removed: ${file_name}`);
      } else {
        console.warn(`File not found: ${file_name}`);
      }

      if (file_type === "video" && thumbnail) {
        if (fs.existsSync(thumbnailPath)) {
          await fs.promises.unlink(thumbnailPath);
          console.log(`Thumbnail removed: ${thumbnail}`);
        } else {
          console.warn(`Thumbnail not found: ${thumbnail}`);
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: "Media files removed successfully.",
    });
  } catch (error) {
    console.error("Error removing media files:", error);
    return res.status(500).json({
      success: false,
      message: "Error removing media files.",
      error: error.message,
    });
  }
};

const uploadWallpaper = async (req, res) => {
  try {
    let { multimedia_files } = req.files;

    const filesArray = Array.isArray(multimedia_files)
      ? multimedia_files
      : multimedia_files
      ? [multimedia_files]
      : [];

    if (
      filesArray.length === 0 ||
      (filesArray.length === 1 && filesArray[0].size === 0)
    ) {
      return errorRes(res, "No files uploaded");
    }

    console.log({ multimedia_files });

    const mediaData = [];

    const mediaFolder = path.join(outputPath, "public/themes");

    // Ensure the directory exists
    if (!fs.existsSync(mediaFolder)) {
      fs.mkdirSync(mediaFolder, { recursive: true });
    }

    for (const file of filesArray) {
      const fileExtension = file.originalFilename
        .split(".")
        .pop()
        .toLowerCase();
      const fileName = `${Math.floor(
        1000 + Math.random() * 9000
      )}_${Date.now()}.${fileExtension}`;
      const filePath = `public/themes/${fileName}`;
      const orginalfilePath = `themes/${fileName}`;

      // Process based on file type
      // if (["mp4", "mov", "wmv", "avi", "avchd", "mkv"].includes(fileExtension)) {
      //   const thumbnailName = fileName.replace(/\.[^/.]+$/, ".jpeg");
      //   const thumbnailPath = `public/chat_media/${thumbnailName}`;
      //   const originalthumbnailPath = `chat_media/${thumbnailName}`;

      //   await fs.readFile(file.path, function (err, data) {
      //     if (err) throw err;

      //     fs.writeFile(filePath, data, function (err) {
      //       if (err) throw err;
      //     });

      //     ffmpeg(filePath)
      //       .screenshots({ timestamps: ["50%"], filename: thumbnailName, folder: "public/chat_media" })
      //       .on("end", () => console.log("Thumbnail created"))
      //       .on("error", (err) => console.error("Thumbnail error:", err));
      //   });

      //   mediaData.push({ file_type: "video", file_name: orginalfilePath, thumbnail: originalthumbnailPath });
      // }
      if (["jpeg", "jpg", "png", "raw", "jfif"].includes(fileExtension)) {
        await fs.readFile(file.path, function (err, data) {
          if (err) throw err;

          fs.writeFile(filePath, data, function (err) {
            if (err) throw err;
          });
        });

        mediaData.push({ file_type: "image", file_name: orginalfilePath });
      } else {
        console.warn("Invalid file type:", fileExtension);
        // return errorRes("Invalid file type:", fileExtension)
      }
    }

    return successRes(res, "Files uploaded successfully", {
      media_files: mediaData,
    });
  } catch (error) {
    console.error("Error:", error);
    return errorRes(res, "Internal server error");
  }
};

const uploadProfilePicture = async (req, res) => {
  try {
    let { profile_picture } = req.files;

    let file = Array.isArray(profile_picture)
      ? profile_picture
      : profile_picture
      ? [profile_picture]
      : [];

    if (file.length === 0 || (file.length === 1 && file[0].size === 0)) {
      return errorRes(res, "No files uploaded");
    }

    if (file.length > 1) {
      return errorRes(res, "Only one profile picture can be uploaded");
    }

    const mediaData = [];

    const mediaFolder = path.join(outputPath, "public/profiles");

    // Ensure the directory exists
    if (!fs.existsSync(mediaFolder)) {
      fs.mkdirSync(mediaFolder, { recursive: true });
    }

    file = file[0];

    const fileExtension = file.originalFilename.split(".").pop().toLowerCase();
    const fileName = `${Math.floor(
      1000 + Math.random() * 9000
    )}_${Date.now()}.${fileExtension}`;
    const filePath = `public/profiles/${fileName}`;
    const orginalfilePath = `profiles/${fileName}`;

    // Process based on file type
    // if (["mp4", "mov", "wmv", "avi", "avchd", "mkv"].includes(fileExtension)) {
    //   const thumbnailName = fileName.replace(/\.[^/.]+$/, ".jpeg");
    //   const thumbnailPath = `public/chat_media/${thumbnailName}`;
    //   const originalthumbnailPath = `chat_media/${thumbnailName}`;

    //   await fs.readFile(file.path, function (err, data) {
    //     if (err) throw err;

    //     fs.writeFile(filePath, data, function (err) {
    //       if (err) throw err;
    //     });

    //     ffmpeg(filePath)
    //       .screenshots({ timestamps: ["50%"], filename: thumbnailName, folder: "public/chat_media" })
    //       .on("end", () => console.log("Thumbnail created"))
    //       .on("error", (err) => console.error("Thumbnail error:", err));
    //   });

    //   mediaData.push({ file_type: "video", file_name: orginalfilePath, thumbnail: originalthumbnailPath });
    // }
    if (["jpeg", "jpg", "png", "raw", "jfif"].includes(fileExtension)) {
      await fs.readFile(file.path, function (err, data) {
        if (err) throw err;

        fs.writeFile(filePath, data, function (err) {
          if (err) throw err;
        });
      });

      return successRes(res, "Profile picture uploaded successfully", { file_type: "image", file_name: orginalfilePath,file_url : process.env.BASE_URL + orginalfilePath });
      // mediaData.push({ file_type: "image", file_name: orginalfilePath });
    } else {
      console.warn("Invalid file type:", fileExtension);
      return errorRes("Invalid file type:", fileExtension)
    }
  } catch (error) {
    console.error("Error:", error);
    return errorRes(res, "Internal server error");
  }
};

const createFolder = async (folderName) => {
  try {
    const response = await drive.files.create({
      resource: {
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
      },
      fields: "id",
    });

    console.log(`Folder created: ${response.data.id}`);
    return response.data.id;
  } catch (error) {
    console.error("Error creating folder:", error.message);
  }
};

const uploadToDrive = async (req, res) => {
  try {
    let { profile_picture } = req.files;

    let file = Array.isArray(profile_picture)
      ? profile_picture
      : profile_picture
      ? [profile_picture]
      : [];

    if (file.length === 0 || (file.length === 1 && file[0].size === 0)) {
      return errorRes(res, "No files uploaded");
    }

    if (file.length > 1) {
      return errorRes(res, "Only one profile picture can be uploaded");
    }

    file = file[0];

    const fileExtension = file.originalFilename.split(".").pop().toLowerCase();
    const fileName = `${Math.floor(
      1000 + Math.random() * 9000
    )}_${Date.now()}.${fileExtension}`;

    if (!["jpeg", "jpg", "png", "raw", "jfif"].includes(fileExtension)) {
      return errorRes(res, "Invalid file type");
    }

    // let create_folder = await createFolder("chat_demo");

    // console.log({create_folder}) 

    // Upload file to Google Drive
    const fileMetadata = {
      name: fileName,
      parents: ["1Thm-hlLOcNlLV9-fKcWAMKIfwPtad0B0"], // Replace with the folder ID
    };

    const media = {
      mimeType: file.mimetype,
      body: fs.createReadStream(file.path),
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: "id",
    });

    const fileId = response.data.id;

    // Make the file public
    await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
    });

    // Generate public file URL
    const fileUrl = `https://drive.google.com/uc?id=${fileId}`;

    return successRes(res, "Profile picture uploaded successfully", {
      file_type: "image",
      file_name: fileName,
      file_url: fileUrl,
    });
  } catch (error) {
    console.error("Error:", error);
    return errorRes(res, "Internal server error");
  }
};
const shareFolder = async (folderId, userEmail) => {
  try {
    const response = await drive.permissions.create({
      fileId: folderId,
      requestBody: {
        role: "reader", // Options: "reader", "writer", "commenter", "owner"
        type: "user",
        emailAddress: userEmail,
      },
    });

    console.log(`Folder shared with: ${userEmail}`);
    return response.data;
  } catch (error) {
    console.error("Error sharing folder:", error.message);
  }
};

// Example: Share the folder
// shareFolder("1Thm-hlLOcNlLV9-fKcWAMKIfwPtad0B0", "krprajapati.weapplinse@gmail.com");



module.exports = {
  uploadMedia,
  removeMedia,
  uploadWallpaper,
  uploadProfilePicture,
  uploadToDrive
};
