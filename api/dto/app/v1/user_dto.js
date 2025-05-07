const joi = require("joi");
const userSignUpDto = joi.object().keys({
  full_name: joi.string().required().label("Full name"),
  email_address: joi.string().email().required().label("Email address"),
  // mobile_number: joi.string().allow().label("Mobile number"),
  password: joi.string().min(6).allow().label("Password"),
  profile_picture: joi.string().allow().label("Profile picture"),
  device_type: joi
    .string()
    .valid("ios", "android", "web")
    .allow()
    .label("Device type"),
  device_token: joi.string().required().label("Device token"),
});

const userSigninDto = joi.object().keys({
  email_address: joi.string().allow().label("Email or User name"),
  password: joi.string().min(6).allow().label("Password"),
  device_type: joi
    .string()
    .valid("ios", "android", "web")
    .allow()
    .label("Device type"),
  device_token: joi.string().required().label("Device token"),
});

const sendotpdto = joi.object().keys({
  email_address: joi.string().email().required().label("Email address"),
});
const checkmailDto = joi.object().keys({
  email_address: joi.string().email().required().label("Email address"),
});

const verifyOtpDto = joi.object().keys({
  email_address: joi.string().email().required().label("Email address"),
  otp: joi.string().length(4).required().label("OTP"),
});

const resetPasswordDto = joi.object().keys({
  email_address: joi.string().email().required().label("Email address"),
  password: joi.string().min(6).required().label("Password"),
});

const changePasswordDto = joi.object().keys({
  old_password: joi.string().min(6).required().label("Old password"),
  new_password: joi.string().min(6).required().label("New password"),
});

const editProfileDto = joi.object().keys({
  full_name: joi.string().allow().label("Full name"),
  profile_picture: joi.string().allow().label("Profile picture"),
});

const viewProfileDto = joi.object().keys({
  other_user_id: joi.string().required().label("Other user id"),
});

const userListDto = joi.object().keys({
  page: joi.allow().label("Page"),
  limit: joi.allow().label("limit"),
  search: joi.string().allow("").label("Search"),
});

const chatListDto = joi.object().keys({
  page: joi.allow().label("Page"),
  limit: joi.allow().label("limit"),
  search: joi.string().allow("").label("Search"),
});

module.exports = {
  userSignUpDto,
  userSigninDto,
  userListDto,
  sendotpdto,
  verifyOtpDto,
  checkmailDto,
  resetPasswordDto,
  changePasswordDto,
  chatListDto,
  editProfileDto,
  viewProfileDto
};
