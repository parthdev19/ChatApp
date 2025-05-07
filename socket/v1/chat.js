const chat_room = require("./../../api/models/M_chat_room");
const chat = require("./../../api/models/M_chat");
const users = require("./../../api/models/M_user");
const user_session = require("./../../api/models/M_user_session");

const mongoose = require("mongoose");

const {
  notificationSend,
  // notiSendMultipleDevice,
  notiSendMultipleDevice
} = require("../../utils/notification_send");

const path = require("path");
const fs = require("fs").promises;
const { readFileSync, writeFileSync } = require("fs");
const { dateTime } = require("../../utils/date_time");

const {
  socketErrorRes,
  socketErrRes,
  socketSuccessRes,
  socketMultiSuccessRes,
} = require("../../utils/common_fun");

module.exports = {
  createRoom: async (data) => {
    try {
      let { user_id, other_user_id } = data;

      let userObjectId = new mongoose.Types.ObjectId(user_id);
      let otherUserObjectId = new mongoose.Types.ObjectId(other_user_id);

      let cond1 = {
        user_id: userObjectId,
        other_user_id: otherUserObjectId,
        is_deleted: false,
      };

      let cond2 = {
        user_id: otherUserObjectId,
        other_user_id: userObjectId,
        is_deleted: false,
      };

      let [findRoom] = await chat_room.aggregate([
        {
          $match: {
            $or: [cond1, cond2],
          },
        },
        {
          $addFields: {
            current_user: userObjectId,
            other_user: {
              $cond: {
                if: { $eq: ["$user_id", userObjectId] },
                then: "$other_user_id",
                else: "$user_id",
              },
            },
          },
        },
        {
          $lookup: {
            from: "users", // Assuming "users" collection for user_id
            localField: "user_id",
            foreignField: "_id",
            as: "user_id",
          },
        },
        {
          $lookup: {
            from: "users", // Assuming "users" collection for other_user_id
            localField: "other_user_id",
            foreignField: "_id",
            as: "other_user_id",
          },
        },
        {
          $unwind: {
            path: "$user_id",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $unwind: {
            path: "$other_user_id",
            preserveNullAndEmptyArrays: true,
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
          $lookup: {
            from: "user_sessions",
            let: { userId: "$other_user" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$user_id", "$$userId"] },
                      { $ne: ["$socket_id", null] },
                      { $eq: ["$is_active", true] },
                      { $eq: ["$is_deleted", false] },
                    ],
                  },
                },
              },
              { $limit: 1 },
            ],
            as: "online_status",
          },
        },
        {
          $addFields: {
            user_profile_picture: {
              $cond: {
                if: { $ifNull: ["$user_id.profile_picture", false] },
                then: {
                  $concat: [process.env.BASE_URL, "$user_id.profile_picture"],
                },
                else: "$user_id.profile_picture",
              },
            },
            is_online: { $gt: [{ $size: "$online_status" }, 0] },
            theme: {
              $filter: {
                input: "$themes",
                as: "theme",
                cond: {
                  $eq: [
                    "$$theme.user_id",
                    new mongoose.Types.ObjectId(user_id),
                  ],
                },
              },
            },
            other_user_profile_picture: {
              $cond: {
                if: { $ifNull: ["$other_user_id.profile_picture", false] },
                then: {
                  $concat: [
                    process.env.BASE_URL,
                    "$other_user_id.profile_picture",
                  ],
                },
                else: "$other_user_id.profile_picture",
              },
            },
            user_id: "$user_id._id",
            user_full_name: "$user_id.full_name",
            other_user_id: "$other_user_id._id",
            other_user_full_name: "$other_user_id.full_name",
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
            user_id: 1,
            user_full_name: 1,
            user_profile_picture: 1,
            other_user_id: 1,
            other_user_full_name: 1,
            other_user_profile_picture: 1,
            is_online: 1,
            chat_wallpaper: 1,
            is_global: 1,
          },
        },
      ]);

      if (findRoom) {
        let findChatDeleteByUser = await chat_room.findOne({
          _id: findRoom._id,
          is_delete_by: { $eq: user_id },
        });

        if (findChatDeleteByUser) {
          await chat_room.findByIdAndUpdate(
            findRoom._id,
            {
              $pull: { is_delete_by: user_id },
            },
            { new: true }
          );
        }
        return socketSuccessRes("Chat room created successfully", findRoom);
      } else {
        let createData = {
          user_id: userObjectId,
          room_type: "personal",
          other_user_id: otherUserObjectId,
        };

        let createNewRoom = await chat_room.create(createData);

        let [createdRoom] = await chat_room.aggregate([
          {
            $match: {
              _id: createNewRoom._id,
            },
          },
          {
            $addFields: {
              current_user: userObjectId,
              other_user: {
                $cond: {
                  if: { $eq: ["$user_id", userObjectId] },
                  then: "$other_user_id",
                  else: "$user_id",
                },
              },
            },
          },
          {
            $lookup: {
              from: "users", // Assuming "users" collection for user_id
              localField: "user_id",
              foreignField: "_id",
              as: "user_id",
            },
          },
          {
            $lookup: {
              from: "users", // Assuming "users" collection for other_user_id
              localField: "other_user_id",
              foreignField: "_id",
              as: "other_user_id",
            },
          },
          {
            $unwind: {
              path: "$user_id",
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $unwind: {
              path: "$other_user_id",
              preserveNullAndEmptyArrays: true,
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
            $lookup: {
              from: "user_sessions",
              let: { userId: "$other_user" },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ["$user_id", "$$userId"] },
                        { $ne: ["$socket_id", null] },
                        { $eq: ["$is_active", true] },
                        { $eq: ["$is_deleted", false] },
                      ],
                    },
                  },
                },
                { $limit: 1 },
              ],
              as: "online_status",
            },
          },
          {
            $addFields: {
              user_profile_picture: {
                $cond: {
                  if: { $ifNull: ["$user_id.profile_picture", false] },
                  then: {
                    $concat: [process.env.BASE_URL, "$user_id.profile_picture"],
                  },
                  else: "$user_id.profile_picture",
                },
              },
              other_user_profile_picture: {
                $cond: {
                  if: { $ifNull: ["$other_user_id.profile_picture", false] },
                  then: {
                    $concat: [
                      process.env.BASE_URL,
                      "$other_user_id.profile_picture",
                    ],
                  },
                  else: "$other_user_id.profile_picture",
                },
              },
              theme: {
                $filter: {
                  input: "$themes",
                  as: "theme",
                  cond: {
                    $eq: [
                      "$$theme.user_id",
                      new mongoose.Types.ObjectId(user_id),
                    ],
                  },
                },
              },
              user_id: "$user_id._id",
              user_full_name: "$user_id.full_name",
              other_user_id: "$other_user_id._id",
              other_user_full_name: "$other_user_id.full_name",
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
              is_online: { $gt: [{ $size: "$online_status" }, 0] },
            },
          },
          {
            $project: {
              _id: 1,
              user_id: 1,
              user_full_name: 1,
              user_profile_picture: 1,
              other_user_id: 1,
              other_user_full_name: 1,
              other_user_profile_picture: 1,
              chat_wallpaper: 1,
              is_global: 1,
              is_online: 1,
            },
          },
        ]);

        return socketSuccessRes("Chat room created successfully", createdRoom);
      }
    } catch (error) {
      return socketErrorRes("Error in createRoom", error);
    }
  },

  sendMessage: async (data) => {
    try {
      let {
        chat_room_id,
        sender_id,
        receiver_id,
        message,
        message_type,
        reply_message_id,
        media_file,
        location,
        poll,
        replied_message_media,
      } = data;

      let check_room_data = await chat_room.findOne({
        _id: chat_room_id,
        is_deleted: false,
      });

      if (!check_room_data) {
        return socketErrorRes("Chat room does not exist.");
      }

      let currentDateTime = await dateTime();

      let insertData = {
        chat_room_id: chat_room_id,
        sender_id: sender_id,
        receiver_id: receiver_id,
        message_time: currentDateTime,
        message: message,
        message_type: message_type,
        created_at: currentDateTime,
        updated_at: currentDateTime,
      };

      if (message_type == "text" || message_type == "media_with_text") {
        const urlRegex = /(https?:\/\/[^\s]+)/g; // Matches HTTP/HTTPS links
        let checkURL = urlRegex.test(message);
        if (checkURL) {
          insertData.message_type = "link";
        }
      }

      if (reply_message_id) {
        const find_message = await chat.findOne({
          _id: reply_message_id,
          is_deleted: false,
        });

        if (!find_message) {
          return socketErrorRes("Reply message does not exist.");
        }

        insertData = { ...insertData, reply_message_id };

        if (
          find_message.message_type == "media" ||
          find_message.message_type == "media_with_text" ||
          find_message.message_type == "document"
        ) {
          if (Array.isArray(find_message.media_file)) {
            const matchingMediaFiles = find_message.media_file.filter(
              (file) => String(file._id) === String(replied_message_media._id)
            );

            if (matchingMediaFiles.length > 0) {
              let matingMedia = matchingMediaFiles[0];

              const sanitizedFileName = matingMedia.file_name.startsWith(
                process.env.BASE_URL
              )
                ? matingMedia.file_type === "video"
                  ? matingMedia.thumbnail.replace(baseUrl, "")
                  : matingMedia.file_name.replace(baseUrl, "")
                : matingMedia.file_type === "video"
                  ? matingMedia.thumbnail
                  : matingMedia.file_name;

              console.log({ sanitizedFileName });

              const readBufferData = readFileSync(
                path.join(__dirname, `./../../public/${sanitizedFileName}`)
              );

              const fileExtension = sanitizedFileName
                .split(".")
                .pop()
                .toLowerCase();
              const fileName = `${Math.floor(
                1000 + Math.random() * 9000
              )}_${Date.now()}.${fileExtension}`;
              const filePath = `public/chat_media/${fileName}`;

              const writeFilePath = path.join(__dirname, `./../../${filePath}`);

              writeFileSync(writeFilePath, readBufferData);

              const sanitizedVideoFileName = matingMedia.file_name.startsWith(
                process.env.BASE_URL
              )
                ? matingMedia.file_name.replace(baseUrl, "")
                : matingMedia.file_name;

              reply_media = [
                {
                  media_id: matingMedia._id,
                  file_type: matingMedia.file_type,
                  file_size: matingMedia.file_size,
                  original_name: matingMedia.original_name,
                  file_name: `chat_media/${fileName}`,
                  ...(matingMedia.file_type === "video" && {
                    thumbnail: `chat_media/${fileName}`,
                  }),
                },
              ];

              insertData = {
                ...insertData,
                replied_message_media: reply_media,
              };
            } else {
              return socketErrorRes("Selected media file not found");
            }
          }
        }
      }

      let media_files = [];

      if (
        (message_type == "media" || message_type == "media_with_text") &&
        Array.isArray(media_file)
      ) {
        media_files = await Promise.all(
          media_file.map(async (value) => {
            if (["image", "gif", "voice", "audio"].includes(value.file_type)) {
              return {
                file_type: value.file_type,
                file_name: value.file_name,
                file_size: value.file_size,
                original_name: value.original_name,
              };
            } else if (value.file_type == "video") {
              return {
                file_type: value.file_type,
                file_name: value.file_name,
                thumbnail: value.thumbnail,
                file_size: value.file_size,
                original_name: value.original_name,
              };
            }
            return null;
          })
        );
        media_files = media_files.filter(Boolean);
      }

      if (message_type == "document" && Array.isArray(media_file)) {
        media_files = await Promise.all(
          media_file.map(async (value) => {
            if (
              [
                "doc",
                "txt",
                "pdf",
                "zip",
                "docx",
                "xls",
                "xlsx",
                "ppt",
                "pptx",
                "rtf",
                "csv",
              ].includes(value.file_type)
            ) {
              return {
                file_type: value.file_type,
                file_name: value.file_name,
                original_name: value.original_name,
                file_size: value.file_size,
              };
            }
            return null;
          })
        );
        media_files = media_files.filter(Boolean);
      }

      if (message_type == "poll") {
        if (poll && poll != undefined) {
          insertData = {
            ...insertData,
            poll: poll,
          };
        }
      }

      if (message_type == "location") {
        if (location && location != undefined) {
          insertData = {
            ...insertData,
            location: location,
          };
        }
      }

      insertData = {
        ...insertData,
        media_file: media_files,
      };

      if (message_type == "text" || message_type == "media_with_text") {
        const urlRegex = /(https?:\/\/[^\s]+)/g; // Matches HTTP/HTTPS links
        let checkURL = urlRegex.test(message);
        if (checkURL) {
          insertData.message_type = "link";
        }
      }

      let receiver_is_online = await user_session.findOne({
        user_id: receiver_id,
        is_active: true,
        chat_room_id: chat_room_id,
        is_deleted: false,
      });

      let findSender = await users.findOne({
        _id: sender_id,
        is_deleted: false,
      });

      let findUserMuteChat = await check_room_data.muted_by.some(
        (user) => user.toString() == receiver_id.toString()
      );

      insertData = {
        ...insertData,
        is_read: "sent",
      };

      if (receiver_is_online) {
        insertData = {
          ...insertData,
          is_read: "seen",
        };
      }

      if (!findUserMuteChat && !receiver_is_online) {
        let noti_title = findSender.full_name;

        let noti_msg;

        let noti_image = null;

        if (findSender.profile_picture != null) {
          noti_image = process.env.BASE_URL + findSender.profile_picture;
        }

        if (message_type == "media_with_text" || message_type == "media") {
          noti_msg = `sent a media 🎥📸`;
        } else if (message_type == "poll") {
          noti_msg = `create a poll : 📊 ${poll.question}`;
        } else if (message_type == "document") {
          noti_msg = `sent a document 📃`;
        } else if (message_type == "location") {
          noti_msg = `shared a location`;
        } else {
          noti_msg = message;
        }

        let unreadMessages = await chat
          .find({
            receiver_id: receiver_id,
            chat_room_id: chat_room_id,
            is_read: "sent",
            $not: { $in: [receiver_id, "$is_delete_by"] },
          })
          .select("message message_type poll createdAt")
          .sort({ createdAt: -1 }) // Get latest unread messages first
          .limit(5); // Maximum 5 messages

        // Step 1: Format unread messages
        let messageArray = unreadMessages.map((msg) => {
          if (
            msg.message_type === "media_with_text" ||
            msg.message_type === "media"
          ) {
            return {
              text: `${msg.message || "sent a media"} 🎥📸`,
              createdAt: msg.createdAt,
            };
          } else if (msg.message_type === "poll") {
            return {
              text: `Created a poll: 📊 ${msg.poll?.question}`,
              createdAt: msg.createdAt,
            };
          } else {
            return { text: msg.message, createdAt: msg.createdAt };
          }
        });

        // Step 2: Add the current message as the latest message
        if (message_type === "media_with_text" || message_type === "media") {
          messageArray.push({
            text: `Sent a media 🎥📸`,
            createdAt: new Date(),
          });
        } else if (message_type === "poll") {
          messageArray.push({
            text: `Created a poll: 📊 ${poll?.question}`,
            createdAt: new Date(),
          });
        } else if (message_type === "document") {
          messageArray.push({
            text: `Sent a document 📃`,
            createdAt: new Date(),
          });
        } else if (message_type === "location") {
          messageArray.push({
            text: `Shared a location`,
            createdAt: new Date(),
          });
        } else {
          messageArray.push({ text: message, createdAt: new Date() });
        }

        // Step 3: Sort messages by createdAt (latest first)
        messageArray.sort((a, b) => b.createdAt - a.createdAt);

        // Step 4: Extract only text messages for notification
        let sortedMessageArray = messageArray.map((msg) => msg.text);

        sortedMessageArray.reverse();

        // Step 5: Convert to JSON for notification
        let messages = JSON.stringify(sortedMessageArray);

        let noti_for = "chat_notification";

        let notiData = {
          noti_msg,
          noti_title,
          noti_for,
          noti_image,
          room_type: "personal",
          chat_room_id: chat_room_id,
          sender_id: sender_id,
          sender_name: findSender.full_name,
          sender_profile_picture: findSender.profile_picture != null ? process.env.BASE_URL + findSender.profile_picture : null,
          messages,
        };

        // console.log({unreadMessages});
        // console.log(notiData);

        let find_token = await user_session.find({
          user_id: receiver_id,
          is_deleted: false,
        });

        let device_token_array = find_token.map((row) => row.device_token);

        if (device_token_array.length > 0) {
          notiData = { ...notiData, device_token: device_token_array };
          console.log("noti sent topic");
          notiSendMultipleDevice(notiData);
        }
      }

      let addMessage = await chat.create(insertData);

      const pipeline = [
        {
          $match: {
            _id: addMessage._id,
          },
        },
        {
          $lookup: {
            from: "chats", // Reference to `reply_message_id`
            localField: "reply_message_id",
            foreignField: "_id",
            as: "reply_message_id",
          },
        },
        {
          $unwind: {
            path: "$reply_message_id",
            preserveNullAndEmptyArrays: true,
          },
        },
        // {
        //   $lookup: {
        //     from: "users",
        //     localField: "sender_id",
        //     foreignField: "_id",
        //     as: "sender_id",
        //   },
        // },
        // {
        //   $unwind: {
        //     path: "$sender_id",
        //     preserveNullAndEmptyArrays: true,
        //   },
        // },
        // {
        //   $lookup: {
        //     from: "users",
        //     localField: "receiver_id",
        //     foreignField: "_id",
        //     as: "receiver_id",
        //   },
        // },
        // {
        //   $unwind: {
        //     path: "$receiver_id",
        //     preserveNullAndEmptyArrays: true,
        //   },
        // },
        {
          $lookup: {
            from: "users",
            localField: "reply_message_id.sender_id",
            foreignField: "_id",
            as: "reply_message_id.sender_data",
          },
        },
        {
          $unwind: {
            path: "$reply_message_id.sender_data",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $addFields: {
            "reply_message_id.sender_name":
              "$reply_message_id.sender_data.full_name",
          },
        },
        {
          $addFields: {
            // "sender_id.profile_picture": {
            //   $cond: [
            //     {
            //       $and: [
            //         { $ne: ["$sender_id.profile_picture", null] },
            //         { $not: [{ $regexMatch: { input: "$sender_id.profile_picture", regex: `^${process.env.BASE_URL}` } }] },
            //       ],
            //     },
            //     { $concat: [process.env.BASE_URL, "$sender_id.profile_picture"] },
            //     "$sender_id.profile_picture",
            //   ],
            // },
            // "receiver_id.profile_picture": {
            //   $cond: [
            //     {
            //       $and: [
            //         { $ne: ["$receiver_id.profile_picture", null] },
            //         { $not: [{ $regexMatch: { input: "$receiver_id.profile_picture", regex: `^${process.env.BASE_URL}` } }] },
            //       ],
            //     },
            //     { $concat: [process.env.BASE_URL, "$receiver_id.profile_picture"] },
            //     "$receiver_id.profile_picture",
            //   ],
            // },
            media_file: {
              $map: {
                input: "$media_file",
                as: "media",
                in: {
                  $mergeObjects: [
                    "$$media",
                    {
                      file_name: {
                        $cond: [
                          { $ne: ["$$media.file_name", null] },
                          {
                            $concat: [
                              process.env.BASE_URL,
                              "$$media.file_name",
                            ],
                          },
                          "$$media.file_name",
                        ],
                      },
                      thumbnail: {
                        $cond: [
                          {
                            $and: [
                              { $eq: ["$$media.file_type", "video"] },
                              { $ne: ["$$media.thumbnail", null] },
                            ],
                          },
                          {
                            $concat: [
                              process.env.BASE_URL,
                              "$$media.thumbnail",
                            ],
                          },
                          "$$media.thumbnail",
                        ],
                      },
                    },
                  ],
                },
              },
            },
            replied_message_media: {
              $map: {
                input: "$replied_message_media",
                as: "media",
                in: {
                  $mergeObjects: [
                    "$$media",
                    {
                      file_name: {
                        $cond: [
                          { $ne: ["$$media.file_name", null] },
                          {
                            $concat: [
                              process.env.BASE_URL,
                              "$$media.file_name",
                            ],
                          },
                          "$$media.file_name",
                        ],
                      },
                      thumbnail: {
                        $cond: [
                          {
                            $and: [
                              { $eq: ["$$media.file_type", "video"] },
                              { $ne: ["$$media.thumbnail", null] },
                            ],
                          },
                          {
                            $concat: [
                              process.env.BASE_URL,
                              "$$media.thumbnail",
                            ],
                          },
                          "$$media.thumbnail",
                        ],
                      },
                    },
                  ],
                },
              },
            },
            poll: {
              $cond: {
                if: { $eq: ["$message_type", "poll"] },
                then: {
                  question: "$poll.question",
                  poll_id: "$poll._id",
                  options: {
                    $map: {
                      input: "$poll.options",
                      as: "option",
                      in: {
                        _id: "$$option._id",
                        text: "$$option.text",
                        vote_count: {
                          $size: {
                            $filter: {
                              input: "$poll.voters",
                              as: "voter",
                              cond: {
                                $eq: ["$$voter.option_id", "$$option._id"],
                              },
                            },
                          },
                        },
                        voted_users: {
                          $map: {
                            input: {
                              $slice: [
                                {
                                  $sortArray: {
                                    input: {
                                      $filter: {
                                        input: "$poll.voters",
                                        as: "voter",
                                        cond: {
                                          $eq: [
                                            "$$voter.option_id",
                                            "$$option._id",
                                          ],
                                        },
                                      },
                                    },
                                    sortBy: { vote_time: -1 }, // Sort by vote_time descending
                                  },
                                },
                                2, // Get the latest 2 voters
                              ],
                            },
                            as: "voter",
                            in: {
                              profile_picture: {
                                $let: {
                                  vars: {
                                    profile: {
                                      $arrayElemAt: [
                                        {
                                          $filter: {
                                            input: "$voter_profiles",
                                            as: "profile",
                                            cond: {
                                              $eq: [
                                                "$$profile._id",
                                                "$$voter.user_id",
                                              ],
                                            },
                                          },
                                        },
                                        0,
                                      ],
                                    },
                                  },
                                  in: {
                                    $cond: [
                                      {
                                        $ne: [
                                          "$$profile.profile_picture",
                                          null,
                                        ],
                                      },
                                      {
                                        $concat: [
                                          process.env.BASE_URL,
                                          "$$profile.profile_picture",
                                        ],
                                      },
                                      null,
                                    ],
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                  is_multiple: "$poll.is_multiple",
                },
                else: "$$REMOVE",
              },
            },
          },
        },
        {
          $addFields: {
            reply_message_id: {
              $cond: {
                if: {
                  $or: [
                    { $eq: [{ $type: "$reply_message_id._id" }, "missing"] },
                    { $eq: ["$reply_message_id", null] },
                    { $eq: ["$reply_message_id", {}] },
                  ],
                },
                then: "$$REMOVE",
                else: "$reply_message_id",
              },
            },
          },
        },
        {
          $project: {
            _id: 1,
            chat_room_id: 1,
            message: 1,
            message_type: 1,
            message_time: 1,
            createdAt: 1,
            is_read: 1,
            is_edited: 1,
            is_delete_everyone: 1,
            is_delete_by: 1,
            media_file: 1,
            sender_id: 1,
            receiver_id: 1,
            is_pin: 1,
            is_forwarded: 1,
            reply_message_id: {
              _id: 1,
              chat_room_id: 1,
              message: 1,
              poll: {
                _id: 1,
                question: 1,
              },
              is_pin: 1,
              is_forwarded: 1,
              message_type: 1,
              message_time: 1,
              createdAt: 1,
              is_read: 1,
              is_edited: 1,
              is_delete_everyone: 1,
              is_delete_by: 1,
              media_file: 1,
              sender_id: 1,
              sender_name: 1,
              receiver_id: 1,
              replied_message_media: 1,
              createdAt: 1,
              updatedAt: 1,
            },
            replied_message_media: 1,
            poll: 1,
            location: 1,
            createdAt: 1,
            updatedAt: 1,
          },
        },
      ];

      const [getMessage] = await chat.aggregate(pipeline);

      let find_chat = await chat.findOne({
        _id: addMessage._id,
      });

      console.log({ find_chat });

      let findChatDeleteByUser = await chat_room.findOne({
        _id: chat_room_id,
        $or: [
          { is_delete_by: { $eq: receiver_id } },
          { is_delete_by: { $eq: sender_id } },
        ],
      });

      if (findChatDeleteByUser) {
        await chat_room.findByIdAndUpdate(
          chat_room_id,
          {
            $set: { is_delete_by: [] },
          },
          { new: true }
        );
      }

      if (getMessage) {
        return socketSuccessRes("Message sent successfully", getMessage);
      } else {
        return socketErrorRes("Failed to send message", error);
      }
    } catch (error) {
      console.log(error);
      return socketErrorRes("Error in chatUserList", error);
    }
  },

  sendBotMessage: async (data) => {
    try {
      let {
        chat_room_id,
        sender_id,
        receiver_id,
        message,
        message_type = "text",
        reply_message_id,
        media_file,
        location,
        poll,
        replied_message_media,
      } = data;

      let check_room_data = await chat_room.findOne({
        _id: chat_room_id,
        is_deleted: false,
      });

      if (!check_room_data) {
        return socketErrorRes("Chat room does not exist.");
      }

      let currentDateTime = await dateTime();

      // First save the user's message
      let insertData = {
        chat_room_id: chat_room_id,
        sender_id: sender_id,
        receiver_id: receiver_id,
        message_time: currentDateTime,
        message: message,
        message_type: message_type,
        created_at: currentDateTime,
        updated_at: currentDateTime,
      };

      if (message_type == "text" || message_type == "media_with_text") {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        let checkURL = urlRegex.test(message);
        if (checkURL) {
          insertData.message_type = "link";
        }
      }

      if (reply_message_id) {
        const find_message = await chat.findOne({
          _id: reply_message_id,
          is_deleted: false,
        });

        if (!find_message) {
          return socketErrorRes("Reply message does not exist.");
        }
        insertData = { ...insertData, reply_message_id };
      }

      // Save user message
      const savedUserMessage = await chat.create(insertData);

      // Get AI response
      const genAI = new GoogleGenerativeAI(
        "AIzaSyCDyJ-o2U_zuXoYkrsWZQnpdqCrGHJG2-k"
      );
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const prompt = `${message} (keep it brief)`;
      const result = await model.generateContent(prompt);
      const aiResponse = result.response.text();

      // Create bot's response message
      let botMessageData = {
        chat_room_id: chat_room_id,
        sender_id: receiver_id, // Bot's ID
        receiver_id: sender_id,
        message: aiResponse,
        message_type: "text",
        message_time: currentDateTime,
        created_at: currentDateTime,
        updated_at: currentDateTime,
      };

      // Save bot's response
      const savedBotMessage = await chat.create(botMessageData);

      return socketMultiSuccessRes("Messages sent successfully", {
        user_message: savedUserMessage,
        bot_message: savedBotMessage,
      });
    } catch (error) {
      console.error("Error in sendBotMessage:", error);
      return socketErrRes("Something went wrong", error);
    }
  },

  forwardMessage: async (data) => {
    try {
      let { chat_room_id, sender_id, receiver_id, forwarded_mesaages } = data;

      let check_room_data = await chat_room.findOne({
        _id: chat_room_id,
        is_deleted: false,
      });

      if (!check_room_data) {
        return socketErrorRes("Chat room does not exist.");
      }

      let currentDateTime = await dateTime();

      if (forwarded_mesaages.length == 0) {
        return socketErrorRes("please select atleast one message to forward");
      }

      let chatObjectIds = forwarded_mesaages.map(
        (id) => new mongoose.Types.ObjectId(id)
      );

      let findChat = await chat.find({
        _id: { $in: chatObjectIds },
        is_delete_everyone: false,
        $not: { $in: [sender_id, "$is_delete_by"] },
      });

      if (findChat.length != chatObjectIds.length) {
        return socketErrRes("Messages not found");
      }

      let inserted_ids = [];

      let forwarded_mesaages_promises = forwarded_mesaages.map(async (id) => {
        let find_chat = await chat.findOne({
          _id: id,
          is_delete_everyone: false,
        });

        if (!find_chat) {
          return socketErrRes("Chat not found");
        }

        let insert_data = {
          chat_room_id: chat_room_id,
          sender_id: sender_id,
          receiver_id: receiver_id,
          message_time: currentDateTime,
          message: find_chat.message,
          message_type: find_chat.message_type,
          created_at: currentDateTime,
          updated_at: currentDateTime,
        };

        if (find_chat.sender_id.toString() != sender_id) {
          insert_data.is_forwarded = true;
        }

        let media_files = [];

        if (
          find_chat.message_type === "media" ||
          find_chat.message_type === "media_with_text" ||
          find_chat.message_type == "document"
        ) {
          media_files = await Promise.all(
            find_chat.media_file.map(async (value, index) => {
              try {
                const fileExtension = path.extname(value.file_name);
                const newFileName = `${Math.floor(
                  1000 + Math.random() * 9000
                )}_${Date.now()}${fileExtension}`;
                const filePath = path.resolve("public/", value.file_name);
                const newFilePath = path.join(
                  __dirname,
                  "../../public/chat_media",
                  newFileName
                );

                await fs.access(filePath);
                await fs.copyFile(filePath, newFilePath);

                const result = {
                  file_type: value.file_type,
                  file_name: `chat_media/${newFileName}`, // Path relative to `public/`,
                  file_size: value.file_size,
                  original_name: value.original_name,
                };

                if (value.file_type === "video" && value.thumbnail) {
                  const thumbnailExtension = path.extname(value.thumbnail);
                  const newThumbnailName = `${Math.floor(
                    1000 + Math.random() * 9000
                  )}_${Date.now()}${thumbnailExtension}`;
                  const thumbnailPath = path.resolve(
                    "public/",
                    value.thumbnail
                  );
                  const newThumbnailPath = path.join(
                    __dirname,
                    "../../public/chat_media",
                    newThumbnailName
                  );

                  // Read and copy the thumbnail
                  await fs.access(thumbnailPath);
                  await fs.copyFile(thumbnailPath, newThumbnailPath);

                  result.thumbnail = `chat_media/${newThumbnailName}`;
                }

                return result;
              } catch (error) {
                console.error(
                  `Error processing file ${value.file_name}:`,
                  error
                );
                return null;
              }
            })
          );

          media_files = media_files.filter(Boolean);
        }

        if (find_chat.message_type == "location") {
          if (find_chat.location && find_chat.location != undefined) {
            insert_data = {
              ...insert_data,
              location: find_chat.location,
            };
          }
        }

        insert_data.media_file = media_files;

        let receiver_is_online = await user_session.findOne({
          user_id: receiver_id,
          is_active: true,
          chat_room_id: chat_room_id,
          is_deleted: false,
        });

        let findSender = await users.findOne({
          _id: sender_id,
          is_deleted: false,
        });

        let findUserMuteChat = await check_room_data.muted_by.some(
          (user) => user.toString() == receiver_id.toString()
        );


        if (receiver_is_online) {
          insert_data = {
            ...insert_data,
            is_read: "seen",
          };
        }

        if (!receiver_is_online && !findUserMuteChat) {

          let noti_title = findSender.full_name;

          let noti_msg;

          let noti_image = null;

          if (findSender.profile_picture != null) {
            noti_image = process.env.BASE_URL + findSender.profile_picture;
          }

          if (
            find_chat.message_type == "media_with_text" ||
            find_chat.message_type == "media"
          ) {
            noti_msg = `forward a media 🎥📸`;
          } else if (find_chat.message_type == "document") {
            noti_msg = `forward a document 📃`;
          } else {
            noti_msg = find_chat.message;
          }

          let unreadMessages = await chat
            .find({
              receiver_id: receiver_id,
              chat_room_id: chat_room_id,
              is_read: "sent",
              $not: { $in: [receiver_id, "$is_delete_by"] },
            })
            .select("message message_type poll createdAt")
            .sort({ createdAt: -1 }) // Get latest unread messages first
            .limit(5); // Maximum 5 messages

          console.log({ unreadMessages })

          // Step 1: Format unread messages
          let messageArray = unreadMessages.map((msg) => {
            if (
              msg.message_type === "media_with_text" ||
              msg.message_type === "media"
            ) {
              return {
                text: `${msg.message || "sent a media"} 🎥📸`,
                createdAt: msg.createdAt,
              };
            } else if (msg.message_type === "poll") {
              return {
                text: `Created a poll: 📊 ${msg.poll?.question}`,
                createdAt: msg.createdAt,
              };
            } else {
              return { text: msg.message, createdAt: msg.createdAt };
            }
          });

          // Step 2: Add the current message as the latest message
          if (
            find_chat.message_type === "media_with_text" ||
            find_chat.message_type === "media"
          ) {
            messageArray.push({
              text: `Sent a media 🎥📸`,
              createdAt: new Date(),
            });
          } else if (find_chat.message_type === "poll") {
            messageArray.push({
              text: `Created a poll: 📊 ${poll?.question}`,
              createdAt: new Date(),
            });
          } else if (find_chat.message_type === "document") {
            messageArray.push({
              text: `Sent a document 📃`,
              createdAt: new Date(),
            });
          } else if (find_chat.message_type === "location") {
            messageArray.push({
              text: `Shared a location`,
              createdAt: new Date(),
            });
          } else {
            messageArray.push({ text: find_chat.message, createdAt: new Date() });
          }

          // Step 3: Sort messages by createdAt (latest first)
          messageArray.sort((a, b) => b.createdAt - a.createdAt);

          // Step 4: Extract only text messages for notification
          let sortedMessageArray = messageArray.map((msg) => msg.text);

          sortedMessageArray.reverse();

          // Step 5: Convert to JSON for notification
          let messages = JSON.stringify(sortedMessageArray);
          console.log({ messages })

          let noti_for = "chat_notification";

          let notiData = {
            noti_msg,
            noti_title,
            noti_for,
            noti_image,
            room_type: "personal",
            chat_room_id: chat_room_id,
            messages,
            sender_id: findSender._id,
            sender_name: findSender.full_name,
            sender_profile_picture: findSender.profile_picture != null ? process.env.BASE_URL + findSender.profile_picture : null
            // id: user_id
          };

          let find_token = await user_session.find({
            user_id: receiver_id,
            is_deleted: false,
          });

          let device_token_array = find_token.map((row) => row.device_token);

          if (device_token_array.length > 0) {
            notiData = { ...notiData, device_token: device_token_array };
            console.log("noti sent topic");
            notiSendMultipleDevice(notiData);
          }
        }

        let addMessage = await chat.create(insert_data);

        if (addMessage) {
          inserted_ids.push(addMessage._id);
        }
      });

      await Promise.all(forwarded_mesaages_promises);

      const pipeline = [
        {
          $match: {
            _id: {
              $in: inserted_ids,
            },
          },
        },
        // {
        //   $lookup: {
        //     from: "users",
        //     localField: "sender_id",
        //     foreignField: "_id",
        //     as: "sender_id",
        //   },
        // },
        // {
        //   $unwind: {
        //     path: "$sender_id",
        //     preserveNullAndEmptyArrays: true,
        //   },
        // },
        // {
        //   $lookup: {
        //     from: "users",
        //     localField: "receiver_id",
        //     foreignField: "_id",
        //     as: "receiver_id",
        //   },
        // },
        // {
        //   $unwind: {
        //     path: "$receiver_id",
        //     preserveNullAndEmptyArrays: true,
        //   },
        // },
        {
          $addFields: {
            media_file: {
              $map: {
                input: "$media_file",
                as: "media",
                in: {
                  $mergeObjects: [
                    "$$media",
                    {
                      file_name: {
                        $cond: [
                          { $ne: ["$$media.file_name", null] },
                          {
                            $concat: [
                              process.env.BASE_URL,
                              "$$media.file_name",
                            ],
                          },
                          "$$media.file_name",
                        ],
                      },
                      thumbnail: {
                        $cond: [
                          {
                            $and: [
                              { $eq: ["$$media.file_type", "video"] },
                              { $ne: ["$$media.thumbnail", null] },
                            ],
                          },
                          {
                            $concat: [
                              process.env.BASE_URL,
                              "$$media.thumbnail",
                            ],
                          },
                          "$$media.thumbnail",
                        ],
                      },
                    },
                  ],
                },
              },
            },
          },
        },
        {
          $addFields: {
            reply_message_id: {
              $cond: {
                if: {
                  $or: [
                    { $eq: [{ $type: "$reply_message_id._id" }, "missing"] },
                    { $eq: ["$reply_message_id", null] },
                    { $eq: ["$reply_message_id", {}] },
                  ],
                },
                then: "$$REMOVE",
                else: "$reply_message_id",
              },
            },
          },
        },
        {
          $project: {
            _id: 1,
            chat_room_id: 1,
            message: 1,
            message_type: 1,
            message_time: 1,
            createdAt: 1,
            is_read: 1,
            is_edited: 1,
            is_delete_everyone: 1,
            is_delete_by: 1,
            media_file: 1,
            sender_id: 1,
            receiver_id: 1,
            is_pin: 1,
            is_forwarded: 1,
            reply_message_id: 1,
            replied_message_media: 1,
            poll: 1,
            location: 1,
            createdAt: 1,
            updatedAt: 1,
          },
        },
      ];

      const getMessage = await chat.aggregate(pipeline);

      return socketSuccessRes("Message forwarded successfully", getMessage);
    } catch (error) {
      console.log(error);
      return socketErrorRes("Error in forwardMediaMessage", error);
    }
  },

  forwardMediaMessage: async (data) => {
    try {
      let {
        chat_room_id,
        sender_id,
        receiver_id,
        message_id,
        forwarded_media_mesaages,
      } = data;

      if (forwarded_media_mesaages.length == 0) {
        return socketErrorRes("please select atleast one message to forward");
      }

      let check_room_data = await chat_room.findOne({
        _id: chat_room_id,
        is_deleted: false,
      });

      if (!check_room_data) {
        return socketErrorRes("Chat room does not exist.");
      }

      let findChat = await chat.findOne({
        _id: message_id,
        is_delete_everyone: false,
        $not: { $in: [sender_id, "$is_delete_by"] },
      });

      if (!findChat) {
        return socketErrorRes("Message does not exist.");
      }

      let currentDateTime = await dateTime();

      let chatMediaObjectIds = forwarded_media_mesaages.map(
        (id) => new mongoose.Types.ObjectId(id)
      );

      const validMediaFileIds = findChat.media_file.map((media) =>
        media._id.toString()
      );

      const areAllIdsValid = forwarded_media_mesaages.every((id) =>
        validMediaFileIds.includes(id)
      );

      if (!areAllIdsValid) {
        return socketErrRes("Media files not found");
      }

      let inserted_media = [];

      let forwarded_mesaages_promises = forwarded_media_mesaages.map(
        async (id) => {
          const forwardedMediaObject = findChat.media_file.find(
            (media) => media._id.toString() === id
          );

          if (forwardedMediaObject) {
            try {
              const fileExtension = path.extname(
                forwardedMediaObject.file_name
              );
              const newFileName = `${Math.floor(
                1000 + Math.random() * 9000
              )}_${Date.now()}${fileExtension}`;
              const filePath = path.resolve(
                "public/",
                forwardedMediaObject.file_name
              );
              const newFilePath = path.join(
                __dirname,
                "../../public/chat_media",
                newFileName
              );

              await fs.access(filePath);
              await fs.copyFile(filePath, newFilePath);

              const result = {
                file_type: forwardedMediaObject.file_type,
                file_name: `chat_media/${newFileName}`, // Path relative to `public/`,
                file_size: forwardedMediaObject.file_size,
                original_name: forwardedMediaObject.original_name,
              };

              if (
                forwardedMediaObject.file_type === "video" &&
                forwardedMediaObject.thumbnail
              ) {
                const thumbnailExtension = path.extname(
                  forwardedMediaObject.thumbnail
                );
                const newThumbnailName = `${Math.floor(
                  1000 + Math.random() * 9000
                )}_${Date.now()}${thumbnailExtension}`;
                const thumbnailPath = path.resolve(
                  "public/",
                  forwardedMediaObject.thumbnail
                );
                const newThumbnailPath = path.join(
                  __dirname,
                  "../../public/chat_media",
                  newThumbnailName
                );

                // Read and copy the thumbnail
                await fs.access(thumbnailPath);
                await fs.copyFile(thumbnailPath, newThumbnailPath);

                result.thumbnail = `chat_media/${newThumbnailName}`;
              }

              inserted_media.push(result);
            } catch (error) {
              console.error(
                `Error processing file ${forwardedMediaObject.file_name}:`,
                error
              );
            }
          }
        }
      );

      await Promise.all(forwarded_mesaages_promises);

      let insert_data = {
        chat_room_id: chat_room_id,
        sender_id: sender_id,
        receiver_id: receiver_id,
        message_time: currentDateTime,
        message_type: "media",
        created_at: currentDateTime,
        updated_at: currentDateTime,
      };

      console.log({ inserted_media });

      if (inserted_media.length > 0) {
        insert_data.media_file = inserted_media;
      }

      let receiver_is_online = await user_session.findOne({
        user_id: receiver_id,
        is_active: true,
        chat_room_id: chat_room_id,
        is_deleted: false,
      });

      let findSender = await users.findOne({
        _id: sender_id,
        is_deleted: false,
      });

      let findUserMuteChat = await check_room_data.muted_by.some(
        (user) => user.toString() == receiver_id.toString()
      );

      if (!receiver_is_online && !findUserMuteChat) {
        insert_data = {
          ...insert_data,
          is_read: "sent",
        };

        let noti_title = findSender.full_name;

        let noti_msg;

        let noti_image = null;

        if (findSender.profile_picture != null) {
          noti_image = process.env.BASE_URL + findSender.profile_picture;
        }

        noti_msg = `forward a media 🎥📸`;

        let noti_for = "chat_notification";

        if (findChat.message_type == "document") {
          noti_msg = `sent a document 📃`;
        }

        let unreadMessages = await chat
          .find({
            receiver_id: receiver_id,
            chat_room_id: chat_room_id,
            is_read: "sent",
            $not: { $in: [receiver_id, "$is_delete_by"] },
          })
          .select("message message_type poll createdAt")
          .sort({ createdAt: -1 }) // Get latest unread messages first
          .limit(5); // Maximum 5 messages

        // Step 1: Format unread messages
        let messageArray = unreadMessages.map((msg) => {
          if (
            msg.message_type === "media_with_text" ||
            msg.message_type === "media"
          ) {
            return {
              text: `${msg.message || "sent a media"} 🎥📸`,
              createdAt: msg.createdAt,
            };
          } else if (msg.message_type === "poll") {
            return {
              text: `Created a poll: 📊 ${msg.poll?.question}`,
              createdAt: msg.createdAt,
            };
          } else {
            return { text: msg.message, createdAt: msg.createdAt };
          }
        });

        // Step 2: Add the current message as the latest message
        if (message_type === "media_with_text" || message_type === "media") {
          messageArray.push({
            text: `Sent a media 🎥📸`,
            createdAt: new Date(),
          });
        } else if (message_type === "poll") {
          messageArray.push({
            text: `Created a poll: 📊 ${poll?.question}`,
            createdAt: new Date(),
          });
        } else if (message_type === "document") {
          messageArray.push({
            text: `Sent a document 📃`,
            createdAt: new Date(),
          });
        } else if (message_type === "location") {
          messageArray.push({
            text: `Shared a location`,
            createdAt: new Date(),
          });
        } else {
          messageArray.push({ text: message, createdAt: new Date() });
        }

        // Step 3: Sort messages by createdAt (latest first)
        messageArray.sort((a, b) => b.createdAt - a.createdAt);

        // Step 4: Extract only text messages for notification
        let sortedMessageArray = messageArray.map((msg) => msg.text);

        sortedMessageArray.reverse();

        // Step 5: Convert to JSON for notification
        let messages = JSON.stringify(sortedMessageArray);

        let notiData = {
          noti_msg,
          noti_title,
          noti_for,
          noti_image,
          room_type: "personal",
          chat_room_id: chat_room_id,
          sender_id: findSender._id,
          sender_name: findSender.full_name,
          sender_profile_picture: findSender.profile_picture != null ? process.env.BASE_URL + findSender.profile_picture : null,
          messages
          // id: user_id
        };

        let find_token = await user_session.find({
          user_id: receiver_id,
          is_deleted: false,
        });

        let device_token_array = find_token.map((row) => row.device_token);

        if (device_token_array.length > 0) {
          notiData = { ...notiData, device_token: device_token_array };
          console.log("noti sent topic");
          notiSendMultipleDevice(notiData);
        }
      } else {
        insert_data = {
          ...insert_data,
          is_read: "seen",
        };
      }

      if (findChat.sender_id.toString() != sender_id) {
        insert_data.is_forwarded = true;
      }

      let addMessage = await chat.create(insert_data);

      const pipeline = [
        {
          $match: {
            _id: addMessage._id,
          },
        },
        {
          $addFields: {
            media_file: {
              $map: {
                input: "$media_file",
                as: "media",
                in: {
                  $mergeObjects: [
                    "$$media",
                    {
                      file_name: {
                        $cond: [
                          { $ne: ["$$media.file_name", null] },
                          {
                            $concat: [
                              process.env.BASE_URL,
                              "$$media.file_name",
                            ],
                          },
                          "$$media.file_name",
                        ],
                      },
                      thumbnail: {
                        $cond: [
                          {
                            $and: [
                              { $eq: ["$$media.file_type", "video"] },
                              { $ne: ["$$media.thumbnail", null] },
                            ],
                          },
                          {
                            $concat: [
                              process.env.BASE_URL,
                              "$$media.thumbnail",
                            ],
                          },
                          "$$media.thumbnail",
                        ],
                      },
                    },
                  ],
                },
              },
            },
          },
        },
        {
          $addFields: {
            reply_message_id: {
              $cond: {
                if: {
                  $or: [
                    { $eq: [{ $type: "$reply_message_id._id" }, "missing"] },
                    { $eq: ["$reply_message_id", null] },
                    { $eq: ["$reply_message_id", {}] },
                  ],
                },
                then: "$$REMOVE",
                else: "$reply_message_id",
              },
            },
          },
        },
        {
          $project: {
            _id: 1,
            chat_room_id: 1,
            message: 1,
            message_type: 1,
            message_time: 1,
            createdAt: 1,
            is_read: 1,
            is_edited: 1,
            is_delete_everyone: 1,
            is_delete_by: 1,
            media_file: 1,
            sender_id: 1,
            receiver_id: 1,
            is_pin: 1,
            is_forwarded: 1,
            reply_message_id: 1,
            replied_message_media: 1,
            poll: 1,
            createdAt: 1,
            updatedAt: 1,
          },
        },
      ];

      const [getMessage] = await chat.aggregate(pipeline);

      return socketSuccessRes("Message forwarded successfully", getMessage);
    } catch (error) {
      console.log(error);
      return socketErrorRes("Error in forwardMediaMessage", error);
    }
  },

  getAllMessage: async (data) => {
    try {
      let { chat_room_id, user_id, page, limit } = data;

      const userObjectId = new mongoose.Types.ObjectId(user_id);

      let [findRoom] = await chat_room.aggregate([
        {
          $match: {
            _id: new mongoose.Types.ObjectId(chat_room_id),
            room_type: "personal",
            is_delete_by: { $ne: new mongoose.Types.ObjectId(user_id) },
          },
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
          },
        },
        {
          $lookup: {
            from: "users", // Assuming "users" collection for user_id
            localField: "other_user",
            foreignField: "_id",
            as: "user_id",
          },
        },
        {
          $unwind: {
            path: "$user_id",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: "user_sessions", // Lookup user session to check online status
            localField: "other_user",
            foreignField: "user_id",
            pipeline: [
              {
                $match: {
                  is_active: true,
                  is_deleted: false,
                },
              },
              { $limit: 1 },
            ],
            as: "user_status",
          },
        },
        {
          $addFields: {
            profile_picture: {
              $cond: {
                if: { $ifNull: ["$user_id.profile_picture", false] },
                then: {
                  $concat: [process.env.BASE_URL, "$user_id.profile_picture"],
                },
                else: "$user_id.profile_picture",
              },
            },
            user_id: "$user_id._id",
            is_deleted: "$user_id.is_deleted",
            full_name: "$user_id.full_name",
            theme: {
              $filter: {
                input: "$themes",
                as: "theme",
                cond: {
                  $eq: [
                    "$$theme.user_id",
                    new mongoose.Types.ObjectId(user_id),
                  ],
                },
              },
            },
            is_online: { $gt: [{ $size: "$user_status" }, 0] },
          },
        },
        {
          $project: {
            _id: 1,
            user_id: 1,
            is_deleted: 1,
            full_name: 1,
            profile_picture: 1,
            is_online: 1,
            is_global: 1,
          },
        },
      ]);

      if (!findRoom) {
        return socketErrorRes("Chat room not found");
      }

      const pipeline = [
        {
          $match: {
            chat_room_id: new mongoose.Types.ObjectId(chat_room_id),
            is_delete_by: { $ne: new mongoose.Types.ObjectId(user_id) },
          },
        },
        {
          $sort: { createdAt: -1 },
        },
      ];

      // Add pagination only if page and limit are provided
      if (page && limit) {
        pipeline.push(
          {
            $skip: (parseInt(page) - 1) * parseInt(limit),
          },
          {
            $limit: parseInt(limit),
          }
        );
      }

      pipeline.push(
        {
          $lookup: {
            from: "chats", // Reference to `reply_message_id`
            localField: "reply_message_id",
            foreignField: "_id",
            as: "reply_message_id",
          },
        },
        {
          $unwind: {
            path: "$reply_message_id",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "reply_message_id.sender_id",
            foreignField: "_id",
            as: "reply_message_id.sender_data",
          },
        },
        {
          $unwind: {
            path: "$reply_message_id.sender_data",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $addFields: {
            "reply_message_id.sender_name":
              "$reply_message_id.sender_data.full_name",
          },
        },
        {
          $lookup: {
            from: "chat_reactions",
            localField: "_id",
            foreignField: "chat_id",
            as: "chat_reactions",
          },
        },
        {
          $lookup: {
            from: "users", // Adjust to your users collection
            localField: "poll.voters.user_id",
            foreignField: "_id",
            as: "voter_profiles",
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "call_data.joined_users",
            foreignField: "_id",
            as: "joined_users_data",
            pipeline: [
              {
                $project: {
                  _id: 1,
                  full_name: 1,
                  profile_picture: {
                    $cond: [
                      { $ne: ["$profile_picture", null] },
                      { $concat: [process.env.BASE_URL, "$profile_picture"] },
                      null
                    ]
                  }
                }
              }
            ]
          }
        },
        {
          $addFields: {
            // emojiCounts: {
            //   $map: {
            //     input: {
            //       $reduce: {
            //         input: "$chat_reactions",
            //         initialValue: [],
            //         in: {
            //           $cond: [
            //             {
            //               $in: ["$$this.emoji", "$$value.emoji"],
            //             },
            //             "$$value",
            //             { $concatArrays: ["$$value", ["$$this"]] },
            //           ],
            //         },
            //       },
            //     },
            //     as: "emoji",
            //     in: {
            //       emoji: "$$emoji.emoji",
            //       count: {
            //         $size: {
            //           $filter: {
            //             input: "$chat_reactions",
            //             as: "reaction",
            //             cond: { $eq: ["$$reaction.emoji", "$$emoji.emoji"] },
            //           },
            //         },
            //       },
            //     },
            //   },
            // },
            emojiCounts: {
              $map: {
                input: {
                  $reduce: {
                    input: "$chat_reactions",
                    initialValue: [],
                    in: {
                      $cond: [
                        {
                          $in: ["$$this.emoji", "$$value.emoji"],
                        },
                        "$$value",
                        { $concatArrays: ["$$value", ["$$this"]] },
                      ],
                    },
                  },
                },
                as: "emoji",
                in: {
                  emoji: "$$emoji.emoji",
                  count: {
                    $size: {
                      $filter: {
                        input: "$chat_reactions",
                        as: "reaction",
                        cond: { $eq: ["$$reaction.emoji", "$$emoji.emoji"] },
                      },
                    },
                  },
                  user_ids: {
                    $map: {
                      input: {
                        $filter: {
                          input: "$chat_reactions",
                          as: "reaction",
                          cond: { $eq: ["$$reaction.emoji", "$$emoji.emoji"] },
                        },
                      },
                      as: "filteredReaction",
                      in: "$$filteredReaction.user_id",
                    },
                  },
                },
              },
            },
            poll: {
              $cond: {
                if: { $eq: ["$message_type", "poll"] },
                then: {
                  question: "$poll.question",
                  poll_id: "$poll._id",
                  options: {
                    $map: {
                      input: "$poll.options",
                      as: "option",
                      in: {
                        _id: "$$option._id",
                        text: "$$option.text",
                        vote_count: {
                          $size: {
                            $filter: {
                              input: "$poll.voters",
                              as: "voter",
                              cond: {
                                $eq: ["$$voter.option_id", "$$option._id"],
                              },
                            },
                          },
                        },
                        voted_users: {
                          $map: {
                            input: {
                              $slice: [
                                {
                                  $sortArray: {
                                    input: {
                                      $filter: {
                                        input: "$poll.voters",
                                        as: "voter",
                                        cond: {
                                          $eq: [
                                            "$$voter.option_id",
                                            "$$option._id",
                                          ],
                                        },
                                      },
                                    },
                                    sortBy: { vote_time: -1 }, // Sort by vote_time descending
                                  },
                                },
                                2, // Get the latest 2 voters
                              ],
                            },
                            as: "voter",
                            in: {
                              profile_picture: {
                                $let: {
                                  vars: {
                                    profile: {
                                      $arrayElemAt: [
                                        {
                                          $filter: {
                                            input: "$voter_profiles",
                                            as: "profile",
                                            cond: {
                                              $eq: [
                                                "$$profile._id",
                                                "$$voter.user_id",
                                              ],
                                            },
                                          },
                                        },
                                        0,
                                      ],
                                    },
                                  },
                                  in: {
                                    $cond: [
                                      {
                                        $ne: [
                                          "$$profile.profile_picture",
                                          null,
                                        ],
                                      },
                                      {
                                        $concat: [
                                          process.env.BASE_URL,
                                          "$$profile.profile_picture",
                                        ],
                                      },
                                      null,
                                    ],
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                  is_multiple: "$poll.is_multiple",
                },
                else: "$$REMOVE",
              },
            },
          },
        },
        {
          $addFields: {
            // chat_reactions: {
            //   $map: {
            //     input: "$emojiCounts",
            //     as: "emojiObj",
            //     in: {
            //       emoji: "$$emojiObj.emoji",
            //       count: "$$emojiObj.count",
            //       user_ids:"$$emojiObj.user_ids"
            //     },
            //   },
            // },
            media_file: {
              $map: {
                input: {
                  $filter: {
                    input: "$media_file",
                    as: "media",
                    cond: {
                      $and: [
                        { $eq: ["$$media.deleted_everyone", false] },
                        {
                          $not: {
                            $in: [userObjectId, "$$media.is_deleted_by"],
                          },
                        },
                      ],
                    },
                  },
                },
                as: "media",
                in: {
                  $mergeObjects: [
                    "$$media",
                    {
                      file_name: {
                        $cond: [
                          { $ne: ["$$media.file_name", null] },
                          {
                            $concat: [
                              process.env.BASE_URL,
                              "$$media.file_name",
                            ],
                          },
                          "$$media.file_name",
                        ],
                      },
                      thumbnail: {
                        $cond: [
                          {
                            $and: [
                              { $eq: ["$$media.file_type", "video"] },
                              { $ne: ["$$media.thumbnail", null] },
                            ],
                          },
                          {
                            $concat: [
                              process.env.BASE_URL,
                              "$$media.thumbnail",
                            ],
                          },
                          "$$media.thumbnail",
                        ],
                      },
                    },
                  ],
                },
              },
            },
            replied_message_media: {
              $map: {
                input: "$replied_message_media",
                as: "media",
                in: {
                  $mergeObjects: [
                    "$$media",
                    {
                      file_name: {
                        $cond: [
                          { $ne: ["$$media.file_name", null] },
                          {
                            $concat: [
                              process.env.BASE_URL,
                              "$$media.file_name",
                            ],
                          },
                          "$$media.file_name",
                        ],
                      },
                      thumbnail: {
                        $cond: [
                          {
                            $and: [
                              { $eq: ["$$media.file_type", "video"] },
                              { $ne: ["$$media.thumbnail", null] },
                            ],
                          },
                          {
                            $concat: [
                              process.env.BASE_URL,
                              "$$media.thumbnail",
                            ],
                          },
                          "$$media.thumbnail",
                        ],
                      },
                    },
                  ],
                },
              },
            },
            call_data: {
              $cond: {
                if: {
                  $and: [
                    { $in: ["$message_type", ["video_call", "audio_call"]] },
                    { $not: { $in: [userObjectId, "$call_data.joined_users"] } },
                    { $eq: ["$call_data.call_status", "end"] }
                  ]
                },
                then: {
                  $mergeObjects: [
                    "$call_data",
                    {
                      call_status: "missed_call",
                      joined_users: "$joined_users_data"
                    }
                  ]
                },
                else: {
                  $mergeObjects: [
                    "$call_data",
                    { joined_users: "$joined_users_data" }
                  ]
                }
              }
            }
          },
        },
        {
          $addFields: {
            reply_message_id: {
              $cond: {
                if: {
                  $or: [
                    { $eq: [{ $type: "$reply_message_id._id" }, "missing"] },
                    { $eq: ["$reply_message_id", null] },
                    { $eq: ["$reply_message_id", {}] },
                  ],
                },
                then: "$$REMOVE",
                else: "$reply_message_id",
              },
            },
            is_starred: {
              $cond: {
                if: { $in: [userObjectId, "$stared_by"] }, // Check if userObjectId is in stared_by
                then: true,
                else: false,
              },
            },
            call_data: {
              $cond: {
                if: {
                  $in: ["$message_type", ["video_call", "audio_call"]]
                },
                then: "$call_data",
                else: "$$REMOVE",
              },
            },
          },
        },
        {
          $project: {
            _id: 1,
            chat_room_id: 1,
            message: 1,
            call_data: 1,
            message_type: 1,
            message_time: 1,
            createdAt: 1,
            is_read: 1,
            is_pin: 1,
            is_edited: 1,
            is_forwarded: 1,
            is_starred: 1,
            is_delete_everyone: 1,
            is_delete_by: 1,
            media_file: 1,
            sender_id: 1,
            receiver_id: 1,
            poll: 1,
            location: 1,
            decryptedMessage: 1,
            reply_message_id: {
              _id: 1,
              chat_room_id: 1,
              message: 1,
              poll: {
                _id: 1,
                question: 1,
              },
              message_type: 1,
              message_time: 1,
              createdAt: 1,
              is_read: 1,
              is_pin: 1,
              location: 1,
              is_edited: 1,
              is_forwarded: 1,
              is_delete_everyone: 1,
              is_delete_by: 1,
              media_file: 1,
              sender_id: 1,
              sender_name: 1,
              receiver_id: 1,
              replied_message_media: 1,
              createdAt: 1,
              updatedAt: 1,
            },
            replied_message_media: 1,
            chat_reactions: 1,
            createdAt: 1,
            updatedAt: 1,
          },
        }
      );

      const findAllMessage = await chat.aggregate(pipeline);

      let messages_count = await chat.countDocuments({
        chat_room_id: new mongoose.Types.ObjectId(chat_room_id),
        is_delete_by: { $ne: new mongoose.Types.ObjectId(user_id) },
      });

      let find_last_pinned_message = [
        {
          $match: {
            chat_room_id: new mongoose.Types.ObjectId(chat_room_id),
            is_delete_everyone: false,
            is_pin: true,
            is_delete_by: { $ne: new mongoose.Types.ObjectId(user_id) },
          },
        },
        {
          $sort: { createdAt: -1 },
        },
        {
          $limit: 1,
        },
        {
          $addFields: {
            media_file: {
              $map: {
                input: "$media_file",
                as: "media",
                in: {
                  $mergeObjects: [
                    "$$media",
                    {
                      file_name: {
                        $cond: [
                          { $ne: ["$$media.file_name", null] },
                          {
                            $concat: [
                              process.env.BASE_URL,
                              "$$media.file_name",
                            ],
                          },
                          "$$media.file_name",
                        ],
                      },
                      thumbnail: {
                        $cond: [
                          {
                            $and: [
                              { $eq: ["$$media.file_type", "video"] },
                              { $ne: ["$$media.thumbnail", null] },
                            ],
                          },
                          {
                            $concat: [
                              process.env.BASE_URL,
                              "$$media.thumbnail",
                            ],
                          },
                          "$$media.thumbnail",
                        ],
                      },
                    },
                  ],
                },
              },
            },
          },
        },
        {
          $project: {
            _id: 1,
            chat_room_id: 1,
            message: 1,
            message_type: 1,
            poll: 1,
            message_time: 1,
            createdAt: 1,
            is_read: 1,
            is_edited: 1,
            is_delete_everyone: 1,
            is_delete_by: 1,
            media_file: 1,
            sender_id: 1,
            reply_message_id: 1,
            createdAt: 1,
            updatedAt: 1,
          },
        },
      ];

      const pinned_msg = await chat.aggregate(find_last_pinned_message);

      let res_data = {
        chat_room_data: findRoom,
        pinned_message: pinned_msg.length > 0 ? pinned_msg[0] : null,
        messages: findAllMessage,
      };

      return socketMultiSuccessRes(
        "Message list get successfully",
        messages_count,
        res_data
      );
    } catch (error) {
      console.log(error);
      return socketErrRes("Something went wrong", error);
    }
  },
};
