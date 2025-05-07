const router = require("express").Router();

// const app_version = require("./R_app_version");
    
const admin = require("./R_admin");

// router.use("/v1/app_version", app_version);
router.use("/v1/admin", admin);

module.exports = router;
