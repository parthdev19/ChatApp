const mongoose = require("mongoose");
const util = require("util");
const fs = require("fs");
const path = require("path");
const { unlink } = require("fs");

const users = require("./../../../models/M_user");
const themes = require("./../../../models/M_themes");
const user_session = require("./../../../models/M_user_session");
const chats = require("./../../../models/M_chat");
const chat_room = require("./../../../models/M_chat_room");

const {
    successRes,
    errorRes,
    multiSuccessRes,
} = require("../../../../utils/common_fun");

const { userToken } = require("../../../../utils/token");
const { sendOtpCode } = require("../../../../utils/send_mail");
const outputPath = path.join(__dirname, "../../../../");

const {
    securePassword,
    comparePassword,
} = require("../../../../utils/secure_pwd");

const {
    notificationSend,
    notiSendMultipleDevice,
} = require("../../../../utils/notification_send");

const { ObjectId } = require("mongodb");
const { dateTime } = require("../../../../utils/date_time");

const signup = async (req, res) => {
    try {
        var {
            full_name,
            email_address,
            password,
            device_type,
            device_token,
        } = req.body;

        let find_email = await users.findOne({
            email_address: email_address,
            is_deleted: false,
        });

        if (find_email) {
            return errorRes(res, "This email address is already exists");
        }

        const hashedPassword = await securePassword(password);

        insert_data = {
            full_name: full_name,
            email_address,
            user_type: "admin",
            password: hashedPassword,
        };

        var create_user = await users.create(insert_data);

        var token = await userToken(create_user);

        let session = await user_session.findOneAndUpdate(
            {
                device_token: device_token,
                user_id: create_user._id,
            },
            {
                $set: {
                    device_token: device_token,
                    device_type: device_type,
                    auth_token: token,
                    user_id: create_user._id,
                },
            },
            { new: true, upsert: true }
        );

        create_user = {
            ...create_user._doc,
            token: token,
        };
        return successRes(res, `User signup successfully`, create_user);
    } catch (error) {
        console.log("Error : ", error);
        return errorRes(res, "Internal server error");
    }
};

const signIn = async (req, res) => {
    try {
        var {
            email_address,
            password,
            device_type,
            device_token,
        } = req.body;

        let find_user = await users.findOne({
            email_address: email_address,
            user_type: "admin",
            is_deleted: false,
        });

        if (!find_user) {
            return errorRes(res, `Account is not found, Please try again.`);
        }

        if (find_user.password == null) {
            return errorRes(
                res,
                `Either email or password you entered is incorrect`
            );
        }

        var password_verify = await comparePassword(password, find_user.password);

        if (!password_verify) {
            return errorRes(
                res,
                `Either email or password you entered is incorrect`
            );
        }

        var token = await userToken(find_user);

        user_data = find_user

        if (token) {
            user_data = {
                ...user_data._doc,
                token: token
            }
        }

        delete user_data.password;

        let session = await user_session.findOneAndUpdate(
            {
                device_token: device_token,
                user_id: user_data._id,
            },
            {
                $set: {
                    device_token: device_token,
                    device_type: device_type,
                    user_id: user_data._id,
                    auth_token: token,
                },
            },
            { new: true, upsert: true }
        );

        if (user_data?.profile_picture) {
            user_data.profile_picture =
                process.env.BASE_URL + user_data.profile_picture;
        }

        return successRes(res, `You have login successfully `, user_data);
    } catch (error) {
        console.log("Error : ", error);
        return errorRes(res, "Internal server error");
    }
};

const sendOTP = async (req, res) => {
    try {
        let { email_address } = req.body;

        let otp = Math.floor(1000 + Math.random() * 9000);

        let user_data = await users.findOne({
            email_address,
            is_deleted: false,
        });

        if (!user_data) {
            return errorRes(res, `Account is not found, Please try again.`);
        }

        let data = {
            otp,
            emailAddress: email_address,
            name: user_data.full_name,
        };

        await sendOtpCode(data);

        let update_data = {
            otp,
        };

        await users.findByIdAndUpdate(user_data._id, update_data);

        return successRes(res, `Verification code sent to your email`, otp);
    } catch (error) {
        console.log("Error : ", error);
        return errorRes(res, "Internal server error");
    }
};

const verifyOtp = async (req, res) => {
    try {
        var { email_address, otp } = req.body;

        let find_user = await users
            .findOne({
                email_address: email_address,
            })
            .where({
                is_deleted: false,
            });

        if (!find_user) {
            return errorRes(res, `Account is not found, Please try again.`);
        }

        if (find_user.otp == otp) {
            let update_data = {
                otp: null,
            };

            await users.findByIdAndUpdate(find_user._id, update_data, {
                new: true,
            });

            return successRes(res, `Email verified successfully`);
        } else {
            return errorRes(res, `Please enter correct verification code`);
        }
    } catch (error) {
        console.log("Error : ", error);
        return errorRes(res, "Internal server error");
    }
};

const resetPassword = async (req, res) => {
    try {
        let { email_address, password } = req.body;

        const hashedPassword = await securePassword(password);

        let find_user = await users.findOne({
            email_address,
            is_deleted: false,
        });

        if (!find_user) {
            return errorRes(res, `Account is not found, Please try again.`);
        }

        let update_data = {
            password: hashedPassword,
        };

        await users.findByIdAndUpdate(find_user._id, update_data, {
            new: true,
        });

        return successRes(res, `Password reset successfully`);
    } catch (error) {
        console.log("Error : ", error);
        return errorRes(res, "Internal server error");
    }
};

