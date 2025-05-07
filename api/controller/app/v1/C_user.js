const mongoose = require("mongoose");
const util = require("util");
const fs = require("fs");
const path = require("path");
const { unlink } = require("fs");
const { RtcTokenBuilder, RtcRole } = require('agora-access-token');
const APP_ID = "393e6b0145854ff28605af3a8dff03d5";
const APP_CERTIFICATE = "7b9e7ab4eb834b05a32f2655e02c6192";

const users = require("./../../../models/M_user");
const user_session = require("./../../../models/M_user_session");
const chats = require("./../../../models/M_chat");
const chat_room = require("./../../../models/M_chat_room");
const themes = require("./../../../models/M_themes");


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

const socket = require("../../../../socket/config/socket");
const io = socket.getIO();
const v1version = io.of("/v1");

const signup = async (req, res) => {
  try {
    var { full_name, email_address, password, device_type, device_token } =
      req.body;

    let find_email = await users.findOne({
      email_address: email_address,
      is_deleted: false,
      is_self_delete: false,
    });

    if (find_email) {
      return errorRes(res, "This email address is already exists");
    }

    const hashedPassword = await securePassword(password);

    insert_data = {
      full_name: full_name,
      email_address,
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
    var { email_address, password, device_type, device_token } = req.body;

    let find_user = await users.findOne({
      email_address: email_address,
      is_deleted: false,
    });

    if (!find_user) {
      return errorRes(res, `Account is not found, Please try again.`);
    }

    if (find_user.password == null) {
      return errorRes(res, `Password is incorrect. Please try again.`);
    }

    var password_verify = await comparePassword(password, find_user.password);

    if (!password_verify) {
      return errorRes(res, `Password is incorrect. Please try again.`);
    }

    var token = await userToken(find_user);

    user_data = find_user;

    if (token) {
      user_data = {
        ...user_data._doc,
        token: token,
      };
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

    const otpExpireTime = new Date();
    otpExpireTime.setHours(otpExpireTime.getMinutes() + 10);

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

    sendOtpCode(data);

    let update_data = {
      otp,
      otp_expire_time: otpExpireTime,
    };

    await users.findByIdAndUpdate(user_data._id, update_data);

    return successRes(res, `Verification code sent to your email`, data);
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

    if (
      find_user.otp_expire_time &&
      new Date() > new Date(find_user.otp_expire_time)
    ) {
      return errorRes(res, "OTP has been expired");
    }

    if (find_user.otp && find_user.otp == Number(otp)) {
      let update_data = {
        otp: null,
        otp_expire_time: null,
      };

      await users.findByIdAndUpdate(find_user._id, update_data, {
        new: true,
      });

      return successRes(res, `OTP verified successfully`);
    } else {
      return errorRes(res, `Incorrent OTP`);
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
      return errorRes(res, `New password should not be same as old password.`);
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

    let token = req.user.token;

    let find_data = await users.findById({ _id: user_id }).where({
      is_deleted: false,
    });

    if (!find_data) {
      return errorRes(res, "Couldn't found user");
    } else {
      await user_session.deleteOne({ user_id: user_id, auth_token: token });

      return successRes(res, "Your account is logout successfully", []);
    }
  } catch (error) {
    console.log("Error : ", error);
    return errorRes(res, "Internal server error");
  }
};

const deleteAccount = async (req, res) => {
  try {
    let user_id = req.user._id;

    let find_data = await users.findById({ _id: user_id }).where({
      is_deleted: false,
    });

    if (!find_data) {
      return errorRes(res, "Couldn't found user");
    } else {
      let update_data = {
        is_self_delete: true,
        is_deleted: true,
      };

      await users.findByIdAndUpdate(user_id, update_data);

      await user_session.deleteMany({ user_id: user_id });

      v1version.emit("accountdeletation", {
        user_id: user_id,
        message: "User account has deleted",
      });

      return successRes(res, "Your account is deleted successfully", []);
    }
  } catch (error) {
    console.log("Error : ", error);
    return errorRes(res, "Internal server error");
  }
};

const setChatWallpaper = async (req, res) => {
  try {
    let user_id = req.user._id;
    const { chat_room_id, chat_wallpaper, is_global } = req.body;

    if (is_global == true || is_global == "true") {
      let update_data = {
        chat_wallpaper: chat_wallpaper,
      };

      let update_user = await users.findByIdAndUpdate(user_id, update_data, {
        new: true,
      });

      if (update_user.chat_wallpaper != null) {
        update_user = {
          ...update_user._doc,
          chat_wallpaper: process.env.BASE_URL + update_user.chat_wallpaper,
        };
      }

      if (update_user) {
        let wallpaper_data = {
          user_id: user_id,
          chat_room_id: null,
          chat_wallpaper: process.env.BASE_URL + update_user.chat_wallpaper,
          is_global: is_global,
        };

        v1version
          .to(user_id.toString())
          .emit("wallpaperChanged", wallpaper_data);

        return successRes(
          res,
          "Your chat wallpaper has been set successfully",
          update_user
        );
      }
    } else {
      let findChatRoom = await chat_room.findOne({
        _id: chat_room_id,
        is_deleted: false,
      });

      if (!findChatRoom) {
        return errorRes(res, "Chat room does not exist.");
      }

      const existingTheme = findChatRoom.themes.find(
        (theme) => theme.user_id.toString() === user_id.toString()
      );

      if (existingTheme) {
        existingTheme.chat_wallpaper = chat_wallpaper;
      } else {
        findChatRoom.themes.push({ user_id: user_id, chat_wallpaper });
      }

      await findChatRoom.save();

      findChatRoom = {
        ...findChatRoom._doc,
        chat_wallpaper: process.env.BASE_URL + chat_wallpaper,
      };

      let wallpaper_data = {
        user_id: user_id,
        chat_room_id: chat_room_id || null,
        chat_wallpaper: process.env.BASE_URL + chat_wallpaper,
        is_global: is_global,
      };

      v1version.to(user_id.toString()).emit("wallpaperChanged", wallpaper_data);

      return successRes(
        res,
        "Your chat wallpaper has been set successfully",
        findChatRoom
      );
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

    // let pipeline = [
    //   {
    //     $match: {
    //       // _id: { $ne: user_id },
    //       user_type: "user",
    //       is_deleted: false,
    //       is_self_delete: false,
    //     },
    //   },
    //   // {
    //   //   $lookup: {
    //   //     from: "chat_rooms",
    //   //     let: { userId: "$_id" },
    //   //     pipeline: [
    //   //       {
    //   //         $match: {
    //   //           $expr: {
    //   //             $and: [
    //   //               { $eq: ["$is_deleted", false] },
    //   //               { $eq: ["$room_type", "personal"] },
    //   //               {
    //   //                 $and: [
    //   //                   {
    //   //                     $or: [
    //   //                       { $eq: [user_id, "$user_id"] },
    //   //                       { $eq: [user_id, "$other_user_id"] },
    //   //                     ],
    //   //                   },
    //   //                   {
    //   //                     $or: [
    //   //                       { $eq: ["$$userId", "$other_user_id"] },
    //   //                       { $eq: ["$$userId", "$user_id"] },
    //   //                     ],
    //   //                   },
    //   //                 ],
    //   //               },
    //   //             ],
    //   //           },
    //   //         },
    //   //       },
    //   //     ],
    //   //     as: "existingChat",
    //   //   },
    //   // },
    //   // {
    //   //   $match: {
    //   //     existingChat: { $size: 0 }, // Only include users with no existing chat
    //   //   },
    //   // },
    //   {
    //     $match: search
    //       ? {
    //           full_name: { $regex: search, $options: "i" },
    //         }
    //       : {},
    //   },
    //   {
    //     $addFields: {
    //       lower_full_name: {
    //         $toLower: "$full_name",
    //       },
    //       is_current_user: {
    //         $cond: { if: { $eq: ["$_id", user_id] }, then: 1, else: 0 },
    //       },
    //     },
    //   },
    //   {
    //     $sort: {
    //       is_current_user: -1,
    //       lower_full_name: 1,
    //     },
    //   },
    //   {
    //     $skip: (parseInt(page) - 1) * parseInt(limit),
    //   },
    //   {
    //     $limit: parseInt(limit),
    //   },
    //   {
    //     $addFields: {
    //       profile_picture: {
    //         $cond: {
    //           if: { $ifNull: ["$profile_picture", false] },
    //           then: { $concat: [process.env.BASE_URL, "$profile_picture"] },
    //           else: "$profile_picture",
    //         },
    //       },
    //     },
    //   },
    //   {
    //     $project: {
    //       _id: 1,
    //       full_name: 1,
    //       email_address: 1,
    //       profile_picture: 1,
    //       createdAt: 1,
    //     },
    //   },
    // ];

    let pipeline = [
      {
        $match: {
          // _id: { $ne: user_id },
          // user_type: "user",
          user_type: { $in: ["user", "ai"] },
          is_deleted: false,
          is_self_delete: false,
        },
      },
      {
        $match: search
          ? {
              full_name: { $regex: search, $options: "i" },
            }
          : {},
      },
      {
        $addFields: {
          lower_full_name: {
            $toLower: "$full_name",
          },
          is_current_user: {
            $cond: { if: { $eq: ["$_id", user_id] }, then: 1, else: 0 },
          },
        },
      },
      {
        $sort: {
          is_current_user: -1,
          lower_full_name: 1,
        },
      },
      {
        $skip: (parseInt(page) - 1) * parseInt(limit),
      },
      {
        $limit: parseInt(limit),
      },
      {
        $lookup: {
          from: "chat_rooms",
          let: { userId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$is_deleted", false] },
                    { $eq: ["$room_type", "personal"] },
                    {
                      $and: [
                        {
                          $or: [
                            { $eq: [user_id, "$user_id"] },
                            { $eq: [user_id, "$other_user_id"] },
                          ],
                        },
                        {
                          $or: [
                            { $eq: ["$$userId", "$other_user_id"] },
                            { $eq: ["$$userId", "$user_id"] },
                          ],
                        },
                      ],
                    },
                  ],
                },
              },
            },
          ],
          as: "existingChat",
        },
      },
      {
        $addFields: {
          profile_picture: {
            $cond: {
              if: { $ifNull: ["$profile_picture", false] },
              then: { $concat: [process.env.BASE_URL, "$profile_picture"] },
              else: "$profile_picture",
            },
          },
          hasExistingChat: { $gt: [{ $size: "$existingChat" }, 0] },
        },
      },
      {
        $project: {
          _id: 1,
          full_name: 1,
          email_address: 1,
          profile_picture: 1,
          createdAt: 1,
          hasExistingChat: 1,
        },
      },
    ];

    let count_pipeline = [
      {
        $match: {
          // _id: { $ne: user_id },
          is_deleted: false,
          is_self_delete: false,
        },
      },
      // {
      //   $lookup: {
      //     from: "chat_rooms",
      //     let: { userId: "$_id" },
      //     pipeline: [
      //       {
      //         $match: {
      //           $expr: {
      //             $and: [
      //               { $eq: ["$is_deleted", false] },
      //               { $eq: ["$room_type", "personal"] },
      //               {
      //                 $and: [
      //                   {
      //                     $or: [
      //                       { $eq: [user_id, "$user_id"] },
      //                       { $eq: [user_id, "$other_user_id"] },
      //                     ],
      //                   },
      //                   {
      //                     $or: [
      //                       { $eq: ["$$userId", "$other_user_id"] },
      //                       { $eq: ["$$userId", "$user_id"] },
      //                     ],
      //                   },
      //                 ],
      //               },
      //             ],
      //           },
      //         },
      //       },
      //     ],
      //     as: "existingChat",
      //   },
      // },
      // {
      //   $match: {
      //     existingChat: { $size: 0 }, // Only include users with no existing chat
      //   },
      // },
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
        },
      },
    ];

    let users_data = await users.aggregate(pipeline);
    let total_count = await users.aggregate(count_pipeline);

    return multiSuccessRes(
      res,
      "User list get successfully",
      users_data,
      total_count.length
    );
  } catch (error) {
    console.log("Error : ", error);
    return errorRes(res, "Internal server error");
  }
};

