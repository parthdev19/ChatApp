const router = require("express").Router();
const multipart = require("connect-multiparty");
const multipartMiddleware = multipart();
const userAuth = require("./../../../middlewares/auth");
const adminauth = require("./../../../middlewares/adminauth");
const validateRequest = require("../../../middlewares/validation");

const {
    signup,
    sendOTP,
    verifyOtp,
    resetPassword,
    checkEmail,
    userList,
    signIn,
    changePassword,
    addChatThemes,
    logout
} = require("./../../../controller/admin/v1/C_admin");

router.post(
    "/sign_up",
    multipartMiddleware,
    signup
);

router.post(
    "/user_list",
    adminauth,
    multipartMiddleware,
    userList
);

router.post(
    "/sign_in",
    multipartMiddleware,
    signIn
);

router.post(
    "/send_otp",
    multipartMiddleware,
    sendOTP
);

router.post(
    "/verify_otp",
    multipartMiddleware,
    verifyOtp
);

router.post(
    "/reset_password",
    multipartMiddleware,
    resetPassword
);

router.post(
    "/check_mail",
    multipartMiddleware,
    checkEmail
);

router.post(
    "/change_password",
    multipartMiddleware,
    adminauth,
    changePassword
);

router.post(
    "/add_chat_themes",
    multipartMiddleware,
    adminauth,
    addChatThemes
);

router.post("/logout", multipartMiddleware, adminauth, logout);

module.exports = router;
