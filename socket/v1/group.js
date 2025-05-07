const chat_room = require("./../../api/models/M_chat_room");
const chat = require("./../../api/models/M_chat");
const users = require("./../../api/models/M_user");
const user_session = require("./../../api/models/M_user_session");

const mongoose = require("mongoose");
const os = require("os");

const {
  notificationSend,
  notiSendMultipleDevice,
  // notiSendMultipleDevice
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

const { getChatRoomData, getChatData } = require("./common");

module.exports = {
  createGroup: async (data) => {
    try {
      let { group_name, member_ids, group_image, group_description, user_id } =
        data;

      const find_user = await users.findOne({
        _id: user_id,
        is_self_delete: false,
        is_deleted: false,
      });

      if (!find_user) {
        return socketErrorRes("User not found");
      }

      const find_all_member = await users.find({
        _id: {
          $in: member_ids,
        },
      });

      if (find_all_member.length != member_ids.length) {
        return socketErrorRes("Member not found");
      }

      member_ids.push(user_id);

      const insert_data = {
        room_type: "group",
        group_name: group_name,
        group_description: group_description,
        member_ids: member_ids,
        all_member_ids: member_ids,
        admin_ids: [user_id],
        read_by: [user_id],
        created_by: user_id,
        group_image: group_image ? group_image : null,
      };

      let create_group = await chat_room.create(insert_data);

      if (!create_group) {
        return socketErrorRes("Failed to create group");
      } else {
        let currentDateTime = await dateTime();

        const create_message = await chat.create({
          chat_room_id: create_group._id,
          sender_id: user_id,
          receiver_ids: member_ids,
          message_time: currentDateTime,
          message_type: "create_group",
        });

        if (group_image) {
          delete create_group.group_image;
          create_group.group_image = process.env.BASE_URL + group_image;
        }

        const find_device_token = await user_session.distinct("device_token", {
          user_id: { $in: member_ids },
          is_active: false,
          socket_id: { $eq: null },
          is_deleted: false,
        });

        const notification_data = {
          noti_title: "New Group Created",
          noti_msg: `You have been added to the "${group_name}" group created by ${find_user.full_name}.`,
          device_token: find_device_token,
          noti_for: "group_created",
          id: create_group._id,
          noti_image: create_group.group_image,
        };

        notiSendMultipleDevice(notification_data);

        return socketSuccessRes("Group created successfully", create_group);
      }
    } catch (error) {
      console.log("createGroup error", error.message);
      socketErrorRes("Something went wrong");
    }
  },

  getGroupDetails: async (data) => {
    try {
      let { chat_room_id, user_id } = data;

      let userObjectId = new mongoose.Types.ObjectId(user_id);
      let chatRoomObjectId = new mongoose.Types.ObjectId(chat_room_id);

      let getGroupDetails = await chat_room.aggregate([
        {
          $match: {
            _id: chatRoomObjectId, // Match the chat room
            room_type: "group", // Ensure it's a group chat
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "member_ids",
            foreignField: "_id",
            as: "group_members",
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "created_by",
            foreignField: "_id",
            as: "created_by",
          },
        },
        {
          $unwind: {
            path: "$created_by",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $addFields: {
            group_image: {
              $cond: {
                if: {
                  $and: [
                    { $eq: ["$room_type", "group"] }, // Check if room_type is "group"
                    { $ifNull: ["$group_image", false] }, // Check if group_image exists
                  ],
                },
                then: { $concat: [process.env.BASE_URL, "$group_image"] },
                else: null,
              },
            },
            members: {
              $map: {
                input: "$group_members",
                as: "member",
                in: {
                  user_id: "$$member._id",
                  full_name: "$$member.full_name",
                  profile_picture: {
                    $cond: {
                      if: { $ifNull: ["$$member.profile_picture", false] },
                      then: {
                        $concat: [
                          process.env.BASE_URL,
                          "$$member.profile_picture",
                        ],
                      },
                      else: null,
                    },
                  },
                  is_admin: { $in: ["$$member._id", "$admin_ids"] }, // Check if user is in admin_ids
                },
              },
            },
          },
        },
        {
          $project: {
            _id: 1,
            room_type: 1,
            group_name: 1,
            group_image: 1,
            created_by: {
              full_name: 1,
            },
            _id: 1,
            members: {
              user_id: 1,
              full_name: 1,
              profile_picture: 1,
              is_admin: 1,
            },
          },
        },
      ]);

      if (getGroupDetails) {
        return socketSuccessRes(
          "Group details fetched successfully",
          getGroupDetails
        );
      } else {
        return socketErrorRes("Group not found.");
      }
    } catch (error) {
      console.log(error);
      return socketErrorRes("Error in getGroupDetails", error);
    }
  },

  sendGroupMessage: async (data) => {
    try {
      let {
        chat_room_id,
        sender_id,
        message,
        message_type,
        reply_message_id,
        media_file,
        poll,
        location,
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

      let receiver_ids = check_room_data.member_ids.filter(
        (id) => String(id) !== String(sender_id)
      );

      console.log({ receiver_ids });

      let insertData = {
        chat_room_id: chat_room_id,
        sender_id: sender_id,
        receiver_ids: receiver_ids,
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
            // console.log("media",find_message.media_file)
            // console.log("media",find_message.media_file)
            console.log(find_message.media_file);
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

      let findSender = await users.findOne({
        _id: sender_id,
        is_deleted: false,
      });

      let active_members = await user_session.distinct("user_id", {
        user_id: { $in: receiver_ids }, // Filter by group members
        is_active: true,
        chat_room_id: new mongoose.Types.ObjectId(chat_room_id),
        is_deleted: false,
      });

      console.log({ active_members });

      // if (active_members.length > 0) {
      //     insertData = {
      //         ...insertData,
      //         is_read_by: active_members
      //     }
      // };

      if (active_members.length > 0) {
        insertData = {
          ...insertData,
          is_read_by: active_members.map((user) => ({
            user_id: user,
            read_at: new Date(), // Store the current timestamp
          })),
        };
      }

      if (active_members.length == receiver_ids.length) {
        insertData = {
          ...insertData,
          is_read: "seen",
        };
      }

      let non_active_members = receiver_ids.filter(
        (id) => !active_members.map(String).includes(id.toString())
      );

      console.log("Non-Active Members:", non_active_members);

      console.log({ receiver_ids });
      console.log({ non_active_members });

      let non_active_unmuted_members = non_active_members.filter(
        (id) =>
          !check_room_data.muted_by.some(
            (user) => user.toString() === id.toString()
          )
      );

      console.log({ non_active_unmuted_members });

      let addMessage = await chat.create(insertData);


      // console.log({ insertData });
      // console.log(insertData);

      // let addMessage = await chat.create(insertData);

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
        // {
        //     $lookup: {
        //         from: "users",
        //         localField: "reply_message_id.receiver_id",
        //         foreignField: "_id",
        //         as: "reply_message_id.receiver_id",
        //     },
        // },
        // {
        //     $unwind: {
        //         path: "$reply_message_id.receiver_id",
        //         preserveNullAndEmptyArrays: true,
        //     },
        // },
        {
          $lookup: {
            from: "users",
            localField: "sender_id",
            foreignField: "_id",
            as: "sender_data",
          },
        },
        {
          $unwind: {
            path: "$sender_data",
            preserveNullAndEmptyArrays: true,
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
          $addFields: {
            sender_profile_picture: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$sender_data.profile_picture", null] },
                    {
                      $not: [
                        {
                          $regexMatch: {
                            input: "$sender_data.profile_picture",
                            regex: `^${process.env.BASE_URL}`,
                          },
                        },
                      ],
                    },
                  ],
                },
                {
                  $concat: [
                    process.env.BASE_URL,
                    "$sender_data.profile_picture",
                  ],
                },
                "$sender_data.profile_picture",
              ],
            },
            sender_name: "$sender_data.full_name",
            "reply_message_id.sender_name":
              "$reply_message_id.sender_data.full_name",
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
            is_pin: 1,
            is_edited: 1,
            is_forwarded: 1,
            is_delete_everyone: 1,
            is_delete_by: 1,
            media_file: 1,
            sender_data: "$$REMOVE",
            sender_id: 1,
            sender_profile_picture: 1,
            sender_name: 1,
            receiver_ids: 1,
            poll: 1,
            location: 1,
            reply_message_id: 1,
            replied_message_media: 1,
            createdAt: 1,
            updatedAt: 1,
          },
        },
      ];

      const [getMessage] = await chat.aggregate(pipeline);

      if (non_active_unmuted_members.length > 0) {
        let noti_title = check_room_data.group_name;

        let noti_msg;

        let noti_image = null;

        if (check_room_data.group_image != null) {
          noti_image = process.env.BASE_URL + check_room_data.group_image;
        }

        if (findSender.profile_picture != null) {
          sender_image = process.env.BASE_URL + findSender.profile_picture;
        }

        if (message_type == "media_with_text" || message_type == "media") {
          // noti_msg = `${findSender.full_name} sent a media`;
          noti_msg = `sent a media`;
        } else if (message_type == "poll") {
          // noti_msg = `${findSender.full_name} create a poll : ${poll.question}`;
          noti_msg = `create a poll : ${poll.question}`;
        } else if (message_type == "document") {
          noti_msg = `sent a document 📃`;
        } else {
          noti_msg = message;
        }

        // let noti_for = "chat_notification";
        let allowedMessageTypes = [
          "text",
          "link",
          "media",
          "emoji",
          "document",
          "contact",
          "media_with_text",
          "poll",
          "location",
        ];

        non_active_unmuted_members.forEach(async (receiver_id) => {
          let unreadMessages = await chat
            .find({
              chat_room_id: chat_room_id,
              sender_id: { $ne: receiver_id },
              receiver_ids: { $in: [receiver_id] },
              $not: { $in: [receiver_id, "$is_delete_by"] },
              // $not: { $in: [receiver_id, "$is_read_by"] },
              "is_read_by.user_id": { $nin: [receiver_id] }, // 
              message_type: { $in: allowedMessageTypes }
            })
            .select("message message_type poll sender_id createdAt")
            .populate("sender_id", "full_name") // Fetch sender's full name
            .sort({ createdAt: -1 }) // Get latest unread messages first
            .limit(5); // Maximum 5 messages

          console.log({ unreadMessages });


          // Step 1: Format unread messages
          let messageArray = unreadMessages.map((msg) => {
            let senderName = msg.sender_id?.full_name || "Someone"; // Handle missing sender name
            if (
              msg.message_type === "media_with_text" ||
              msg.message_type === "media"
            ) {
              return {
                text: `${senderName}: ${msg.message || "sent a media"} 🎥📸`,
                createdAt: msg.createdAt,
              };
            } else if (msg.message_type == "document") {
              return {
                text: `${senderName}: ${msg.message || "sent a document"} 📃`,
                createdAt: msg.createdAt,
              };
            } else if (msg.message_type === "poll") {
              return {
                text: `${senderName}: Created a poll: 📊 ${msg.poll?.question}`,
                createdAt: msg.createdAt,
              };
            } else if (msg.message_type === "location") {
              return {
                text: `${senderName}: shared alocation`,
                createdAt: msg.createdAt,
              };
            }
            else {
              return {
                text: `${senderName}: ${msg.message}`,
                createdAt: msg.createdAt,
              };
            }
          });

          // // Step 2: Add the current message as the latest message
          // if (message_type === "media_with_text" || message_type === "media") {
          //   messageArray.push({
          //     text: `Sent a media 🎥📸`,
          //     createdAt: new Date(),
          //   });
          // } else if (message_type === "poll") {
          //   messageArray.push({
          //     text: `Created a poll: 📊 ${poll?.question}`,
          //     createdAt: new Date(),
          //   });
          // } else {
          //   messageArray.push({ text: message, createdAt: new Date() });
          // }

          // Step 3: Sort messages by createdAt (latest first)
          messageArray.sort((a, b) => b.createdAt - a.createdAt);

          // Step 4: Extract only text messages for notification
          let sortedMessageArray = messageArray.map((msg) => msg.text);

          sortedMessageArray.reverse();

          console.log({ sortedMessageArray });


          // Step 5: Convert to JSON for notification
          let messages = JSON.stringify(sortedMessageArray);

          let noti_for = "chat_notification";

          let notiData = {
            noti_msg,
            noti_title,
            noti_for,
            noti_image,
            room_type: "group",
            chat_room_id: chat_room_id,
            messages
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
        });

        // let notiData = {
        //   noti_msg,
        //   noti_title,
        //   noti_for,
        //   noti_image,
        //   room_type: "group",
        //   sender_image: sender_image,
        //   sender_id,
        //   sender_name,
        //   // id: user_id
        // };

        // let find_token = await user_session.find({
        //   user_id: { $in: non_active_unmuted_members },
        //   is_deleted: false,
        // });

        // let device_token_array = find_token.map((row) => row.device_token);

        // if (device_token_array.length > 0) {
        //   notiData = { ...notiData, device_token: device_token_array };
        //   console.log("noti sent topic");
        //   notiSendMultipleDevice(notiData);
        // }
      }

      if (check_room_data.is_delete_by.length > 0) {
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
      return socketErrorRes("Error in sendGroupMessage", error);
    }
  },

  forwardMessageToGroup: async (data) => {
    try {
      let { chat_room_id, sender_id, forwarded_mesaages } = data;

      let check_room_data = await chat_room.findOne({
        _id: chat_room_id,
        is_deleted: false,
      });

      if (!check_room_data) {
        return socketErrorRes("Group does not exist.");
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

      let receiver_ids = check_room_data.member_ids.filter(
        (id) => String(id) !== String(sender_id)
      );

      console.log({ receiver_ids });

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
          receiver_ids: receiver_ids,
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
                  file_name: `chat_media/${newFileName}`, // Path relative to `public/`
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

        let findSender = await users.findOne({
          _id: sender_id,
          is_deleted: false,
        });

        let active_members = await user_session.distinct("user_id", {
          user_id: { $in: receiver_ids }, // Filter by group members
          is_active: true,
          chat_room_id: new mongoose.Types.ObjectId(chat_room_id),
          is_deleted: false,
        });

        console.log({ active_members });

        if (active_members.length > 0) {
          insert_data = {
            ...insert_data,
            is_read_by: active_members.map((user) => ({
              user_id: user,
              read_at: new Date(), // Store the current timestamp
            })),
          };
        }

        if (active_members.length == receiver_ids.length) {
          insert_data = {
            ...insert_data,
            is_read: "seen",
          };
        }

        let non_active_members = receiver_ids.filter(
          (id) => !active_members.includes(id)
        );

        let non_active_unmuted_members = non_active_members.filter(
          (id) =>
            !check_room_data.muted_by.some(
              (user) => user.toString() === id.toString()
            )
        );

        if (non_active_unmuted_members.length > 0) {
          let noti_title = check_room_data.group_name;

          let noti_msg;

          let noti_image = null;

          if (check_room_data.group_image != null) {
            noti_image = process.env.BASE_URL + check_room_data.group_image;
          }

          let sender_image = null;

          if (findSender.profile_picture != null) {
            sender_image = process.env.BASE_URL + findSender.profile_picture;
          }

          if (
            find_chat.message_type == "media_with_text" ||
            find_chat.message_type == "media"
          ) {
            noti_msg = `${findSender.full_name} forward a media 🎥📸`;
          } else if (find_chat.message_type == "document") {
            noti_msg = `sent a document 📃`;
          } else {
            noti_msg = find_chat.message;
          }

          let allowedMessageTypes = [
            "text",
            "link",
            "media",
            "emoji",
            "document",
            "contact",
            "media_with_text",
            "poll",
            "location",
          ];

          non_active_unmuted_members.forEach(async (receiver_id) => {
            let unreadMessages = await chat
              .find({
                chat_room_id: chat_room_id,
                sender_id: { $ne: receiver_id },
                receiver_ids: { $in: [receiver_id] },
                $not: { $in: [receiver_id, "$is_delete_by"] },
                // $not: { $in: [receiver_id, "$is_read_by"] },
                "is_read_by.user_id": { $nin: [receiver_id] }, // 
                message_type: { $in: allowedMessageTypes }
              })
              .select("message message_type poll sender_id createdAt")
              .populate("sender_id", "full_name") // Fetch sender's full name
              .sort({ createdAt: -1 }) // Get latest unread messages first
              .limit(5); // Maximum 5 messages

            console.log({ unreadMessages });


            // Step 1: Format unread messages
            let messageArray = unreadMessages.map((msg) => {
              let senderName = msg.sender_id?.full_name || "Someone"; // Handle missing sender name
              if (
                msg.message_type === "media_with_text" ||
                msg.message_type === "media"
              ) {
                return {
                  text: `${senderName}: ${msg.message || "sent a media"} 🎥📸`,
                  createdAt: msg.createdAt,
                };
              } else if (msg.message_type == "document") {
                return {
                  text: `${senderName}: ${msg.message || "sent a document"} 📃`,
                  createdAt: msg.createdAt,
                };
              } else if (msg.message_type === "poll") {
                return {
                  text: `${senderName}: Created a poll: 📊 ${msg.poll?.question}`,
                  createdAt: msg.createdAt,
                };
              } else if (msg.message_type === "location") {
                return {
                  text: `${senderName}: shared alocation`,
                  createdAt: msg.createdAt,
                };
              }
              else {
                return {
                  text: `${senderName}: ${msg.message}`,
                  createdAt: msg.createdAt,
                };
              }
            });

            // // Step 2: Add the current message as the latest message
            // if (message_type === "media_with_text" || message_type === "media") {
            //   messageArray.push({
            //     text: `Sent a media 🎥📸`,
            //     createdAt: new Date(),
            //   });
            // } else if (message_type === "poll") {
            //   messageArray.push({
            //     text: `Created a poll: 📊 ${poll?.question}`,
            //     createdAt: new Date(),
            //   });
            // } else {
            //   messageArray.push({ text: message, createdAt: new Date() });
            // }

            // Step 3: Sort messages by createdAt (latest first)
            messageArray.sort((a, b) => b.createdAt - a.createdAt);

            // Step 4: Extract only text messages for notification
            let sortedMessageArray = messageArray.map((msg) => msg.text);

            sortedMessageArray.reverse();

            console.log({ sortedMessageArray });


            // Step 5: Convert to JSON for notification
            let messages = JSON.stringify(sortedMessageArray);

            let noti_for = "chat_notification";

            let notiData = {
              noti_msg,
              noti_title,
              noti_for,
              noti_image,
              room_type: "group",
              chat_room_id: chat_room_id,
              messages
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
          });


          // let noti_for = "chat_notification";

          // let sender_id = findSender._id;
          // let sender_name = findSender.full_name;

          // let notiData = {
          //   noti_msg,
          //   noti_title,
          //   noti_for,
          //   noti_image,
          //   room_type: "group",
          //   sender_image: sender_image,
          //   sender_id,
          //   sender_name,
          //   // id: user_id
          // };

          // let find_token = await user_session.find({
          //   user_id: { $in: non_active_unmuted_members },
          //   is_deleted: false,
          // });

          // let device_token_array = find_token.map((row) => row.device_token);

          // if (device_token_array.length > 0) {
          //   notiData = { ...notiData, device_token: device_token_array };
          //   console.log("noti sent topic");
          //   notiSendMultipleDevice(notiData);
          // }
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
        {
          $lookup: {
            from: "users",
            localField: "sender_id",
            foreignField: "_id",
            as: "sender_data",
          },
        },
        {
          $unwind: {
            path: "$sender_data",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $addFields: {
            sender_profile_picture: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$sender_data.profile_picture", null] },
                    {
                      $not: [
                        {
                          $regexMatch: {
                            input: "$sender_data.profile_picture",
                            regex: `^${process.env.BASE_URL}`,
                          },
                        },
                      ],
                    },
                  ],
                },
                {
                  $concat: [
                    process.env.BASE_URL,
                    "$sender_data.profile_picture",
                  ],
                },
                "$sender_data.profile_picture",
              ],
            },
            sender_name: "$sender_data.full_name",
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
            is_pin: 1,
            is_edited: 1,
            is_forwarded: 1,
            is_delete_everyone: 1,
            is_delete_by: 1,
            media_file: 1,
            sender_data: "$$REMOVE",
            sender_id: 1,
            sender_profile_picture: 1,
            sender_name: 1,
            receiver_ids: 1,
            poll: 1,
            location: 1,
            reply_message_id: 1,
            replied_message_media: 1,
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

  forwardMediaMessageToGroup: async (data) => {
    try {
      let { chat_room_id, sender_id, message_id, forwarded_media_mesaages } =
        data;

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

      let receiver_ids = check_room_data.member_ids.filter(
        (id) => String(id) !== String(sender_id)
      );

      console.log({ receiver_ids });

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
                file_name: `chat_media/${newFileName}`, // Path relative to `public/`
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
        receiver_ids: receiver_ids,
        message_time: currentDateTime,
        message_type: "media",
        created_at: currentDateTime,
        updated_at: currentDateTime,
      };

      console.log({ inserted_media });

      if (findChat.sender_id.toString() != sender_id) {
        insert_data.is_forwarded = true;
      }

      if (inserted_media.length > 0) {
        insert_data.media_file = inserted_media;
      }

      let findSender = await users.findOne({
        _id: sender_id,
        is_deleted: false,
      });

      let active_members = await user_session.distinct("user_id", {
        user_id: { $in: receiver_ids }, // Filter by group members
        is_active: true,
        chat_room_id: new mongoose.Types.ObjectId(chat_room_id),
        is_deleted: false,
      });

      console.log({ active_members });

      if (active_members.length > 0) {
        insert_data = {
          ...insert_data,
          is_read_by: active_members.map((user) => ({
            user_id: user,
            read_at: new Date(), // Store the current timestamp
          })),
        };
      }

      if (active_members.length == receiver_ids.length) {
        insert_data = {
          ...insert_data,
          is_read: "seen",
        };
      }

      let non_active_members = receiver_ids.filter(
        (id) => !active_members.includes(id)
      );

      let non_active_unmuted_members = non_active_members.filter(
        (id) =>
          !check_room_data.muted_by.some(
            (user) => user.toString() === id.toString()
          )
      );

      if (non_active_unmuted_members.length > 0) {
        let noti_title = check_room_data.group_name;

        let noti_msg;

        let noti_image = null;

        if (check_room_data.group_image != null) {
          noti_image = process.env.BASE_URL + check_room_data.group_image;
        }

        // if (findSender.profile_picture != null) {
        //   sender_image = process.env.BASE_URL + findSender.profile_picture;
        // }

        if (message_type == "media_with_text" || message_type == "media") {
          // noti_msg = `${findSender.full_name} sent a media`;
          noti_msg = `sent a media`;
        } else if (message_type == "poll") {
          // noti_msg = `${findSender.full_name} create a poll : ${poll.question}`;
          noti_msg = `create a poll : ${poll.question}`;
        } else if (message_type == "document") {
          noti_msg = `sent a document 📃`;
        } else {
          noti_msg = message;
        }

        // let noti_for = "chat_notification";
        let allowedMessageTypes = [
          "text",
          "link",
          "media",
          "emoji",
          "document",
          "contact",
          "media_with_text",
          "poll",
          "location",
        ];

        non_active_unmuted_members.forEach(async (receiver_id) => {
          let unreadMessages = await chat
            .find({
              chat_room_id: chat_room_id,
              sender_id: { $ne: receiver_id },
              receiver_ids: { $in: [receiver_id] },
              $not: { $in: [receiver_id, "$is_delete_by"] },
              // $not: { $in: [receiver_id, "$is_read_by"] },
              "is_read_by.user_id": { $nin: [receiver_id] }, // 
              message_type: { $in: allowedMessageTypes }
            })
            .select("message message_type poll sender_id createdAt")
            .populate("sender_id", "full_name") // Fetch sender's full name
            .sort({ createdAt: -1 }) // Get latest unread messages first
            .limit(5); // Maximum 5 messages

          console.log({ unreadMessages });


          // Step 1: Format unread messages
          let messageArray = unreadMessages.map((msg) => {
            let senderName = msg.sender_id?.full_name || "Someone"; // Handle missing sender name
            if (
              msg.message_type === "media_with_text" ||
              msg.message_type === "media"
            ) {
              return {
                text: `${senderName}: ${msg.message || "sent a media"} 🎥📸`,
                createdAt: msg.createdAt,
              };
            } else if (msg.message_type == "document") {
              return {
                text: `${senderName}: ${msg.message || "sent a document"} 📃`,
                createdAt: msg.createdAt,
              };
            } else if (msg.message_type === "poll") {
              return {
                text: `${senderName}: Created a poll: 📊 ${msg.poll?.question}`,
                createdAt: msg.createdAt,
              };
            } else if (msg.message_type === "location") {
              return {
                text: `${senderName}: shared alocation`,
                createdAt: msg.createdAt,
              };
            }
            else {
              return {
                text: `${senderName}: ${msg.message}`,
                createdAt: msg.createdAt,
              };
            }
          });

          // // Step 2: Add the current message as the latest message
          // if (message_type === "media_with_text" || message_type === "media") {
          //   messageArray.push({
          //     text: `Sent a media 🎥📸`,
          //     createdAt: new Date(),
          //   });
          // } else if (message_type === "poll") {
          //   messageArray.push({
          //     text: `Created a poll: 📊 ${poll?.question}`,
          //     createdAt: new Date(),
          //   });
          // } else {
          //   messageArray.push({ text: message, createdAt: new Date() });
          // }

          // Step 3: Sort messages by createdAt (latest first)
          messageArray.sort((a, b) => b.createdAt - a.createdAt);

          // Step 4: Extract only text messages for notification
          let sortedMessageArray = messageArray.map((msg) => msg.text);

          sortedMessageArray.reverse();

          console.log({ sortedMessageArray });


          // Step 5: Convert to JSON for notification
          let messages = JSON.stringify(sortedMessageArray);

          let noti_for = "chat_notification";

          let notiData = {
            noti_msg,
            noti_title,
            noti_for,
            noti_image,
            room_type: "group",
            chat_room_id: chat_room_id,
            messages
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
        });

        // let notiData = {
        //   noti_msg,
        //   noti_title,
        //   noti_for,
        //   noti_image,
        //   room_type: "group",
        //   sender_image: sender_image,
        //   sender_id,
        //   sender_name,
        //   // id: user_id
        // };

        // let find_token = await user_session.find({
        //   user_id: { $in: non_active_unmuted_members },
        //   is_deleted: false,
        // });

        // let device_token_array = find_token.map((row) => row.device_token);

        // if (device_token_array.length > 0) {
        //   notiData = { ...notiData, device_token: device_token_array };
        //   console.log("noti sent topic");
        //   notiSendMultipleDevice(notiData);
        // }
      }

      let addMessage = await chat.create(insert_data);

      const pipeline = [
        {
          $match: {
            _id: addMessage._id,
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "sender_id",
            foreignField: "_id",
            as: "sender_data",
          },
        },
        {
          $unwind: {
            path: "$sender_data",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $addFields: {
            sender_profile_picture: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$sender_data.profile_picture", null] },
                    {
                      $not: [
                        {
                          $regexMatch: {
                            input: "$sender_data.profile_picture",
                            regex: `^${process.env.BASE_URL}`,
                          },
                        },
                      ],
                    },
                  ],
                },
                {
                  $concat: [
                    process.env.BASE_URL,
                    "$sender_data.profile_picture",
                  ],
                },
                "$sender_data.profile_picture",
              ],
            },
            sender_name: "$sender_data.full_name",
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
            is_pin: 1,
            is_edited: 1,
            is_forwarded: 1,
            is_delete_everyone: 1,
            is_delete_by: 1,
            media_file: 1,
            sender_data: "$$REMOVE",
            sender_id: 1,
            sender_profile_picture: 1,
            sender_name: 1,
            receiver_ids: 1,
            poll: 1,
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

  getAllGroupMessage: async (data) => {
    try {
      let { chat_room_id, user_id, page, limit } = data;

      const userObjectId = new mongoose.Types.ObjectId(user_id);

      let [findGroup] = await chat_room.aggregate([
        {
          $match: {
            _id: new mongoose.Types.ObjectId(chat_room_id),
            room_type: "group",
            is_deleted: false,
            is_delete_by: { $ne: new mongoose.Types.ObjectId(user_id) },
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
          },
        },
        {
          $project: {
            _id: 1,
            is_online: 1,
            member_ids: 1,
          },
        },
      ]);

      if (!findGroup) {
        return socketErrorRes("Group not found");
      }

      findGroup.is_member = false;

      if (findGroup.member_ids.some((id) => id.equals(userObjectId))) {
        findGroup.is_member = true;
      }

      const pipeline = [
        {
          $match: {
            chat_room_id: new mongoose.Types.ObjectId(chat_room_id),
            is_delete_by: { $ne: new mongoose.Types.ObjectId(user_id) },
            $or: [{ sender_id: userObjectId }, { receiver_ids: userObjectId }],
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
            from: "users",
            localField: "sender_id",
            foreignField: "_id",
            as: "sender_data",
          },
        },
        {
          $unwind: {
            path: "$sender_data",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: "chat_rooms",
            localField: "chat_room_id",
            foreignField: "_id",
            as: "group_data",
          },
        },
        {
          $unwind: {
            path: "$group_data",
            preserveNullAndEmptyArrays: true,
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
            localField: "user_ids",
            foreignField: "_id",
            as: "user_ids",
            pipeline: [
              {
                $project: {
                  _id: 1,
                  full_name: 1,
                },
              },
            ],
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
                              user_id: "$$voter.user_id",
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
            is_read: {
              $cond: {
                if: {
                  $eq: [{ $size: "$receiver_ids" }, { $size: "$is_read_by" }],
                },
                then: "seen",
                else: "sent",
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
            users: {
              $switch: {
                branches: [
                  {
                    case: { $eq: [{ $size: "$user_ids" }, 0] }, // No users
                    then: "$$REMOVE",
                  },
                  {
                    case: { $eq: [{ $size: "$user_ids" }, 1] }, // Only one user
                    then: { $arrayElemAt: ["$user_ids.full_name", 0] },
                  },
                  {
                    case: { $eq: [{ $size: "$user_ids" }, 2] }, // Two users
                    then: {
                      $concat: [
                        { $arrayElemAt: ["$user_ids.full_name", 0] },
                        " and ",
                        { $arrayElemAt: ["$user_ids.full_name", 1] },
                      ],
                    },
                  },
                  {
                    case: { $gt: [{ $size: "$user_ids" }, 2] }, // More than two users
                    then: {
                      $let: {
                        vars: {
                          allButLast: {
                            $slice: [
                              "$user_ids.full_name",
                              0,
                              { $subtract: [{ $size: "$user_ids" }, 1] },
                            ],
                          },
                          lastUser: {
                            $arrayElemAt: [
                              "$user_ids.full_name",
                              { $subtract: [{ $size: "$user_ids" }, 1] },
                            ],
                          },
                        },
                        in: {
                          $concat: [
                            {
                              $reduce: {
                                input: "$$allButLast",
                                initialValue: "",
                                in: {
                                  $concat: [
                                    "$$value",
                                    {
                                      $cond: {
                                        if: { $eq: ["$$value", ""] },
                                        then: "",
                                        else: ", ",
                                      },
                                    },
                                    "$$this",
                                  ],
                                },
                              },
                            },
                            " and ",
                            "$$lastUser",
                          ],
                        },
                      },
                    },
                  },
                ],
                default: "$$REMOVE",
              },
            },
            is_added: {
              $cond: [{ $in: [userObjectId, "$user_ids._id"] }, true, false],
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
            sender_profile_picture: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$sender_data.profile_picture", null] },
                    {
                      $not: [
                        {
                          $regexMatch: {
                            input: "$sender_data.profile_picture",
                            regex: `^${process.env.BASE_URL}`,
                          },
                        },
                      ],
                    },
                  ],
                },
                {
                  $concat: [
                    process.env.BASE_URL,
                    "$sender_data.profile_picture",
                  ],
                },
                "$sender_data.profile_picture",
              ],
            },
            sender_name: "$sender_data.full_name",
            message: {
              $cond: {
                if: {
                  $in: [
                    "$message_type",
                    [
                      "create_group",
                      "add_member",
                      "make_admin",
                      "remove_admin",
                      "remove_member",
                      "exit_group",
                    ],
                  ],
                },
                then: {
                  $switch: {
                    branches: [
                      {
                        case: { $eq: ["$message_type", "create_group"] },
                        then: {
                          $cond: {
                            if: { $eq: ["$sender_id", userObjectId] },
                            then: "You created this group.",
                            else: {
                              $concat: [
                                "You have been added to the '",
                                "$group_data.group_name",
                                "' group created by ",
                                "$sender_data.full_name",
                                ".",
                              ],
                            },
                          },
                        },
                      },
                      {
                        case: { $eq: ["$message_type", "add_member"] },
                        then: {
                          $cond: {
                            if: { $eq: ["$is_added", true] },
                            then: {
                              $concat: [
                                "You were added to the group by ",
                                "$sender_data.full_name",
                                ".",
                              ],
                            },
                            else: {
                              $cond: {
                                if: { $eq: ["$sender_id", userObjectId] },
                                then: {
                                  $concat: [
                                    "You added ",
                                    "$users",
                                    " to the group.",
                                  ],
                                },
                                else: {
                                  $concat: [
                                    "$sender_data.full_name",
                                    " added ",
                                    "$users",
                                    " to the group.",
                                  ],
                                },
                              },
                            },
                          },
                        },
                      },
                      {
                        case: { $eq: ["$message_type", "make_admin"] },
                        then: {
                          $concat: ["You're now an admin."],
                        },
                      },
                      {
                        case: { $eq: ["$message_type", "remove_admin"] },
                        then: {
                          $concat: ["You're no longer an admin."],
                        },
                      },
                      {
                        case: { $eq: ["$message_type", "remove_member"] },
                        then: {
                          $cond: {
                            if: { $eq: ["$is_added", true] },
                            then: {
                              $concat: [
                                "$sender_data.full_name",
                                " removed you",
                                ".",
                              ],
                            },
                            else: {
                              $cond: {
                                if: { $eq: ["$sender_id", userObjectId] },
                                then: {
                                  $concat: ["You removed ", "$users", "."],
                                },
                                else: {
                                  $concat: [
                                    "$sender_data.full_name",
                                    " removed ",
                                    "$users",
                                    ".",
                                  ],
                                },
                              },
                            },
                          },
                        },
                      },
                      {
                        case: {
                          $eq: ["$message_type", "exit_group"],
                        },
                        then: {
                          $cond: {
                            if: { $eq: ["$sender_id", userObjectId] },
                            then: "You left the group.",
                            else: {
                              $concat: [
                                "$sender_data.full_name",
                                " left the group",
                                ".",
                              ],
                            },
                          },
                        },
                      },
                    ],
                    default: { $ifNull: ["$message", null] },
                  },
                },
                else: { $ifNull: ["$message", null] },
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
            sender_data: "$$REMOVE",
            sender_id: 1,
            sender_profile_picture: 1,
            sender_name: 1,
            receiver_ids: 1,
            is_read_by: 1,
            poll: 1,
            location: 1,
            reply_message_id: {
              _id: 1,
              chat_room_id: 1,
              message: 1,
              poll: {
                _id: 1,
                question: 1,
              },
              sender_name: 1,
              location: 1,
              message_type: 1,
              message_time: 1,
              createdAt: 1,
              is_read: 1,
              is_pin: 1,
              is_edited: 1,
              is_forwarded: 1,
              is_delete_everyone: 1,
              is_delete_by: 1,
              media_file: 1,
              sender_id: 1,
              receiver_id: 1,
              replied_message_media: 1,
              createdAt: 1,
              updatedAt: 1,
            },
            group_data: "$$REMOVE",
            replied_message_media: 1,
            chat_reactions: 1,
            createdAt: 1,
            updatedAt: 1,
          },
        }
      );

      // const pipeline = [
      //   {
      //     $match: {
      //       chat_room_id: new mongoose.Types.ObjectId(chat_room_id),
      //       is_delete_by: { $ne: new mongoose.Types.ObjectId(user_id) },
      //       $or: [{ sender_id: userObjectId }, { receiver_ids: userObjectId }],
      //     },
      //   },
      //   {
      //     $sort: { createdAt: -1 },
      //   },
      //   {
      //     $skip: (parseInt(page) - 1) * parseInt(limit),
      //   },
      //   {
      //     $limit: parseInt(limit),
      //   },
      //   {
      //     $lookup: {
      //       from: "users",
      //       localField: "sender_id",
      //       foreignField: "_id",
      //       as: "sender_data",
      //     },
      //   },
      //   {
      //     $unwind: {
      //       path: "$sender_data",
      //       preserveNullAndEmptyArrays: true,
      //     },
      //   },
      //   {
      //     $lookup: {
      //       from: "chat_rooms",
      //       localField: "chat_room_id",
      //       foreignField: "_id",
      //       as: "group_data",
      //     },
      //   },
      //   {
      //     $unwind: {
      //       path: "$group_data",
      //       preserveNullAndEmptyArrays: true,
      //     },
      //   },
      //   {
      //     $lookup: {
      //       from: "chats", // Reference to `reply_message_id`
      //       localField: "reply_message_id",
      //       foreignField: "_id",
      //       as: "reply_message_id",
      //     },
      //   },
      //   {
      //     $unwind: {
      //       path: "$reply_message_id",
      //       preserveNullAndEmptyArrays: true,
      //     },
      //   },
      //   {
      //     $lookup: {
      //       from: "users",
      //       localField: "reply_message_id.sender_id",
      //       foreignField: "_id",
      //       as: "reply_message_id.sender_data",
      //     },
      //   },
      //   {
      //     $unwind: {
      //       path: "$reply_message_id.sender_data",
      //       preserveNullAndEmptyArrays: true,
      //     },
      //   },
      //   {
      //     $lookup: {
      //       from: "chat_reactions",
      //       localField: "_id",
      //       foreignField: "chat_id",
      //       as: "chat_reactions",
      //     },
      //   },
      //   {
      //     $lookup: {
      //       from: "users", // Adjust to your users collection
      //       localField: "poll.voters.user_id",
      //       foreignField: "_id",
      //       as: "voter_profiles",
      //     },
      //   },
      //   {
      //     $lookup: {
      //       from: "users",
      //       localField: "user_ids",
      //       foreignField: "_id",
      //       as: "user_ids",
      //       pipeline: [
      //         {
      //           $project: {
      //             _id: 1,
      //             full_name: 1,
      //           },
      //         },
      //       ],
      //     },
      //   },
      //   {
      //     $addFields: {
      //       "reply_message_id.sender_name":
      //         "$reply_message_id.sender_data.full_name",
      //     },
      //   },
      //   {
      //     $addFields: {
      //       emojiCounts: {
      //         $map: {
      //           input: {
      //             $reduce: {
      //               input: "$chat_reactions",
      //               initialValue: [],
      //               in: {
      //                 $cond: [
      //                   {
      //                     $in: ["$$this.emoji", "$$value.emoji"],
      //                   },
      //                   "$$value",
      //                   { $concatArrays: ["$$value", ["$$this"]] },
      //                 ],
      //               },
      //             },
      //           },
      //           as: "emoji",
      //           in: {
      //             emoji: "$$emoji.emoji",
      //             count: {
      //               $size: {
      //                 $filter: {
      //                   input: "$chat_reactions",
      //                   as: "reaction",
      //                   cond: { $eq: ["$$reaction.emoji", "$$emoji.emoji"] },
      //                 },
      //               },
      //             },
      //           },
      //         },
      //       },
      //       poll: {
      //         $cond: {
      //           if: { $eq: ["$message_type", "poll"] },
      //           then: {
      //             question: "$poll.question",
      //             poll_id: "$poll._id",
      //             options: {
      //               $map: {
      //                 input: "$poll.options",
      //                 as: "option",
      //                 in: {
      //                   _id: "$$option._id",
      //                   text: "$$option.text",
      //                   vote_count: {
      //                     $size: {
      //                       $filter: {
      //                         input: "$poll.voters",
      //                         as: "voter",
      //                         cond: {
      //                           $eq: ["$$voter.option_id", "$$option._id"],
      //                         },
      //                       },
      //                     },
      //                   },
      //                   voted_users: {
      //                     $map: {
      //                       input: {
      //                         $slice: [
      //                           {
      //                             $sortArray: {
      //                               input: {
      //                                 $filter: {
      //                                   input: "$poll.voters",
      //                                   as: "voter",
      //                                   cond: {
      //                                     $eq: [
      //                                       "$$voter.option_id",
      //                                       "$$option._id",
      //                                     ],
      //                                   },
      //                                 },
      //                               },
      //                               sortBy: { vote_time: -1 }, // Sort by vote_time descending
      //                             },
      //                           },
      //                           2, // Get the latest 2 voters
      //                         ],
      //                       },
      //                       as: "voter",
      //                       in: {
      //                         profile_picture: {
      //                           $let: {
      //                             vars: {
      //                               profile: {
      //                                 $arrayElemAt: [
      //                                   {
      //                                     $filter: {
      //                                       input: "$voter_profiles",
      //                                       as: "profile",
      //                                       cond: {
      //                                         $eq: [
      //                                           "$$profile._id",
      //                                           "$$voter.user_id",
      //                                         ],
      //                                       },
      //                                     },
      //                                   },
      //                                   0,
      //                                 ],
      //                               },
      //                             },
      //                             in: {
      //                               $cond: [
      //                                 {
      //                                   $ne: [
      //                                     "$$profile.profile_picture",
      //                                     null,
      //                                   ],
      //                                 },
      //                                 {
      //                                   $concat: [
      //                                     process.env.BASE_URL,
      //                                     "$$profile.profile_picture",
      //                                   ],
      //                                 },
      //                                 null,
      //                               ],
      //                             },
      //                           },
      //                         },
      //                         user_id: "$$voter.user_id",
      //                       },
      //                     },
      //                   },
      //                 },
      //               },
      //             },
      //             is_multiple: "$poll.is_multiple",
      //           },
      //           else: "$$REMOVE",
      //         },
      //       },
      //       is_read: {
      //         $cond: {
      //           if: {
      //             $eq: [{ $size: "$receiver_ids" }, { $size: "$is_read_by" }],
      //           },
      //           then: "seen",
      //           else: "sent",
      //         },
      //       },
      //     },
      //   },
      //   {
      //     $addFields: {
      //       // chat_reactions: {
      //       //   $map: {
      //       //     input: "$emojiCounts",
      //       //     as: "emojiObj",
      //       //     in: {
      //       //       emoji: "$$emojiObj.emoji",
      //       //       count: "$$emojiObj.count",
      //       //     },
      //       //   },
      //       // },
      //       media_file: {
      //         $map: {
      //           input: {
      //             $filter: {
      //               input: "$media_file",
      //               as: "media",
      //               cond: {
      //                 $and: [
      //                   { $eq: ["$$media.deleted_everyone", false] },
      //                   {
      //                     $not: {
      //                       $in: [userObjectId, "$$media.is_deleted_by"],
      //                     },
      //                   },
      //                 ],
      //               },
      //             },
      //           },
      //           as: "media",
      //           in: {
      //             $mergeObjects: [
      //               "$$media",
      //               {
      //                 file_name: {
      //                   $cond: [
      //                     { $ne: ["$$media.file_name", null] },
      //                     {
      //                       $concat: [
      //                         process.env.BASE_URL,
      //                         "$$media.file_name",
      //                       ],
      //                     },
      //                     "$$media.file_name",
      //                   ],
      //                 },
      //                 thumbnail: {
      //                   $cond: [
      //                     {
      //                       $and: [
      //                         { $eq: ["$$media.file_type", "video"] },
      //                         { $ne: ["$$media.thumbnail", null] },
      //                       ],
      //                     },
      //                     {
      //                       $concat: [
      //                         process.env.BASE_URL,
      //                         "$$media.thumbnail",
      //                       ],
      //                     },
      //                     "$$media.thumbnail",
      //                   ],
      //                 },
      //               },
      //             ],
      //           },
      //         },
      //       },
      //       replied_message_media: {
      //         $map: {
      //           input: "$replied_message_media",
      //           as: "media",
      //           in: {
      //             $mergeObjects: [
      //               "$$media",
      //               {
      //                 file_name: {
      //                   $cond: [
      //                     { $ne: ["$$media.file_name", null] },
      //                     {
      //                       $concat: [
      //                         process.env.BASE_URL,
      //                         "$$media.file_name",
      //                       ],
      //                     },
      //                     "$$media.file_name",
      //                   ],
      //                 },
      //                 thumbnail: {
      //                   $cond: [
      //                     {
      //                       $and: [
      //                         { $eq: ["$$media.file_type", "video"] },
      //                         { $ne: ["$$media.thumbnail", null] },
      //                       ],
      //                     },
      //                     {
      //                       $concat: [
      //                         process.env.BASE_URL,
      //                         "$$media.thumbnail",
      //                       ],
      //                     },
      //                     "$$media.thumbnail",
      //                   ],
      //                 },
      //               },
      //             ],
      //           },
      //         },
      //       },
      //       users: {
      //         $switch: {
      //           branches: [
      //             {
      //               case: { $eq: [{ $size: "$user_ids" }, 0] }, // No users
      //               then: "$$REMOVE",
      //             },
      //             {
      //               case: { $eq: [{ $size: "$user_ids" }, 1] }, // Only one user
      //               then: { $arrayElemAt: ["$user_ids.full_name", 0] },
      //             },
      //             {
      //               case: { $eq: [{ $size: "$user_ids" }, 2] }, // Two users
      //               then: {
      //                 $concat: [
      //                   { $arrayElemAt: ["$user_ids.full_name", 0] },
      //                   " and ",
      //                   { $arrayElemAt: ["$user_ids.full_name", 1] },
      //                 ],
      //               },
      //             },
      //             {
      //               case: { $gt: [{ $size: "$user_ids" }, 2] }, // More than two users
      //               then: {
      //                 $let: {
      //                   vars: {
      //                     allButLast: {
      //                       $slice: [
      //                         "$user_ids.full_name",
      //                         0,
      //                         { $subtract: [{ $size: "$user_ids" }, 1] },
      //                       ],
      //                     },
      //                     lastUser: {
      //                       $arrayElemAt: [
      //                         "$user_ids.full_name",
      //                         { $subtract: [{ $size: "$user_ids" }, 1] },
      //                       ],
      //                     },
      //                   },
      //                   in: {
      //                     $concat: [
      //                       {
      //                         $reduce: {
      //                           input: "$$allButLast",
      //                           initialValue: "",
      //                           in: {
      //                             $concat: [
      //                               "$$value",
      //                               {
      //                                 $cond: {
      //                                   if: { $eq: ["$$value", ""] },
      //                                   then: "",
      //                                   else: ", ",
      //                                 },
      //                               },
      //                               "$$this",
      //                             ],
      //                           },
      //                         },
      //                       },
      //                       " and ",
      //                       "$$lastUser",
      //                     ],
      //                   },
      //                 },
      //               },
      //             },
      //           ],
      //           default: "$$REMOVE",
      //         },
      //       },
      //       is_added: {
      //         $cond: [{ $in: [userObjectId, "$user_ids._id"] }, true, false],
      //       },
      //     },
      //   },
      //   {
      //     $addFields: {
      //       reply_message_id: {
      //         $cond: {
      //           if: {
      //             $or: [
      //               { $eq: [{ $type: "$reply_message_id._id" }, "missing"] },
      //               { $eq: ["$reply_message_id", null] },
      //               { $eq: ["$reply_message_id", {}] },
      //             ],
      //           },
      //           then: "$$REMOVE",
      //           else: "$reply_message_id",
      //         },
      //       },
      //       sender_profile_picture: {
      //         $cond: [
      //           {
      //             $and: [
      //               { $ne: ["$sender_data.profile_picture", null] },
      //               {
      //                 $not: [
      //                   {
      //                     $regexMatch: {
      //                       input: "$sender_data.profile_picture",
      //                       regex: `^${process.env.BASE_URL}`,
      //                     },
      //                   },
      //                 ],
      //               },
      //             ],
      //           },
      //           {
      //             $concat: [
      //               process.env.BASE_URL,
      //               "$sender_data.profile_picture",
      //             ],
      //           },
      //           "$sender_data.profile_picture",
      //         ],
      //       },
      //       sender_name: "$sender_data.full_name",
      //       message: {
      //         $cond: {
      //           if: {
      //             $in: [
      //               "$message_type",
      //               [
      //                 "create_group",
      //                 "add_member",
      //                 "make_admin",
      //                 "remove_admin",
      //                 "remove_member",
      //                 "exit_group",
      //               ],
      //             ],
      //           },
      //           then: {
      //             $switch: {
      //               branches: [
      //                 {
      //                   case: { $eq: ["$message_type", "create_group"] },
      //                   then: {
      //                     $cond: {
      //                       if: { $eq: ["$sender_id", userObjectId] },
      //                       then: "You created this group.",
      //                       else: {
      //                         $concat: [
      //                           "You have been added to the '",
      //                           "$group_data.group_name",
      //                           "' group created by ",
      //                           "$sender_data.full_name",
      //                           ".",
      //                         ],
      //                       },
      //                     },
      //                   },
      //                 },
      //                 {
      //                   case: { $eq: ["$message_type", "add_member"] },
      //                   then: {
      //                     $cond: {
      //                       if: { $eq: ["$is_added", true] },
      //                       then: {
      //                         $concat: [
      //                           "You were added to the group by ",
      //                           "$sender_data.full_name",
      //                           ".",
      //                         ],
      //                       },
      //                       else: {
      //                         $cond: {
      //                           if: { $eq: ["$sender_id", userObjectId] },
      //                           then: {
      //                             $concat: [
      //                               "You added ",
      //                               "$users",
      //                               " to the group.",
      //                             ],
      //                           },
      //                           else: {
      //                             $concat: [
      //                               "$sender_data.full_name",
      //                               " added ",
      //                               "$users",
      //                               " to the group.",
      //                             ],
      //                           },
      //                         },
      //                       },
      //                     },
      //                   },
      //                 },
      //                 {
      //                   case: { $eq: ["$message_type", "make_admin"] },
      //                   then: {
      //                     $concat: ["You're now an admin."],
      //                   },
      //                 },
      //                 {
      //                   case: { $eq: ["$message_type", "remove_admin"] },
      //                   then: {
      //                     $concat: ["You're no longer an admin."],
      //                   },
      //                 },
      //                 {
      //                   case: { $eq: ["$message_type", "remove_member"] },
      //                   then: {
      //                     $cond: {
      //                       if: { $eq: ["$is_added", true] },
      //                       then: {
      //                         $concat: [
      //                           "$sender_data.full_name",
      //                           " removed you",
      //                           ".",
      //                         ],
      //                       },
      //                       else: {
      //                         $cond: {
      //                           if: { $eq: ["$sender_id", userObjectId] },
      //                           then: {
      //                             $concat: ["You removed ", "$users", "."],
      //                           },
      //                           else: {
      //                             $concat: [
      //                               "$sender_data.full_name",
      //                               " removed ",
      //                               "$users",
      //                               ".",
      //                             ],
      //                           },
      //                         },
      //                       },
      //                     },
      //                   },
      //                 },
      //                 {
      //                   case: {
      //                     $eq: ["$message_type", "exit_group"],
      //                   },
      //                   then: {
      //                     $cond: {
      //                       if: { $eq: ["$sender_id", userObjectId] },
      //                       then: "You left the group.",
      //                       else: {
      //                         $concat: [
      //                           "$sender_data.full_name",
      //                           " left the group",
      //                           ".",
      //                         ],
      //                       },
      //                     },
      //                   },
      //                 },
      //               ],
      //               default: { $ifNull: ["$message", null] },
      //             },
      //           },
      //           else: { $ifNull: ["$message", null] },
      //         },
      //       },
      //       is_starred: {
      //         $cond: {
      //           if: { $in: [userObjectId, "$stared_by"] }, // Check if userObjectId is in stared_by
      //           then: true,
      //           else: false,
      //         },
      //       },
      //     },
      //   },
      //   {
      //     $project: {
      //       _id: 1,
      //       chat_room_id: 1,
      //       message: 1,
      //       message_type: 1,
      //       message_time: 1,
      //       createdAt: 1,
      //       is_read: 1,
      //       is_pin: 1,
      //       is_edited: 1,
      //       is_forwarded: 1,
      //       is_starred: 1,
      //       is_delete_everyone: 1,
      //       is_delete_by: 1,
      //       media_file: 1,
      //       sender_data: "$$REMOVE",
      //       sender_id: 1,
      //       sender_profile_picture: 1,
      //       sender_name: 1,
      //       receiver_ids: 1,
      //       is_read_by: 1,
      //       poll: 1,
      //       reply_message_id: {
      //         _id: 1,
      //         chat_room_id: 1,
      //         message: 1,
      //         poll: {
      //           _id: 1,
      //           question: 1,
      //         },
      //         sender_name: 1,
      //         message_type: 1,
      //         message_time: 1,
      //         createdAt: 1,
      //         is_read: 1,
      //         is_pin: 1,
      //         is_edited: 1,
      //         is_forwarded: 1,
      //         is_delete_everyone: 1,
      //         is_delete_by: 1,
      //         media_file: 1,
      //         sender_id: 1,
      //         receiver_id: 1,
      //         replied_message_media: 1,
      //         createdAt: 1,
      //         updatedAt: 1,
      //       },
      //       group_data: "$$REMOVE",
      //       replied_message_media: 1,
      //       chat_reactions: 1,
      //       createdAt: 1,
      //       updatedAt: 1,
      //     },
      //   },
      // ];

      const findAllMessage = await chat.aggregate(pipeline);

      let messages_count = await chat.countDocuments({
        chat_room_id: new mongoose.Types.ObjectId(chat_room_id),
        is_delete_by: { $ne: new mongoose.Types.ObjectId(user_id) },
        $or: [{ sender_id: userObjectId }, { receiver_ids: userObjectId }],
      });

      let find_last_pinned_message = [
        {
          $match: {
            chat_room_id: new mongoose.Types.ObjectId(chat_room_id),
            is_delete_everyone: false,
            is_delete_by: { $ne: new mongoose.Types.ObjectId(user_id) },
            $or: [{ sender_id: userObjectId }, { receiver_ids: userObjectId }],
            is_pin: true,
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
            is_read: {
              $cond: {
                if: {
                  $eq: [{ $size: "$receiver_ids" }, { $size: "$is_read_by" }],
                },
                then: "seen",
                else: "sent",
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
        chat_room_data: findGroup,
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

  addMemberToGroup: async (data) => {
    try {
      const { chat_room_id, member_ids, user_id } = data;

      const find_group = await chat_room.findOne({
        _id: chat_room_id,
        room_type: "group",
        is_deleted: false,
      });

      if (!find_group) {
        return socketErrorRes("Group not found");
      }

      if (!find_group.admin_ids.includes(user_id)) {
        return socketErrorRes("You are not admin of this group");
      }

      const is_already_member = find_group.member_ids.some((member) =>
        member_ids.includes(member.toString())
      );

      if (is_already_member) {
        return socketErrorRes("Member already added to the group");
      }

      const update_group = await chat_room.findOneAndUpdate(
        { _id: chat_room_id },
        {
          $addToSet: {
            member_ids: { $each: member_ids },
            all_member_ids: { $each: member_ids },
          }, // Prevents duplicates
        },
        { new: true }
      );

      const member_object_ids = member_ids.map((member_id) => {
        return new mongoose.Types.ObjectId(member_id);
      });

      let receiver_ids = find_group.member_ids.filter(
        (id) => String(id) !== String(user_id)
      );

      receiver_ids = [...receiver_ids, ...member_object_ids];

      let message_data = {
        chat_room_id: chat_room_id,
        sender_id: user_id,
        user_ids: member_ids,
        receiver_ids: receiver_ids,
        message_type: "add_member",
      };

      let active_members = await user_session.distinct("user_id", {
        user_id: { $in: receiver_ids }, // Filter by group members
        is_active: true,
        chat_room_id: new mongoose.Types.ObjectId(chat_room_id),
        is_deleted: false,
      });

      if (active_members.length > 0) {
        message_data = {
          ...message_data,
          is_read_by: active_members.map((user) => ({
            user_id: user,
            read_at: new Date(), // Store the current timestamp
          })),
        };
      }

      if (active_members.length == receiver_ids.length) {
        message_data = {
          ...message_data,
          is_read: "seen",
        };
      }

      const create_message = await chat.create(message_data);

      update_group.receiver_ids = receiver_ids;
      update_group.chat_id = create_message._id;

      return socketSuccessRes(
        "Member added to group successfully",
        update_group
      );
    } catch (error) {
      console.log("addMemberToGroup error", error);
      return socketErrRes("Something went wrong", error);
    }
  },

  removeMemberFromGroup: async (data) => {
    try {
      const { chat_room_id, member_id, user_id } = data;

      const find_group = await chat_room.findOne({
        _id: chat_room_id,
        room_type: "group",
        is_deleted: false,
      });

      if (!find_group) {
        return socketErrorRes("Group not found");
      }

      if (!find_group.admin_ids.includes(user_id)) {
        return socketErrorRes("You are not admin of this group");
      }

      const is_already_member = find_group.member_ids.includes(
        new mongoose.Types.ObjectId(member_id)
      );

      if (!is_already_member) {
        return socketErrorRes("You can't remove admin members from this group");
      }

      const update_group = await chat_room.findOneAndUpdate(
        { _id: chat_room_id },
        {
          $pull: { member_ids: member_id },
        },
        { new: true }
      );

      let receiver_ids = find_group.member_ids.filter(
        (id) => String(id) !== String(user_id)
      );

      let message_data = {
        chat_room_id: chat_room_id,
        sender_id: user_id,
        user_ids: [member_id],
        receiver_ids: receiver_ids,
        message_type: "remove_member",
      };

      let active_members = await user_session.distinct("user_id", {
        user_id: { $in: receiver_ids }, // Filter by group members
        is_active: true,
        chat_room_id: new mongoose.Types.ObjectId(chat_room_id),
        is_deleted: false,
      });

      if (active_members.length > 0) {
        message_data = {
          ...message_data,
          is_read_by: active_members.map((user) => ({
            user_id: user,
            read_at: new Date(), // Store the current timestamp
          })),
        };
      }

      if (active_members.length == receiver_ids.length) {
        message_data = {
          ...message_data,
          is_read: "seen",
        };
      }

      const create_message = await chat.create(message_data);

      update_group.receiver_ids = receiver_ids;
      update_group.chat_id = create_message._id;

      return socketSuccessRes(
        "Member added to group successfully",
        update_group
      );
    } catch (error) {
      console.log("addMemberToGroup error", error);
      return socketErrRes("Something went wrong", error);
    }
  },

  exitGroup: async (data, v1version) => {
    try {
      const { chat_room_id, user_id } = data;

      const find_group = await chat_room.findOne({
        _id: chat_room_id,
        room_type: "group",
        is_deleted: false,
      });

      if (!find_group) {
        return socketErrorRes("Group not found");
      }

      const is_already_member = find_group.member_ids.includes(
        new mongoose.Types.ObjectId(user_id)
      );

      if (!is_already_member) {
        return socketErrorRes("Member not found in group");
      }

      const update_group = await chat_room.findOneAndUpdate(
        { _id: chat_room_id },
        {
          $pull: { member_ids: user_id, admin_ids: user_id },
        },
        { new: true }
      );

      let receiver_ids = find_group.member_ids.filter(
        (id) => String(id) !== String(user_id)
      );

      let message_data = {
        chat_room_id: chat_room_id,
        sender_id: user_id,
        user_ids: [user_id],
        receiver_ids: receiver_ids,
        message_type: "exit_group",
        // is_delete_by: [user_id],
      };

      let active_members = await user_session.distinct("user_id", {
        user_id: { $in: receiver_ids }, // Filter by group members
        is_active: true,
        chat_room_id: new mongoose.Types.ObjectId(chat_room_id),
        is_deleted: false,
      });

      console.log({ active_members });

      if (active_members.length > 0) {
        message_data = {
          ...message_data,
          is_read_by: active_members.map((user) => ({
            user_id: user,
            read_at: new Date(), // Store the current timestamp
          })),
        };
      }

      if (active_members.length == receiver_ids.length) {
        message_data = {
          ...message_data,
          is_read: "seen",
        };
      }

      const create_message = await chat.create(message_data);

      if (update_group.admin_ids.length == 0) {
        let last_member = update_group.member_ids[0];

        const is_already_admin = update_group.admin_ids.includes(last_member);

        if (!is_already_admin) {
          await chat_room.findOneAndUpdate(
            { _id: chat_room_id },
            {
              $push: { admin_ids: last_member },
            },
            { new: true }
          );

          let admin_message_data = {
            chat_room_id: chat_room_id,
            sender_id: last_member,
            receiver_ids: [last_member],
            message_type: "make_admin",
          };
          const is_online_in_chat = active_members
            .map((id) => id.toString())
            .includes(last_member.toString());

          console.log({ is_online_in_chat });

          if (is_online_in_chat) {
            admin_message_data = {
              ...admin_message_data,
              is_read_by: [
                {
                  user_id: last_member,
                  read_at: new Date(), // Store the current timestamp
                },
              ],
              is_read: "seen",
            };
          }

          const create_message = await chat.create(admin_message_data);

          let admin_data = {
            user_id: last_member.toString(),
            chat_room_id: chat_room_id,
          };

          let chat_for_admin = await getChatData({
            chat_id: create_message._id,
            user_id: last_member.toString(),
          });

          let get_admin_room_data = await getChatRoomData(admin_data);

          if (get_admin_room_data.success) {
            v1version
              .to(admin_data.user_id.toString())
              .emit("updateChatRoom", get_admin_room_data);
          }

          if (chat_for_admin.success) {
            v1version
              .to(admin_data.user_id.toString())
              .emit("makeGroupAdmin", chat_for_admin);
          }
        }
      }

      // const create_message = await chat.create({
      //   chat_room_id: chat_room_id,
      //   sender_id: user_id,
      //   user_ids: [user_id],
      //   receiver_ids: receiver_ids,
      //   message_type: "exit_group",
      //   is_delete_by: [user_id],
      // });

      update_group.receiver_ids = receiver_ids;
      update_group.chat_id = create_message._id;

      return socketSuccessRes("Succesfully left the group", update_group);
    } catch (error) {
      console.log("exitGroup error", error);
      return socketErrRes("Something went wrong", error);
    }
  },

  makeGroupAdmin: async (data) => {
    try {
      const { chat_room_id, member_id, user_id } = data;

      const find_group = await chat_room.findOne({
        _id: chat_room_id,
        is_deleted: false,
      });

      if (!find_group) {
        return socketErrorRes("Group not found");
      }

      if (!find_group.admin_ids.includes(user_id)) {
        return socketErrorRes("You are not admin of this group");
      }

      if (find_group.admin_ids.includes(member_id)) {
        return socketErrorRes("This member is already admin");
      }

      let update_group = await chat_room.findOneAndUpdate(
        { _id: chat_room_id },
        {
          $push: { admin_ids: member_id },
        },
        { new: true }
      );

      let receiver_ids = [member_id];

      let message_data = {
        chat_room_id: chat_room_id,
        sender_id: member_id,
        receiver_ids: [member_id],
        message_type: "make_admin",
      };

      let active_members = await user_session.distinct("user_id", {
        user_id: { $in: receiver_ids }, // Filter by group members
        is_active: true,
        chat_room_id: new mongoose.Types.ObjectId(chat_room_id),
        is_deleted: false,
      });

      if (active_members.length > 0) {
        message_data = {
          ...message_data,
          is_read_by: active_members.map((user) => ({
            user_id: user,
            read_at: new Date(), // Store the current timestamp
          })),
        };
      }

      if (active_members.length == receiver_ids.length) {
        message_data = {
          ...message_data,
          is_read: "seen",
        };
      }

      const create_message = await chat.create(message_data);

      update_group.chat_id = create_message._id;

      return socketSuccessRes("Admin created successfully", update_group);
    } catch (error) {
      console.log("addMemberToGroup error", error.message);
      return socketErrRes("Something went wrong", error);
    }
  },

  dismissFromAdmin: async (data) => {
    try {
      const { chat_room_id, admin_id, user_id } = data;

      const find_group = await chat_room.findOne({
        _id: chat_room_id,
        is_deleted: false,
      });

      if (!find_group) {
        return socketErrorRes("Group not found");
      }

      if (!find_group.admin_ids.includes(user_id)) {
        return socketErrorRes("Only Admins can dismiss other admin");
      }

      // if (find_group.created_by != user_id) {
      //   return socketErrorRes("Only group owner can dismiss admin") ;
      // }

      if (!find_group.admin_ids.includes(admin_id)) {
        return socketErrorRes("Member is not admin of this group.");
      }

      let update_group = await chat_room.findOneAndUpdate(
        { _id: chat_room_id },
        {
          $pull: { admin_ids: admin_id },
        },
        { new: true }
      );

      let receiver_ids = [admin_id];

      let message_data = {
        chat_room_id: chat_room_id,
        sender_id: admin_id,
        receiver_ids: [admin_id],
        message_type: "remove_admin",
      };

      let active_members = await user_session.distinct("user_id", {
        user_id: { $in: receiver_ids }, // Filter by group members
        is_active: true,
        chat_room_id: new mongoose.Types.ObjectId(chat_room_id),
        is_deleted: false,
      });

      if (active_members.length > 0) {
        message_data = {
          ...message_data,
          is_read_by: active_members.map((user) => ({
            user_id: user,
            read_at: new Date(), // Store the current timestamp
          })),
        };
      }

      if (active_members.length == receiver_ids.length) {
        message_data = {
          ...message_data,
          is_read: "seen",
        };
      }

      const create_message = await chat.create(message_data);

      update_group.chat_id = create_message._id;

      return socketSuccessRes("Admin dismissed successfully", update_group);
    } catch (error) {
      console.log("dismissFromAdmin error", error.message);
      return socketErrRes("Something went wrong", error);
    }
  },
};
