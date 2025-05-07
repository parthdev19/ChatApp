const router = require("express").Router();
const multipart = require("connect-multiparty");
const multipartMiddleware = multipart();
const userAuth = require("./../../../middlewares/auth");
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
  setChatWallpaper,
  themes_list,
  chatList,
  logout,
  edit_profile,
  viewProfile,
  getUserData,
  deleteAccount,
  getAgoraToken
} = require("./../../../controller/app/v1/C_user");

const {
  userSignUpDto,
  userSigninDto,
  sendotpdto,
  verifyOtpDto,
  resetPasswordDto,
  checkmailDto,
  changePasswordDto,
  userListDto,
  chatListDto,
  editProfileDto,
  viewProfileDto
} = require("./../../../dto/app/v1/user_dto");


router.post(
  "/sign_up",
  multipartMiddleware,
  validateRequest(userSignUpDto),
  signup
);

router.post(
  "/user_list",
  userAuth,
  multipartMiddleware,
  validateRequest(userListDto),
  userList
);

router.post(
  "/chat_list",
  userAuth,
  multipartMiddleware,
  validateRequest(chatListDto),
  chatList
);

router.post(
  "/themes_list",
  themes_list
);

router.post(
  "/sign_in",
  multipartMiddleware,
  validateRequest(userSigninDto),
  signIn
);

router.post(
  "/get_agora_token",
  multipartMiddleware,
  getAgoraToken
);

router.post(
  "/forget_password",
  multipartMiddleware,
  validateRequest(sendotpdto),
  sendOTP
);

router.post(
  "/verify_otp",
  multipartMiddleware,
  validateRequest(verifyOtpDto),
  verifyOtp
);

router.post(
  "/reset_password",
  multipartMiddleware,
  validateRequest(resetPasswordDto),
  resetPassword
);

router.post(
  "/check_mail",
  multipartMiddleware,
  validateRequest(checkmailDto),
  checkEmail
);

router.post(
  "/change_password",
  multipartMiddleware,
  userAuth,
  validateRequest(changePasswordDto),
  changePassword
);

router.post(
  "/edit_profile",
  multipartMiddleware,
  userAuth,
  validateRequest(editProfileDto),
  edit_profile
);

router.post(
  "/view_profile",
  multipartMiddleware,
  userAuth,
  validateRequest(viewProfileDto),
  viewProfile
);

router.post(
  "/set_chat_wallpaper",
  multipartMiddleware,
  userAuth,
  setChatWallpaper
);

router.post("/logout", multipartMiddleware, userAuth, logout);

router.post("/get_user_data", multipartMiddleware, userAuth, getUserData);

router.post("/delete_account", multipartMiddleware, userAuth, deleteAccount);

module.exports = router;