const checkEmail = async (req, res) => {
    try {
        var { email_address } = req.body;

        let find_user = await users.findOne({
            email_address: email_address,
            is_deleted: false,
        });

        if (!find_user) {
            return successRes(res, `You can register with this email`);
        } else {
            return errorRes(res, `Email is already exists`);
        }
    } catch (error) {
        console.log("Error : ", error);
        return errorRes(res, "Internal server error");
    }
};

const changePassword = async (req, res) => {
    try {
        let { old_password, new_password } = req.body;
        let { _id, password } = req.user;

        if (password == null) {
            return errorRes(res, `Your old password is wrong. please try again.`);
        }

        var password_verify = await comparePassword(old_password, password);

        if (!password_verify) {
            return errorRes(res, `Your old password is wrong. please try again.`);
        }
        const hashedPassword = await securePassword(new_password);

        var find_user = await users.findById(_id).where({
            is_deleted: false,
        });

        if (find_user.password == hashedPassword) {
            return errorRes(
                res,
                `Your old password is similar to the your new password.`
            );
        }

        let update_data = {
            password: hashedPassword,
        };

        await users.findByIdAndUpdate(_id, update_data);

        return successRes(res, `Your password has been updated successfully`);
    } catch (error) {
        console.log("Error : ", error);
        return errorRes(res, "Internal server error");
    }
};

const logout = async (req, res) => {
    try {
        let user_id = req.user._id;

        let { device_token } = req.body;

        let find_data = await users.findById({ _id: user_id }).where({
            is_deleted: false,
        });

        if (!find_data) {
            return errorRes(res, "Couldn't found user");
        } else {

            await user_session.deleteMany({ user_id: user_id, device_token: device_token });

            if (update_user) {
                return successRes(res, "Your account is logout successfully", []);
            }
        }
    } catch (error) {
        console.log("Error : ", error);
        return errorRes(res, "Internal server error");
    }
};

const userList = async (req, res) => {
    try {
        let user_id = req.user._id;

        let { page = 1, limit = 10, search = "" } = req.body;

        let user_data = await users.findOne({
            _id: user_id,
            is_deleted: false,
        });

        if (!user_data) {
            return errorRes(res, `Account is not found, Please try again.`);
        }

        let pipeline = [
            {
                $match: {
                    _id: { $ne: user_id },
                    is_deleted: false,
                    is_self_delete: false
                }
            },
            {
                $match: search
                    ? {
                        full_name: { $regex: search, $options: "i" },
                    }
                    : {},
            },
            {
                $sort: {
                    createdAt: -1,
                },
            },
            {
                $skip: (parseInt(page) - 1) * parseInt(limit),
            },
            {
                $limit: parseInt(limit),
            },
            {
                $addFields: {
                    profile_picture: {
                        $cond: {
                            if: { $ifNull: ["$profile_picture", false] },
                            then: { $concat: [process.env.BASE_URL, "$profile_picture"] },
                            else: "$profile_picture"
                        }
                    },
                },
            },
            {
                $project: {
                    _id: 1,
                    full_name: 1,
                    email_address: 1,
                    profile_picture: 1,
                    createdAt: 1
                }
            }
        ]

        let count_pipeline = [
            {
                $match: {
                    _id: { $ne: user_id },
                    is_deleted: false,
                    is_self_delete: false
                }
            },
            {
                $match: search
                    ? {
                        full_name: { $regex: search, $options: "i" },
                    }
                    : {},
            },
            {
                $project: {
                    _id: 1,
                }
            }
        ]

        let users_data = await users.aggregate(pipeline);
        let total_count = await users.aggregate(count_pipeline)

        return multiSuccessRes(res, "User list get successfully", users_data, total_count.length);
    } catch (error) {
        console.log("Error : ", error);
        return errorRes(res, "Internal server error");
    }
};

const addChatThemes = async (req, res) => {
    try {
        let { multimedia_files } = req.files;

        const filesArray = Array.isArray(multimedia_files)
            ? multimedia_files
            : multimedia_files
                ? [multimedia_files]
                : [];

        if (filesArray.length === 0 || (filesArray.length === 1 && filesArray[0].size === 0)) {
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
            const fileExtension = file.originalFilename.split(".").pop().toLowerCase();
            const fileName = `${Math.floor(1000 + Math.random() * 9000)}_${Date.now()}.${fileExtension}`;
            const filePath = `public/themes/${fileName}`;
            const orginalfilePath = `themes/${fileName}`;

            if (["jpeg", "jpg", "png", "raw", "jfif"].includes(fileExtension)) {
                await fs.readFile(file.path, function (err, data) {
                    if (err) throw err;

                    fs.writeFile(filePath, data, function (err) {
                        if (err) throw err;
                    });
                });

                mediaData.push({ theme: orginalfilePath });

                await themes.create({ theme: orginalfilePath })
            } else {
                console.warn("Invalid file type:", fileExtension);
                // return errorRes("Invalid file type:", fileExtension)
            }
        }

        return successRes(res, "Files uploaded successfully", { media_files: mediaData });
    } catch (error) {
        console.error("Error:", error);
        return errorRes(res, "Internal server error");
    }
};


module.exports = {
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
};