const router = require("express").Router();

// const app_version = require("./R_app_version");

const user = require("./R_user");
const group = require("./R_group");

// const post = require("./R_post");

// const home = require("./R_home");
// const follower_following = require("./R_follower_following");
// const connection = require("./R_connection");
// const localPost = require("./R_local_post");
// const group = require("./R_group");

const chat_media = require("./R_chat_media");

// router.use("/v1/app_version", app_version);
router.use("/v1/user", user);
router.use("/v1/chatmedia", chat_media);
router.use("/v1/group", group);

module.exports = router;
