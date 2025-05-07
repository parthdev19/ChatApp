
const router = require("express").Router();
const multipart = require("connect-multiparty");
const multipartMiddleware = multipart();
const userAuth = require("../../../middlewares/auth");

const { 
    uploadMedia,
    uploadWallpaper,
    removeMedia,
    uploadProfilePicture,
    uploadToDrive
 } = require("./../../../controller/app/v1/C_chat_media");

router.post("/uplod_media", multipartMiddleware, uploadMedia);

router.post("/upload_wallpaper", multipartMiddleware, uploadWallpaper);

router.post("/remove_media", multipartMiddleware, removeMedia);

router.post("/upload_profile_picture", multipartMiddleware, uploadProfilePicture);

router.post("/upload_to_drive", multipartMiddleware, uploadToDrive);


module.exports = router;