const chatList = async (req, res) => {
  try {
    let user_id = req.user._id;

    let { page = 1, limit = 10, search = "" } = req.body;

    let userObjectId = new mongoose.Types.ObjectId(user_id);

    let user_data = await users.findOne({
      _id: user_id,
      is_deleted: false,
    });

    if (!user_data) {
      return errorRes(res, `Account is not found, Please try again.`);
    }

    let match_condition = {
      $or: [
        { user_id: userObjectId },
        { other_user_id: userObjectId },
        { member_ids: userObjectId },
      ],
      is_delete_by: { $ne: new mongoose.Types.ObjectId(user_id) },
      is_deleted: false,
    };

    let pipeline = [
      {
        $match: match_condition,
      },
      {
        $addFields: {
          other_user: {
            $cond: {
              if: { $eq: ["$user_id", userObjectId] },
              then: "$other_user_id",
              else: "$user_id",
            },
          },
          current_user: userObjectId,
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "other_user",
          foreignField: "_id",
          as: "other_user_data",
        },
      },
      {
        $unwind: {
          path: "$other_user_data",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $match: {
          $expr: {
            $cond: {
              if: { $eq: ["$room_type", "personal"] },
              then: {
                $and: [
                  { $eq: ["$other_user_data.is_deleted", false] },
                  { $eq: ["$other_user_data.is_self_delete", false] },
                ],
              },
              else: true,
            },
          },
        },
      },
      {
        $match: search
          ? {
              $or: [
                {
                  "other_user_data.full_name": {
                    $regex: search,
                    $options: "i",
                  },
                },
                { group_name: { $regex: search, $options: "i" } },
              ],
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
        $lookup: {
          from: "users",
          localField: "member_ids",
          foreignField: "_id",
          as: "members",
        },
      },
      {
        $addFields: {
          profile_picture: {
            $cond: {
              if: { $ifNull: ["$other_user_data.profile_picture", false] },
              then: {
                $concat: [
                  process.env.BASE_URL,
                  "$other_user_data.profile_picture",
                ],
              },
              else: "$other_user_data.profile_picture",
            },
          },
          group_image: {
            $cond: {
              if: { $ifNull: ["$group_image", false] },
              then: { $concat: [process.env.BASE_URL, "$group_image"] },
              else: "$group_image",
            },
          },
          full_name: "$other_user_data.full_name",
          user_id: "$other_user_data._id",
        },
      },
      {
        $project: {
          _id: 1,
          room_type: 1,
          user_id: 1,
          full_name: 1,
          profile_picture: 1,
          group_name: 1,
          group_image: 1,
          members: {
            _id: 1,
            full_name: 1,
          },
          createdAt: 1,
        },
      },
    ];

    let count_pipeline = [
      {
        $match: match_condition,
      },
      {
        $addFields: {
          other_user: {
            $cond: {
              if: { $eq: ["$user_id", userObjectId] },
              then: "$other_user_id",
              else: "$user_id",
            },
          },
          current_user: userObjectId,
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "other_user",
          foreignField: "_id",
          as: "other_user_data",
        },
      },
      {
        $unwind: {
          path: "$other_user_data",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $match: {
          $expr: {
            $cond: {
              if: { $eq: ["$room_type", "personal"] },
              then: {
                $and: [
                  { $eq: ["$other_user_data.is_deleted", false] },
                  { $eq: ["$other_user_data.is_self_delete", false] },
                ],
              },
              else: true,
            },
          },
        },
      },
      {
        $match: search
          ? {
              $or: [
                {
                  "other_user_data.full_name": {
                    $regex: search,
                    $options: "i",
                  },
                },
                { group_name: { $regex: search, $options: "i" } },
              ],
            }
          : {},
      },
      {
        $project: {
          _id: 1,
        },
      },
    ];

    let chat_data = await chat_room.aggregate(pipeline);
    let total_count = await chat_room.aggregate(count_pipeline);

    return multiSuccessRes(
      res,
      "Chat list get successfully",
      chat_data,
      total_count.length
    );
  } catch (error) {
    console.log("Error : ", error);
    return errorRes(res, "Internal server error");
  }
};

const themes_list = async (req, res) => {
  try {
    let { page = 1, limit = 10 } = req.body;

    let pipeline = [
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
          theme_url: {
            $cond: {
              if: { $ifNull: ["$theme", false] },
              then: { $concat: [process.env.BASE_URL, "$theme"] },
              else: "$theme",
            },
          },
        },
      },
      {
        $project: {
          _id: 1,
          theme: 1,
          theme_url: 1,
          createdAt: 1,
        },
      },
    ];

    let themes_count = await themes.countDocuments();
    let themes_list = await themes.aggregate(pipeline);

    return multiSuccessRes(
      res,
      "Themes list get successfully",
      themes_list,
      themes_count
    );
  } catch (error) {
    console.log("Error : ", error);
    return errorRes(res, "Internal server error");
  }
};

const edit_profile = async (req, res) => {
  try {
    let user_id = req.user._id;
    let { full_name, profile_picture } = req.body;

    let find_user = await users.findOne({
      _id: user_id,
      is_deleted: false,
    });

    if (!find_user) {
      return errorRes(res, "User not found");
    }

    let update_user = await users.findOneAndUpdate(
      {
        _id: user_id,
      },
      {
        $set: {
          full_name: full_name,
          profile_picture: profile_picture,
        },
      },
      { new: true }
    );

    if (profile_picture) {
      const removeMediaPath = path.join(
        __dirname + `./../../../../public/${find_user.profile_picture}`
      );
      console.log({ removeMediaPath });
      if (fs.existsSync(removeMediaPath)) {
        fs.unlinkSync(removeMediaPath);
      }

      v1version.emit("profilePicChanged", {
        user_id: user_id,
        profile_id: process.env.BASE_URL + update_user.profile_picture,
      });
    }

    if (update_user.profile_picture != null) {
      update_user.profile_picture =
        process.env.BASE_URL + update_user.profile_picture;
    }

    return successRes(res, `Changes were saved successfully`, update_user);
  } catch (error) {
    console.log("Error : ", error);
    return errorRes(res, "Internal server error");
  }
};

const getUserData = async (req, res) => {
  try {
    let user_id = req.user._id;

    let findUser = await users.findOne({
      _id: user_id,
      is_deleted: false,
      is_self_delete: false,
    });

    if (!findUser) {
      return errorRes(res, "User not found");
    }

    if (findUser.profile_picture != null) {
      findUser.profile_picture =
        process.env.BASE_URL + findUser.profile_picture;
    }

    return successRes(res, "User data get successfully", findUser);
  } catch (error) {
    console.log("Error : ", error);
    return errorRes(res, "Internal server error");
  }
};

const viewProfile = async (req, res) => {
  try {
    let user_id = req.user._id;

    let { other_user_id } = req.body;

    let findUser = await users.findOne({
      _id: other_user_id,
      is_deleted: false,
      is_self_delete: false,
    });

    if (!findUser) {
      return errorRes(res, "This account no longer exists.");
    }

    if (findUser.profile_picture != null) {
      findUser.profile_picture =
        process.env.BASE_URL + findUser.profile_picture;
    }

    let combine_array = [user_id, new mongoose.Types.ObjectId(other_user_id)];

    let findCommonGroups = await chat_room.aggregate([
      {
        $match: {
          member_ids: { $all: combine_array },
        },
      },
      {
        $sort: {
          createdAt: -1,
        },
      },
      {
        $addFields: {
          current_user: user_id,
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "current_user",
          foreignField: "_id",
          as: "current_user_id",
        },
      },
      {
        $unwind: {
          path: "$current_user_id",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          group_image: {
            $cond: {
              if: { $ifNull: ["$group_image", false] },
              then: { $concat: [process.env.BASE_URL, "$group_image"] },
              else: "$group_image",
            },
          },
          members: {
            $size: "$member_ids",
          },
          theme: {
            $filter: {
              input: "$themes",
              as: "theme",
              cond: {
                $eq: ["$$theme.user_id", new mongoose.Types.ObjectId(user_id)],
              },
            },
          },
        },
      },
      {
        $addFields: {
          chat_wallpaper: {
            $let: {
              vars: {
                themeSize: { $size: "$theme" },
                themeWallpaper: {
                  $arrayElemAt: ["$theme.chat_wallpaper", 0],
                },
              },
              in: {
                $cond: {
                  if: { $eq: ["$$themeSize", 1] },
                  then: {
                    $cond: {
                      if: { $ifNull: ["$$themeWallpaper", false] },
                      then: {
                        $concat: [process.env.BASE_URL, "$$themeWallpaper"],
                      },
                      else: null,
                    },
                  },
                  else: {
                    $cond: {
                      if: {
                        $ifNull: ["$current_user_id.chat_wallpaper", false],
                      },
                      then: {
                        $concat: [
                          process.env.BASE_URL,
                          "$current_user_id.chat_wallpaper",
                        ],
                      },
                      else: null,
                    },
                  },
                },
              },
            },
          },
          is_global: { $eq: [{ $size: "$theme" }, 0] },
        },
      },
      {
        $project: {
          _id: 1,
          group_name: 1,
          group_image: 1,
          members: 1,
          chat_wallpaper: 1,
          is_global: 1,
          createdAt: 1,
        },
      },
    ]);

    let res_data = {
      user_data: findUser,
      common_groups: findCommonGroups,
    };

    return successRes(res, "User data get successfully", res_data);
  } catch (error) {
    console.log("Error : ", error);
    return errorRes(res, "Internal server error");
  }
};

const getAgoraToken = async (req,res)=>{
  try{
    const {channelName} = req.body;

    if (!channelName) {
      return res.status(400).json({ error: 'channelName is required' });
    }
  
    const uid = 0; // 0 means the Agora SDK will assign one
    const role = RtcRole.PUBLISHER;
  
    const expireTimeSeconds = 3600;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpireTs = currentTimestamp + expireTimeSeconds;
  
    const token = RtcTokenBuilder.buildTokenWithUid(
      APP_ID,
      APP_CERTIFICATE,
      channelName,
      uid,
      role,
      privilegeExpireTs
    );

    return successRes(res, "agora token get successfully", { token, uid, appId: APP_ID, channelName });
    // return res.json({ token, uid, appId: APP_ID, channelName });
  }catch(error){
    console.log("Error : ", error);
    return errorRes(res, "Internal server error");
  }
}



module.exports = {
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
  getUserData,
  deleteAccount,
  viewProfile,
  getAgoraToken
};
