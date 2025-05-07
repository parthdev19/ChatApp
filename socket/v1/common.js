/// COMMON SOCKET EVENTS THAT USED IN BOTH PERSONAL CHAT AND GROUP CHAT

const chat_room = require("./../../api/models/M_chat_room");
const chat = require("./../../api/models/M_chat");
const users = require("./../../api/models/M_user");
const user_session = require("./../../api/models/M_user_session");
const chat_reaction = require("./../../api/models/M_chat_reaction");

const mongoose = require("mongoose");

const { decryptMessage } = require("../../utils/secure_pwd");

const {
  notificationSend,
  // notiSendMultipleDevice,
  notiSendMultipleDevice
} = require("../../utils/notification_send");

const path = require("path");
const fs = require("fs").promises;

const {
  socketErrorRes,
  socketErrRes,
  socketSuccessRes,
  socketMultiSuccessRes,
  successRes,
} = require("../../utils/common_fun");

const getChatData = async (data) => {
  try {
    let { chat_id, user_id } = data;

    let userObjectId = new mongoose.Types.ObjectId(user_id);

    const pipeline = [
      {
        $match: {
          _id: new mongoose.Types.ObjectId(chat_id),
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
          "reply_message_id.sender_name":
            "$reply_message_id.sender_data.full_name",
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
                      then: "You're now an admin.",
                    },
                    {
                      case: { $eq: ["$message_type", "remove_admin"] },
                      then: "You're no longer an admin.",
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
          chat_reactions: [],
          is_starred: false,
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
          reply_message_id: 1,
          chat_reactions: 1,
          is_starred: 1,
          group_data: "$$REMOVE",
          replied_message_media: 1,
          chat_reactions: 1,
          createdAt: 1,
          updatedAt: 1,
          user_ids: 1,
        },
      },
    ];

    const [getMessage] = await chat.aggregate(pipeline);

    return socketSuccessRes("chat data get successfully", getMessage);
  } catch (error) {
    console.log(error);
    return socketErrorRes("Error in getChatData", error);
  }
}

module.exports = {
  chatUserList: async (data) => {
    try {
      let { user_id, search = "", page, limit, room_type, filter } = data;

      let userObjectId = new mongoose.Types.ObjectId(user_id);

      let match_condition = {
        $or: [
          { user_id: userObjectId },
          { other_user_id: userObjectId },
          // { member_ids: userObjectId },
          { all_member_ids: userObjectId },
        ],
        archived_by: { $ne: new mongoose.Types.ObjectId(user_id) },
        is_delete_by: { $ne: new mongoose.Types.ObjectId(user_id) },
        is_deleted: false,
      };

      if (room_type) {
        if (room_type == "group" || room_type == "personal") {
          match_condition = {
            ...match_condition,
            room_type: room_type,
          };
        }
      }

      if (filter) {
        if (filter == "favorites") {
          match_condition = {
            ...match_condition,
            favorites_by: { $eq: new mongoose.Types.ObjectId(user_id) },
          };
        }
        if (filter == "archived") {
          match_condition = {
            ...match_condition,
            archived_by: { $eq: new mongoose.Types.ObjectId(user_id) },
          };
        }
      }

      const pipeline = [
        {
          $match: match_condition,
        },
        {
          $lookup: {
            from: "chats",
            localField: "_id",
            foreignField: "chat_room_id",
            as: "chat_data",
          },
        },
        {
          $match: {
            $expr: { $gt: [{ $size: "$chat_data" }, 0] }, // Ensures chat_data has at least one message
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
          $match: search
            ? {
              "other_user_data.full_name": { $regex: search, $options: "i" },
            }
            : {},
        },
        // {
        //   $lookup: {
        //     from: "chats",
        //     let: { roomId: "$_id" },
        //     pipeline: [
        //       {
        //         $match: {
        //           $expr: {
        //             $and: [
        //               { $eq: ["$chat_room_id", "$$roomId"] },
        //               { $not: { $in: [userObjectId, "$is_delete_by"] } },
        //             ],
        //           },
        //         },
        //       },
        //       { $sort: { createdAt: -1 } },
        //       { $limit: 1 },
        //     ],
        //     as: "last_message",
        //   },
        // },
        {
          $lookup: {
            from: "chats",
            let: {
              roomId: "$_id",
              userId: new mongoose.Types.ObjectId(user_id),
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$chat_room_id", "$$roomId"] },
                      { $not: { $in: [userObjectId, "$is_delete_by"] } },
                      // { $eq: ["$is_delete_everyone", false] },
                      {
                        $or: [
                          { $eq: ["$sender_id", "$$userId"] },
                          { $eq: ["$receiver_id", "$$userId"] },
                          { $in: ["$$userId", "$receiver_ids"] },
                        ],
                      },
                      { $ne: ["$is_delete_by", "$$userId"] },
                    ],
                  },
                },
              },
              { $sort: { createdAt: -1 } },
              { $limit: 1 },
            ],
            as: "last_message",
          },
        },
        {
          $unwind: {
            path: "$last_message",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: "chats",
            let: { roomId: "$_id", userId: userObjectId },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$chat_room_id", "$$roomId"] },
                      { $eq: ["$receiver_id", "$$userId"] },
                      { $ne: ["$is_read", "seen"] },
                      { $eq: ["$is_delete_everyone", false] },
                      { $not: { $in: [userObjectId, "$is_delete_by"] } },
                    ],
                  },
                },
              },
              { $count: "unread_count" },
            ],
            as: "unread_messages_personal",
          },
        },
        {
          $lookup: {
            from: "chats",
            let: { roomId: "$_id", userId: userObjectId },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$chat_room_id", "$$roomId"] },
                      { $in: [userObjectId, "$receiver_ids"] },
                      // { $not: { $in: ["$$userId", "$is_read_by"] } },
                      {
                        $not: {
                          $in: [
                            "$$userId",
                            {
                              $map: {
                                input: "$is_read_by",
                                as: "readUser",
                                in: "$$readUser.user_id",
                              },
                            },
                          ],
                        },
                      },
                      { $eq: ["$is_delete_everyone", false] },
                      { $not: { $in: ["$$userId", "$is_delete_by"] } },
                    ],
                  },
                },
              },
              { $count: "unread_count" },
            ],
            as: "unread_messages_group",
          },
        },
        {
          $addFields: {
            unread_count: {
              $cond: {
                if: { $eq: ["$room_type", "personal"] },
                then: {
                  $ifNull: [
                    {
                      $arrayElemAt: [
                        "$unread_messages_personal.unread_count",
                        0,
                      ],
                    },
                    0,
                  ],
                },
                else: {
                  $ifNull: [
                    {
                      $arrayElemAt: ["$unread_messages_group.unread_count", 0],
                    },
                    0,
                  ],
                },
              },
            },
          },
        },
        // {
        //   $match:
        //     filter && filter === "unread" ? { unread_count: { $gt: 0 } } : {},
        // },
        {
          $match: {
            $or: [
              filter && filter === "unread" ? { unread_count: { $gt: 0 } } : {},
              { unread_by: { $in: [new mongoose.Types.ObjectId(user_id)] } }, // Check if userId exists in unread_by array
            ],
          },
        },
        {
          $addFields: {
            is_pinned: {
              $cond: {
                if: {
                  $gt: [
                    {
                      $size: {
                        $filter: {
                          input: "$pinned_by",
                          as: "pinned",
                          cond: { $eq: ["$$pinned.user_id", userObjectId] },
                        },
                      },
                    },
                    0,
                  ],
                },
                then: true,
                else: false,
              },
            },
            // last_pinned_at: {
            //   $max: {
            //     $map: {
            //       input: {
            //         $filter: {
            //           input: "$pinned_by",
            //           as: "pinned",
            //           cond: { $eq: ["$$pinned.user_id", userObjectId] },
            //         },
            //       },
            //       as: "pinned",
            //       in: "$$pinned.pinned_at",
            //     },
            //   },
            // }
          },
        },
        {
          $sort: {
            "pinned_by.pinned_at": -1,
            // last_pinned_at: -1,
            "last_message.message_time": -1,
          },
        },
      ];

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
            from: "user_sessions",
            let: { userId: "$other_user_data._id" },
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
            localField: "last_message.sender_id",
            foreignField: "_id",
            as: "sender",
          },
        },
        {
          $unwind: {
            path: "$sender",
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
            from: "users",
            localField: "last_message.user_ids",
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
            receiver_data: {
              $filter: {
                input: "$group_members",
                as: "group_member",
                cond: {
                  $eq: ["$$group_member", new mongoose.Types.ObjectId(user_id)],
                },
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
            is_member: {
              $cond: {
                if: { $eq: ["$room_type", "group"] }, // Check if room_type is "group"
                then: { $in: [userObjectId, "$member_ids"] }, // Check if user is in member_ids
                else: false, // If not a group, set is_member to false
              },
            },
          },
        },
        {
          $addFields: {
            user_id: "$other_user_data._id",
            is_deleted: "$other_user_data.is_deleted",
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
            profile_picture: {
              $cond: {
                if: { $ifNull: ["$other_user_data.profile_picture", false] },
                then: {
                  $concat: [
                    process.env.BASE_URL,
                    "$other_user_data.profile_picture",
                  ],
                },
                else: null,
              },
            },
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
            is_mute: {
              $cond: [{ $in: [userObjectId, "$muted_by"] }, true, false],
            },
            is_favorite: {
              $cond: [{ $in: [userObjectId, "$favorites_by"] }, true, false],
            },
            is_archived: {
              $cond: [{ $in: [userObjectId, "$archived_by"] }, true, false],
            },
            is_unread: {
              $cond: [{ $in: [userObjectId, "$unread_by"] }, true, false],
            },
            is_online: { $gt: [{ $size: "$online_status" }, 0] },
            full_name: "$other_user_data.full_name",
            //working till 29/01/25 kpnode
            //last_msg: { $ifNull: ["$last_message.message", null] },
            // last_msg: {
            //   $switch: {
            //     branches: [
            //       {
            //         case: {
            //           $eq: ["$last_message.message_type", "create_group"],
            //         },
            //         then: {
            //           $cond: {
            //             if: { $eq: ["$last_message.sender_id", userObjectId] },
            //             then: "You created this group.",
            //             else: {
            //               $concat: [
            //                 "You have been added to the '",
            //                 "$group_name",
            //                 "' group created by ",
            //                 "$sender.full_name",
            //                 ".",
            //               ],
            //             },
            //           },
            //         },
            //       },
            //     ],
            //     default: { $ifNull: ["$last_message.message", null] },
            //   },
            // },

            last_msg: {
              $cond: {
                if: {
                  $in: [
                    "$last_message.message_type",
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
                        case: {
                          $eq: ["$last_message.message_type", "create_group"],
                        },
                        then: {
                          $cond: {
                            if: {
                              $eq: ["$last_message.sender_id", userObjectId],
                            },
                            then: "You created this group.",
                            else: {
                              $concat: [
                                "You have been added to the '",
                                "$group_name",
                                "' group created by ",
                                "$sender.full_name",
                                ".",
                              ],
                            },
                          },
                        },
                      },
                      {
                        case: {
                          $eq: ["$last_message.message_type", "add_member"],
                        },
                        then: {
                          $cond: {
                            if: { $eq: ["$is_added", true] },
                            then: {
                              $concat: [
                                "You were added to the group by ",
                                "$sender.full_name",
                                ".",
                              ],
                            },
                            else: {
                              $cond: {
                                if: {
                                  $eq: [
                                    "$last_message.sender_id",
                                    userObjectId,
                                  ],
                                },
                                then: {
                                  $concat: [
                                    "You added ",
                                    "$users",
                                    " to the group.",
                                  ],
                                },
                                else: {
                                  $concat: [
                                    "$sender.full_name",
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
                        case: {
                          $eq: ["$last_message.message_type", "make_admin"],
                        },
                        then: "You're now an admin.",
                      },
                      {
                        case: {
                          $eq: ["$last_message.message_type", "remove_admin"],
                        },
                        then: "You're no longer an admin.",
                      },
                      {
                        case: {
                          $eq: ["$last_message.message_type", "remove_member"],
                        },
                        then: {
                          $cond: {
                            if: { $eq: ["$is_added", true] },
                            then: {
                              $concat: [
                                "$sender.full_name",
                                " removed you",
                                ".",
                              ],
                            },
                            else: {
                              $cond: {
                                if: {
                                  $eq: [
                                    "$last_message.sender_id",
                                    userObjectId,
                                  ],
                                },
                                then: {
                                  $concat: ["You removed ", "$users", "."],
                                },
                                else: {
                                  $concat: [
                                    "$sender.full_name",
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
                          $eq: ["$last_message.message_type", "exit_group"],
                        },
                        then: {
                          $cond: {
                            if: {
                              $eq: ["$last_message.sender_id", userObjectId],
                            },
                            then: "You left the group.",
                            else: {
                              $concat: [
                                "$sender.full_name",
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
                else: { $ifNull: ["$last_message.message", null] },
              },
            },
            last_msg_time: { $ifNull: ["$last_message.message_time", null] },
            last_msg_type: { $ifNull: ["$last_message.message_type", null] },
            last_msg_sender_id: { $ifNull: ["$last_message.sender_id", null] },
            last_msg_sender_name: { $ifNull: ["$sender.full_name", null] },
            last_msg_status: { $ifNull: ["$last_message.is_read", null] },
            last_msg_delete_everyone: "$last_message.is_delete_everyone",
            poll_question: {
              $cond: {
                if: { $eq: ["$last_message.message_type", "poll"] },
                then: "$last_message.poll.question",
                else: "$$REMOVE",
              },
            },
          },
        },
        {
          $project: {
            _id: 1,
            room_type: 1,
            is_mute: 1,
            is_favorite: 1,
            is_archived: 1,
            is_pinned: 1,
            is_unread: 1,
            group_name: 1,
            group_image: 1,
            user_id: 1,
            is_deleted: 1,
            chat_wallpaper: 1,
            is_global: 1,
            unread_count: 1,
            profile_picture: 1,
            is_online: 1,
            is_member: 1,
            full_name: 1,
            last_msg: 1,
            last_msg_sender_name: 1,
            last_msg_time: 1,
            last_msg_sender_id: 1,
            last_msg_type: 1,
            last_msg_status: 1,
            last_msg_delete_everyone: 1,
            poll_question: 1,
            createdAt: 1,
          },
        }
      );

      let room_list = await chat_room.aggregate(pipeline);

      // let room_list = await chat_room.aggregate([
      //   {
      //     $match: match_condition,
      //   },
      //   {
      //     $lookup: {
      //       from: "chats",
      //       localField: "_id",
      //       foreignField: "chat_room_id",
      //       as: "chat_data",
      //     },
      //   },
      //   {
      //     $match: {
      //       $expr: { $gt: [{ $size: "$chat_data" }, 0] }, // Ensures chat_data has at least one message
      //     },
      //   },
      //   {
      //     $addFields: {
      //       other_user: {
      //         $cond: {
      //           if: { $eq: ["$user_id", userObjectId] },
      //           then: "$other_user_id",
      //           else: "$user_id",
      //         },
      //       },
      //       current_user: userObjectId,
      //     },
      //   },
      //   {
      //     $lookup: {
      //       from: "users",
      //       localField: "other_user",
      //       foreignField: "_id",
      //       as: "other_user_data",
      //     },
      //   },
      //   {
      //     $unwind: {
      //       path: "$other_user_data",
      //       preserveNullAndEmptyArrays: true,
      //     },
      //   },
      //   {
      //     $match: search
      //       ? {
      //           "other_user_data.full_name": { $regex: search, $options: "i" },
      //         }
      //       : {},
      //   },
      //   {
      //     $lookup: {
      //       from: "chats",
      //       let: { roomId: "$_id" },
      //       pipeline: [
      //         {
      //           $match: {
      //             $expr: {
      //               $and: [
      //                 { $eq: ["$chat_room_id", "$$roomId"] },
      //                 { $not: { $in: [userObjectId, "$is_delete_by"] } },
      //               ],
      //             },
      //           },
      //         },
      //         { $sort: { createdAt: -1 } },
      //         { $limit: 1 },
      //       ],
      //       as: "last_message",
      //     },
      //   },
      //   {
      //     $unwind: {
      //       path: "$last_message",
      //       preserveNullAndEmptyArrays: true,
      //     },
      //   },
      //   {
      //     $lookup: {
      //       from: "chats",
      //       let: { roomId: "$_id", userId: userObjectId },
      //       pipeline: [
      //         {
      //           $match: {
      //             $expr: {
      //               $and: [
      //                 { $eq: ["$chat_room_id", "$$roomId"] },
      //                 { $eq: ["$receiver_id", "$$userId"] },
      //                 { $ne: ["$is_read", "seen"] },
      //                 { $eq: ["$is_delete_everyone", false] },
      //                 { $not: { $in: [userObjectId, "$is_delete_by"] } },
      //               ],
      //             },
      //           },
      //         },
      //         { $count: "unread_count" },
      //       ],
      //       as: "unread_messages_personal",
      //     },
      //   },
      //   {
      //     $lookup: {
      //       from: "chats",
      //       let: { roomId: "$_id", userId: userObjectId },
      //       pipeline: [
      //         {
      //           $match: {
      //             $expr: {
      //               $and: [
      //                 { $eq: ["$chat_room_id", "$$roomId"] },
      //                 { $in: [userObjectId, "$receiver_ids"] },
      //                 // { $not: { $in: ["$$userId", "$is_read_by"] } },
      //                 {
      //                   $not: {
      //                     $in: [
      //                       "$$userId",
      //                       {
      //                         $map: {
      //                           input: "$is_read_by",
      //                           as: "readUser",
      //                           in: "$$readUser.user_id",
      //                         },
      //                       },
      //                     ],
      //                   },
      //                 },
      //                 { $eq: ["$is_delete_everyone", false] },
      //                 { $not: { $in: ["$$userId", "$is_delete_by"] } },
      //               ],
      //             },
      //           },
      //         },
      //         { $count: "unread_count" },
      //       ],
      //       as: "unread_messages_group",
      //     },
      //   },
      //   {
      //     $addFields: {
      //       unread_count: {
      //         $cond: {
      //           if: { $eq: ["$room_type", "personal"] },
      //           then: {
      //             $ifNull: [
      //               {
      //                 $arrayElemAt: [
      //                   "$unread_messages_personal.unread_count",
      //                   0,
      //                 ],
      //               },
      //               0,
      //             ],
      //           },
      //           else: {
      //             $ifNull: [
      //               {
      //                 $arrayElemAt: ["$unread_messages_group.unread_count", 0],
      //               },
      //               0,
      //             ],
      //           },
      //         },
      //       },
      //     },
      //   },
      //   // {
      //   //   $match:
      //   //     filter && filter === "unread" ? { unread_count: { $gt: 0 } } : {},
      //   // },
      //   {
      //     $match: {
      //       $or: [
      //         filter && filter === "unread" ? { unread_count: { $gt: 0 } } : {},
      //         { unread_by: { $in: [new mongoose.Types.ObjectId(user_id)] } }, // Check if userId exists in unread_by array
      //       ],
      //     },
      //   },
      //   {
      //     $addFields: {
      //       is_pinned: {
      //         $cond: {
      //           if: {
      //             $gt: [
      //               {
      //                 $size: {
      //                   $filter: {
      //                     input: "$pinned_by",
      //                     as: "pinned",
      //                     cond: { $eq: ["$$pinned.user_id", userObjectId] },
      //                   },
      //                 },
      //               },
      //               0,
      //             ],
      //           },
      //           then: true,
      //           else: false,
      //         },
      //       },
      //       // last_pinned_at: {
      //       //   $max: {
      //       //     $map: {
      //       //       input: {
      //       //         $filter: {
      //       //           input: "$pinned_by",
      //       //           as: "pinned",
      //       //           cond: { $eq: ["$$pinned.user_id", userObjectId] },
      //       //         },
      //       //       },
      //       //       as: "pinned",
      //       //       in: "$$pinned.pinned_at",
      //       //     },
      //       //   },
      //       // }
      //     },
      //   },
      //   {
      //     $sort: {
      //       "pinned_by.pinned_at": -1,
      //       // last_pinned_at: -1,
      //       "last_message.message_time": -1,
      //     },
      //   },
      //   {
      //     $skip: (parseInt(page) - 1) * parseInt(limit),
      //   },
      //   {
      //     $limit: parseInt(limit),
      //   },
      //   {
      //     $lookup: {
      //       from: "user_sessions",
      //       let: { userId: "$other_user_data._id" },
      //       pipeline: [
      //         {
      //           $match: {
      //             $expr: {
      //               $and: [
      //                 { $eq: ["$user_id", "$$userId"] },
      //                 { $ne: ["$socket_id", null] },
      //                 { $eq: ["$is_active", true] },
      //                 { $eq: ["$is_deleted", false] },
      //               ],
      //             },
      //           },
      //         },
      //         { $limit: 1 },
      //       ],
      //       as: "online_status",
      //     },
      //   },
      //   {
      //     $lookup: {
      //       from: "users",
      //       localField: "member_ids",
      //       foreignField: "_id",
      //       as: "group_members",
      //     },
      //   },
      //   {
      //     $lookup: {
      //       from: "users",
      //       localField: "last_message.sender_id",
      //       foreignField: "_id",
      //       as: "sender",
      //     },
      //   },
      //   {
      //     $unwind: {
      //       path: "$sender",
      //       preserveNullAndEmptyArrays: true,
      //     },
      //   },
      //   {
      //     $lookup: {
      //       from: "users",
      //       localField: "current_user",
      //       foreignField: "_id",
      //       as: "current_user_id",
      //     },
      //   },
      //   {
      //     $unwind: {
      //       path: "$current_user_id",
      //       preserveNullAndEmptyArrays: true,
      //     },
      //   },
      //   {
      //     $lookup: {
      //       from: "users",
      //       localField: "last_message.user_ids",
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
      //       receiver_data: {
      //         $filter: {
      //           input: "$group_members",
      //           as: "group_member",
      //           cond: {
      //             $eq: ["$$group_member", new mongoose.Types.ObjectId(user_id)],
      //           },
      //         },
      //       },
      //       theme: {
      //         $filter: {
      //           input: "$themes",
      //           as: "theme",
      //           cond: {
      //             $eq: [
      //               "$$theme.user_id",
      //               new mongoose.Types.ObjectId(user_id),
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
      //       is_member: {
      //         $cond: {
      //           if: { $eq: ["$room_type", "group"] }, // Check if room_type is "group"
      //           then: { $in: [userObjectId, "$member_ids"] }, // Check if user is in member_ids
      //           else: false, // If not a group, set is_member to false
      //         },
      //       },
      //     },
      //   },
      //   {
      //     $addFields: {
      //       user_id: "$other_user_data._id",
      //       is_deleted: "$other_user_data.is_deleted",
      //       chat_wallpaper: {
      //         $let: {
      //           vars: {
      //             themeSize: { $size: "$theme" },
      //             themeWallpaper: {
      //               $arrayElemAt: ["$theme.chat_wallpaper", 0],
      //             },
      //           },
      //           in: {
      //             $cond: {
      //               if: { $eq: ["$$themeSize", 1] },
      //               then: {
      //                 $cond: {
      //                   if: { $ifNull: ["$$themeWallpaper", false] },
      //                   then: {
      //                     $concat: [process.env.BASE_URL, "$$themeWallpaper"],
      //                   },
      //                   else: null,
      //                 },
      //               },
      //               else: {
      //                 $cond: {
      //                   if: {
      //                     $ifNull: ["$current_user_id.chat_wallpaper", false],
      //                   },
      //                   then: {
      //                     $concat: [
      //                       process.env.BASE_URL,
      //                       "$current_user_id.chat_wallpaper",
      //                     ],
      //                   },
      //                   else: null,
      //                 },
      //               },
      //             },
      //           },
      //         },
      //       },
      //       is_global: { $eq: [{ $size: "$theme" }, 0] },
      //       profile_picture: {
      //         $cond: {
      //           if: { $ifNull: ["$other_user_data.profile_picture", false] },
      //           then: {
      //             $concat: [
      //               process.env.BASE_URL,
      //               "$other_user_data.profile_picture",
      //             ],
      //           },
      //           else: null,
      //         },
      //       },
      //       group_image: {
      //         $cond: {
      //           if: {
      //             $and: [
      //               { $eq: ["$room_type", "group"] }, // Check if room_type is "group"
      //               { $ifNull: ["$group_image", false] }, // Check if group_image exists
      //             ],
      //           },
      //           then: { $concat: [process.env.BASE_URL, "$group_image"] },
      //           else: null,
      //         },
      //       },
      //       is_mute: {
      //         $cond: [{ $in: [userObjectId, "$muted_by"] }, true, false],
      //       },
      //       is_favorite: {
      //         $cond: [{ $in: [userObjectId, "$favorites_by"] }, true, false],
      //       },
      //       is_archived: {
      //         $cond: [{ $in: [userObjectId, "$archived_by"] }, true, false],
      //       },
      //       is_unread: {
      //         $cond: [{ $in: [userObjectId, "$unread_by"] }, true, false],
      //       },
      //       is_online: { $gt: [{ $size: "$online_status" }, 0] },
      //       full_name: "$other_user_data.full_name",
      //       //working till 29/01/25 kpnode
      //       //last_msg: { $ifNull: ["$last_message.message", null] },
      //       // last_msg: {
      //       //   $switch: {
      //       //     branches: [
      //       //       {
      //       //         case: {
      //       //           $eq: ["$last_message.message_type", "create_group"],
      //       //         },
      //       //         then: {
      //       //           $cond: {
      //       //             if: { $eq: ["$last_message.sender_id", userObjectId] },
      //       //             then: "You created this group.",
      //       //             else: {
      //       //               $concat: [
      //       //                 "You have been added to the '",
      //       //                 "$group_name",
      //       //                 "' group created by ",
      //       //                 "$sender.full_name",
      //       //                 ".",
      //       //               ],
      //       //             },
      //       //           },
      //       //         },
      //       //       },
      //       //     ],
      //       //     default: { $ifNull: ["$last_message.message", null] },
      //       //   },
      //       // },

      //       last_msg: {
      //         $cond: {
      //           if: {
      //             $in: [
      //               "$last_message.message_type",
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
      //                   case: {
      //                     $eq: ["$last_message.message_type", "create_group"],
      //                   },
      //                   then: {
      //                     $cond: {
      //                       if: {
      //                         $eq: ["$last_message.sender_id", userObjectId],
      //                       },
      //                       then: "You created this group.",
      //                       else: {
      //                         $concat: [
      //                           "You have been added to the '",
      //                           "$group_name",
      //                           "' group created by ",
      //                           "$sender.full_name",
      //                           ".",
      //                         ],
      //                       },
      //                     },
      //                   },
      //                 },
      //                 {
      //                   case: {
      //                     $eq: ["$last_message.message_type", "add_member"],
      //                   },
      //                   then: {
      //                     $cond: {
      //                       if: { $eq: ["$is_added", true] },
      //                       then: {
      //                         $concat: [
      //                           "You were added to the group by ",
      //                           "$sender.full_name",
      //                           ".",
      //                         ],
      //                       },
      //                       else: {
      //                         $cond: {
      //                           if: {
      //                             $eq: [
      //                               "$last_message.sender_id",
      //                               userObjectId,
      //                             ],
      //                           },
      //                           then: {
      //                             $concat: [
      //                               "You added ",
      //                               "$users",
      //                               " to the group.",
      //                             ],
      //                           },
      //                           else: {
      //                             $concat: [
      //                               "$sender.full_name",
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
      //                   case: {
      //                     $eq: ["$last_message.message_type", "make_admin"],
      //                   },
      //                   then: "You're now an admin.",
      //                 },
      //                 {
      //                   case: {
      //                     $eq: ["$last_message.message_type", "remove_admin"],
      //                   },
      //                   then: "You're no longer an admin.",
      //                 },
      //                 {
      //                   case: {
      //                     $eq: ["$last_message.message_type", "remove_member"],
      //                   },
      //                   then: {
      //                     $cond: {
      //                       if: { $eq: ["$is_added", true] },
      //                       then: {
      //                         $concat: [
      //                           "$sender.full_name",
      //                           " removed you",
      //                           ".",
      //                         ],
      //                       },
      //                       else: {
      //                         $cond: {
      //                           if: {
      //                             $eq: [
      //                               "$last_message.sender_id",
      //                               userObjectId,
      //                             ],
      //                           },
      //                           then: {
      //                             $concat: ["You removed ", "$users", "."],
      //                           },
      //                           else: {
      //                             $concat: [
      //                               "$sender.full_name",
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
      //                     $eq: ["$last_message.message_type", "exit_group"],
      //                   },
      //                   then: {
      //                     $cond: {
      //                       if: {
      //                         $eq: ["$last_message.sender_id", userObjectId],
      //                       },
      //                       then: "You left the group.",
      //                       else: {
      //                         $concat: [
      //                           "$sender.full_name",
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
      //           else: { $ifNull: ["$last_message.message", null] },
      //         },
      //       },
      //       last_msg_time: { $ifNull: ["$last_message.message_time", null] },
      //       last_msg_type: { $ifNull: ["$last_message.message_type", null] },
      //       last_msg_sender_id: { $ifNull: ["$last_message.sender_id", null] },
      //       last_msg_sender_name: { $ifNull: ["$sender.full_name", null] },
      //       last_msg_status: { $ifNull: ["$last_message.is_read", null] },
      //       last_msg_delete_everyone: "$last_message.is_delete_everyone",
      //       poll_question: {
      //         $cond: {
      //           if: { $eq: ["$last_message.message_type", "poll"] },
      //           then: "$last_message.poll.question",
      //           else: "$$REMOVE",
      //         },
      //       },
      //     },
      //   },
      //   {
      //     $project: {
      //       _id: 1,
      //       room_type: 1,
      //       is_mute: 1,
      //       is_favorite: 1,
      //       is_archived: 1,
      //       is_pinned: 1,
      //       is_unread: 1,
      //       group_name: 1,
      //       group_image: 1,
      //       user_id: 1,
      //       is_deleted: 1,
      //       chat_wallpaper: 1,
      //       is_global: 1,
      //       unread_count: 1,
      //       profile_picture: 1,
      //       is_online: 1,
      //       is_member: 1,
      //       full_name: 1,
      //       last_msg: 1,
      //       last_msg_sender_name: 1,
      //       last_msg_time: 1,
      //       last_msg_sender_id: 1,
      //       last_msg_type: 1,
      //       last_msg_status: 1,
      //       last_msg_delete_everyone: 1,
      //       poll_question: 1,
      //       createdAt: 1,
      //     },
      //   },
      // ]);

      let room_list_count = await chat_room.aggregate([
        {
          $match: match_condition,
        },
        {
          $lookup: {
            from: "chats",
            localField: "_id",
            foreignField: "chat_room_id",
            as: "chat_data",
          },
        },
        {
          $match: {
            $expr: { $gt: [{ $size: "$chat_data" }, 0] }, // Ensures chat_data has at least one message
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
          $match: search
            ? {
              "other_user_data.full_name": { $regex: search, $options: "i" },
            }
            : {},
        },
        {
          $lookup: {
            from: "chats",
            let: { roomId: "$_id", userId: userObjectId },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$chat_room_id", "$$roomId"] },
                      { $eq: ["$receiver_id", "$$userId"] },
                      { $ne: ["$is_read", "seen"] },
                      { $eq: ["$is_delete_everyone", false] },
                      { $not: { $in: [userObjectId, "$is_delete_by"] } },
                    ],
                  },
                },
              },
              { $count: "unread_count" },
            ],
            as: "unread_messages_personal",
          },
        },
        {
          $lookup: {
            from: "chats",
            let: { roomId: "$_id", userId: userObjectId },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$chat_room_id", "$$roomId"] },
                      { $in: [userObjectId, "$receiver_ids"] },
                      // { $not: { $in: ["$$userId", "$is_read_by"] } },
                      {
                        $not: {
                          $in: [
                            "$$userId",
                            {
                              $map: {
                                input: "$is_read_by",
                                as: "readUser",
                                in: "$$readUser.user_id",
                              },
                            },
                          ],
                        },
                      },
                      { $eq: ["$is_delete_everyone", false] },
                      { $not: { $in: ["$$userId", "$is_delete_by"] } },
                    ],
                  },
                },
              },
              { $count: "unread_count" },
            ],
            as: "unread_messages_group",
          },
        },
        {
          $addFields: {
            unread_count: {
              $cond: {
                if: { $eq: ["$room_type", "personal"] },
                then: {
                  $ifNull: [
                    {
                      $arrayElemAt: [
                        "$unread_messages_personal.unread_count",
                        0,
                      ],
                    },
                    0,
                  ],
                },
                else: {
                  $ifNull: [
                    {
                      $arrayElemAt: ["$unread_messages_group.unread_count", 0],
                    },
                    0,
                  ],
                },
              },
            },
          },
        },
        // {
        //   $match:
        //     filter && filter === "unread" ? { unread_count: { $gt: 0 } } : {},
        // },
        {
          $match: {
            $or: [
              filter && filter === "unread" ? { unread_count: { $gt: 0 } } : {},
              { unread_by: { $in: [new mongoose.Types.ObjectId(user_id)] } }, // Check if userId exists in unread_by array
            ],
          },
        },
        {
          $project: {
            _id: 1,
          },
        },
      ]);

      let total_pinned_chat_condition = {
        room_type: "personal",
        $or: [{ user_id: userObjectId }, { other_user_id: userObjectId }],
        is_delete_by: { $not: { $in: [userObjectId] } }, // Ensure user is not in delete list
        is_deleted: false,
        "pinned_by.user_id": userObjectId, // Check inside the array of objects
      };

      if (filter == "favorites") {
        total_pinned_chat_condition = {
          ...total_pinned_chat_condition,
          favorites_by: { $eq: new mongoose.Types.ObjectId(user_id) },
        };
      }
      if (filter == "archived") {
        total_pinned_chat_condition = {
          ...total_pinned_chat_condition,
          archived_by: { $eq: new mongoose.Types.ObjectId(user_id) },
        };
      }

      // let total_pinned_chats = await chat_room.countDocuments(total_pinned_chat_condition);

      let pinned_unread_chats = await chat_room.aggregate([
        {
          $match: total_pinned_chat_condition,
        },
        {
          $lookup: {
            from: "chats",
            localField: "_id",
            foreignField: "chat_room_id",
            as: "chat_data",
          },
        },
        {
          $match: {
            $expr: { $gt: [{ $size: "$chat_data" }, 0] }, // Ensures chat_data has at least one message
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
            from: "chats",
            let: { roomId: "$_id", userId: userObjectId },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$chat_room_id", "$$roomId"] },
                      { $eq: ["$receiver_id", "$$userId"] },
                      { $ne: ["$is_read", "seen"] },
                      { $eq: ["$is_delete_everyone", false] },
                      { $not: { $in: [userObjectId, "$is_delete_by"] } },
                    ],
                  },
                },
              },
              { $count: "unread_count" },
            ],
            as: "unread_messages_personal",
          },
        },
        {
          $lookup: {
            from: "chats",
            let: { roomId: "$_id", userId: userObjectId },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$chat_room_id", "$$roomId"] },
                      { $in: [userObjectId, "$receiver_ids"] },
                      // { $not: { $in: ["$$userId", "$is_read_by"] } },
                      {
                        $not: {
                          $in: [
                            "$$userId",
                            {
                              $map: {
                                input: "$is_read_by",
                                as: "readUser",
                                in: "$$readUser.user_id",
                              },
                            },
                          ],
                        },
                      },
                      { $eq: ["$is_delete_everyone", false] },
                      { $not: { $in: ["$$userId", "$is_delete_by"] } },
                    ],
                  },
                },
              },
              { $count: "unread_count" },
            ],
            as: "unread_messages_group",
          },
        },
        {
          $addFields: {
            unread_count: {
              $cond: {
                if: { $eq: ["$room_type", "personal"] },
                then: {
                  $ifNull: [
                    {
                      $arrayElemAt: [
                        "$unread_messages_personal.unread_count",
                        0,
                      ],
                    },
                    0,
                  ],
                },
                else: {
                  $ifNull: [
                    {
                      $arrayElemAt: ["$unread_messages_group.unread_count", 0],
                    },
                    0,
                  ],
                },
              },
            },
          },
        },
        {
          $match:
            filter && filter === "unread" ? { unread_count: { $gt: 0 } } : {},
        },
        {
          $project: {
            _id: 1,
          },
        },
      ]);

      let total_pinned_chats = pinned_unread_chats.length;
      // { $eq: ["$chat_room_id", "$$roomId"] },
      // { $eq: ["$receiver_id", "$$userId"] },
      // { $ne: ["$is_read", "seen"] },
      // { $eq: ["$is_delete_everyone", false] },
      // { $not: { $in: [userObjectId, "$is_delete_by"] } },

      const unreadArchivedChatCounts = await chat.aggregate([
        {
          $lookup: {
            from: "chat_rooms",
            let: { chatRoomId: "$chat_room_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$_id", "$$chatRoomId"] },
                      {
                        $or: [
                          { $eq: ["$user_id", userObjectId] },
                          { $eq: ["$other_user_id", userObjectId] },
                          { $in: [userObjectId, "$member_ids"] },
                        ],
                      },
                      { $not: { $in: [userObjectId, "$is_delete_by"] } },
                      { $eq: ["$is_deleted", false] },
                    ],
                  },
                },
              },
            ],
            as: "chat_room",
          },
        },
        { $unwind: "$chat_room" },
        {
          $match: {
            "chat_room.archived_by": { $in: [userObjectId] }, // Check if user archived the chat
            is_read: "sent",
            is_delete_everyone: false,
            $expr: { $not: { $in: [userObjectId, "$is_delete_by"] } },
          },
        },
        {
          $group: {
            _id: "$chat_room._id", // Group by chat_room ID
          },
        },
        {
          $project: {
            _id: 1,
          },
        },
      ]);

      console.log({ unreadArchivedChatCounts });

      return socketMultiSuccessRes(
        "Chat user list fetched successfully",
        room_list_count.length,
        room_list,
        {
          total_pinned_chats,
          room_type,
          unread_archived_chat_count: unreadArchivedChatCounts.length,
        }
      );
    } catch (error) {
      console.log(error);
      return socketErrorRes("Error in chatUserList", error);
    }
  },

  searchAlldata: async (data) => {
    try {
      let {
        user_id,
        search = "",
        // page = 1,
        // limit = 10,
      } = data;

      if (search == "" || search == undefined) {
        return socketErrorRes("search is required");
      }

      let userObjectId = new mongoose.Types.ObjectId(user_id);

      let match_condition = {
        $or: [
          { user_id: userObjectId },
          { other_user_id: userObjectId },
          // { member_ids: userObjectId },
          { all_member_ids: userObjectId },
        ],
        archived_by: { $ne: new mongoose.Types.ObjectId(user_id) },
        is_delete_by: { $ne: new mongoose.Types.ObjectId(user_id) },
        is_deleted: false,
      };

      let room_list = await chat_room.aggregate([
        {
          $match: match_condition,
        },
        {
          $lookup: {
            from: "chats",
            localField: "_id",
            foreignField: "chat_room_id",
            as: "chat_data",
          },
        },
        {
          $match: {
            $expr: { $gt: [{ $size: "$chat_data" }, 0] }, // Ensures chat_data has at least one message
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
          $addFields: {
            lower_full_name: {
              $toLower: "$other_user_data.full_name",
            },
            lower_group_name: {
              $toLower: "$group_name",
            },
          },
        },
        {
          $match: search
            ? {
              $or: [
                {
                  lower_full_name: {
                    $regex: search,
                    $options: "i",
                  },
                },
                { lower_group_name: { $regex: search, $options: "i" } },
              ],
            }
            : {},
        },
        // {
        //   $lookup: {
        //     from: "chats",
        //     let: { roomId: "$_id" },
        //     pipeline: [
        //       {
        //         $match: {
        //           $expr: {
        //             $and: [
        //               { $eq: ["$chat_room_id", "$$roomId"] },
        //               { $not: { $in: [userObjectId, "$is_delete_by"] } },
        //             ],
        //           },
        //         },
        //       },
        //       { $sort: { createdAt: -1 } },
        //       { $limit: 1 },
        //     ],
        //     as: "last_message",
        //   },
        // },
        {
          $lookup: {
            from: "chats",
            let: {
              roomId: "$_id",
              userId: new mongoose.Types.ObjectId(user_id),
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$chat_room_id", "$$roomId"] },
                      { $not: { $in: [userObjectId, "$is_delete_by"] } },
                      { $eq: ["$is_delete_everyone", false] },
                      {
                        $or: [
                          { $eq: ["$sender_id", "$$userId"] },
                          { $eq: ["$receiver_id", "$$userId"] },
                          { $in: ["$$userId", "$receiver_ids"] },
                        ],
                      },
                      { $ne: ["$is_delete_by", "$$userId"] },
                    ],
                  },
                },
              },
              { $sort: { createdAt: -1 } },
              { $limit: 1 },
            ],
            as: "last_message",
          },
        },
        {
          $unwind: {
            path: "$last_message",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: "chats",
            let: { roomId: "$_id", userId: userObjectId },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$chat_room_id", "$$roomId"] },
                      { $eq: ["$receiver_id", "$$userId"] },
                      { $ne: ["$is_read", "seen"] },
                      { $eq: ["$is_delete_everyone", false] },
                      { $not: { $in: [userObjectId, "$is_delete_by"] } },
                    ],
                  },
                },
              },
              { $count: "unread_count" },
            ],
            as: "unread_messages_personal",
          },
        },
        {
          $lookup: {
            from: "chats",
            let: { roomId: "$_id", userId: userObjectId },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$chat_room_id", "$$roomId"] },
                      { $in: [userObjectId, "$receiver_ids"] },
                      // { $not: { $in: ["$$userId", "$is_read_by"] } },
                      {
                        $not: {
                          $in: [
                            "$$userId",
                            {
                              $map: {
                                input: "$is_read_by",
                                as: "readUser",
                                in: "$$readUser.user_id",
                              },
                            },
                          ],
                        },
                      },
                      { $eq: ["$is_delete_everyone", false] },
                      { $not: { $in: ["$$userId", "$is_delete_by"] } },
                    ],
                  },
                },
              },
              { $count: "unread_count" },
            ],
            as: "unread_messages_group",
          },
        },
        {
          $addFields: {
            unread_count: {
              $cond: {
                if: { $eq: ["$room_type", "personal"] },
                then: {
                  $ifNull: [
                    {
                      $arrayElemAt: [
                        "$unread_messages_personal.unread_count",
                        0,
                      ],
                    },
                    0,
                  ],
                },
                else: {
                  $ifNull: [
                    {
                      $arrayElemAt: ["$unread_messages_group.unread_count", 0],
                    },
                    0,
                  ],
                },
              },
            },
          },
        },
        // {
        //   $match:
        //     filter && filter === "unread" ? { unread_count: { $gt: 0 } } : {},
        // },
        {
          $addFields: {
            is_pinned: {
              $cond: {
                if: {
                  $gt: [
                    {
                      $size: {
                        $filter: {
                          input: "$pinned_by",
                          as: "pinned",
                          cond: { $eq: ["$$pinned.user_id", userObjectId] },
                        },
                      },
                    },
                    0,
                  ],
                },
                then: true,
                else: false,
              },
            },
            // last_pinned_at: {
            //   $max: {
            //     $map: {
            //       input: {
            //         $filter: {
            //           input: "$pinned_by",
            //           as: "pinned",
            //           cond: { $eq: ["$$pinned.user_id", userObjectId] },
            //         },
            //       },
            //       as: "pinned",
            //       in: "$$pinned.pinned_at",
            //     },
            //   },
            // }
          },
        },
        {
          $sort: {
            "pinned_by.pinned_at": -1,
            // last_pinned_at: -1,
            "last_message.message_time": -1,
          },
        },
        {
          $lookup: {
            from: "user_sessions",
            let: { userId: "$other_user_data._id" },
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
            localField: "last_message.sender_id",
            foreignField: "_id",
            as: "sender",
          },
        },
        {
          $unwind: {
            path: "$sender",
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
            from: "users",
            localField: "last_message.user_ids",
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
            receiver_data: {
              $filter: {
                input: "$group_members",
                as: "group_member",
                cond: {
                  $eq: ["$$group_member", new mongoose.Types.ObjectId(user_id)],
                },
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
          },
        },
        {
          $addFields: {
            user_id: "$other_user_data._id",
            is_deleted: "$other_user_data.is_deleted",
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
            profile_picture: {
              $cond: {
                if: { $ifNull: ["$other_user_data.profile_picture", false] },
                then: {
                  $concat: [
                    process.env.BASE_URL,
                    "$other_user_data.profile_picture",
                  ],
                },
                else: null,
              },
            },
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
            is_mute: {
              $cond: [{ $in: [userObjectId, "$muted_by"] }, true, false],
            },
            is_favorite: {
              $cond: [{ $in: [userObjectId, "$favorites_by"] }, true, false],
            },
            is_archived: {
              $cond: [{ $in: [userObjectId, "$archived_by"] }, true, false],
            },
            is_unread: {
              $cond: [{ $in: [userObjectId, "$unread_by"] }, true, false],
            },
            is_online: { $gt: [{ $size: "$online_status" }, 0] },
            full_name: "$other_user_data.full_name",
            //working till 29/01/25 kpnode
            //last_msg: { $ifNull: ["$last_message.message", null] },
            // last_msg: {
            //   $switch: {
            //     branches: [
            //       {
            //         case: {
            //           $eq: ["$last_message.message_type", "create_group"],
            //         },
            //         then: {
            //           $cond: {
            //             if: { $eq: ["$last_message.sender_id", userObjectId] },
            //             then: "You created this group.",
            //             else: {
            //               $concat: [
            //                 "You have been added to the '",
            //                 "$group_name",
            //                 "' group created by ",
            //                 "$sender.full_name",
            //                 ".",
            //               ],
            //             },
            //           },
            //         },
            //       },
            //     ],
            //     default: { $ifNull: ["$last_message.message", null] },
            //   },
            // },

            last_msg: {
              $cond: {
                if: {
                  $in: [
                    "$last_message.message_type",
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
                        case: {
                          $eq: ["$last_message.message_type", "create_group"],
                        },
                        then: {
                          $cond: {
                            if: {
                              $eq: ["$last_message.sender_id", userObjectId],
                            },
                            then: "You created this group.",
                            else: {
                              $concat: [
                                "You have been added to the '",
                                "$group_name",
                                "' group created by ",
                                "$sender.full_name",
                                ".",
                              ],
                            },
                          },
                        },
                      },
                      {
                        case: {
                          $eq: ["$last_message.message_type", "add_member"],
                        },
                        then: {
                          $cond: {
                            if: { $eq: ["$is_added", true] },
                            then: {
                              $concat: [
                                "You were added to the group by ",
                                "$sender.full_name",
                                ".",
                              ],
                            },
                            else: {
                              $cond: {
                                if: {
                                  $eq: [
                                    "$last_message.sender_id",
                                    userObjectId,
                                  ],
                                },
                                then: {
                                  $concat: [
                                    "You added ",
                                    "$users",
                                    " to the group.",
                                  ],
                                },
                                else: {
                                  $concat: [
                                    "$sender.full_name",
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
                        case: {
                          $eq: ["$last_message.message_type", "make_admin"],
                        },
                        then: "You're now an admin.",
                      },
                      {
                        case: {
                          $eq: ["$last_message.message_type", "remove_admin"],
                        },
                        then: "You're no longer an admin.",
                      },
                      {
                        case: {
                          $eq: ["$last_message.message_type", "remove_member"],
                        },
                        then: {
                          $cond: {
                            if: { $eq: ["$is_added", true] },
                            then: {
                              $concat: [
                                "$sender.full_name",
                                " removed you",
                                ".",
                              ],
                            },
                            else: {
                              $cond: {
                                if: {
                                  $eq: [
                                    "$last_message.sender_id",
                                    userObjectId,
                                  ],
                                },
                                then: {
                                  $concat: ["You removed ", "$users", "."],
                                },
                                else: {
                                  $concat: [
                                    "$sender.full_name",
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
                          $eq: ["$last_message.message_type", "exit_group"],
                        },
                        then: {
                          $cond: {
                            if: {
                              $eq: ["$last_message.sender_id", userObjectId],
                            },
                            then: "You left the group.",
                            else: {
                              $concat: [
                                "$sender.full_name",
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
                else: { $ifNull: ["$last_message.message", null] },
              },
            },
            last_msg_time: { $ifNull: ["$last_message.message_time", null] },
            last_msg_type: { $ifNull: ["$last_message.message_type", null] },
            last_msg_sender_id: { $ifNull: ["$last_message.sender_id", null] },
            last_msg_sender_name: { $ifNull: ["$sender.full_name", null] },
            last_msg_status: { $ifNull: ["$last_message.is_read", null] },
            last_msg_delete_everyone: "$last_message.is_delete_everyone",
            poll_question: {
              $cond: {
                if: { $eq: ["$last_message.message_type", "poll"] },
                then: "$last_message.poll.question",
                else: "$$REMOVE",
              },
            },
          },
        },
        {
          $project: {
            _id: 1,
            room_type: 1,
            is_mute: 1,
            is_favorite: 1,
            is_archived: 1,
            is_pinned: 1,
            is_unread: 1,
            group_name: 1,
            group_image: 1,
            user_id: 1,
            is_deleted: 1,
            chat_wallpaper: 1,
            is_global: 1,
            unread_count: 1,
            profile_picture: 1,
            is_online: 1,
            full_name: 1,
            last_msg: 1,
            last_msg_sender_name: 1,
            last_msg_time: 1,
            last_msg_sender_id: 1,
            last_msg_type: 1,
            last_msg_status: 1,
            last_msg_delete_everyone: 1,
            poll_question: 1,
            createdAt: 1,
          },
        },
      ]);

      let searched_chats = room_list.map((data) => {
        return data.user_id;
      });

      let other_user_list = await users.aggregate([
        {
          $match: {
            _id: {
              $nin: searched_chats,
            },
            // message_type: "text",
            is_deleted: false,
          },
        },
        {
          $addFields: {
            lower_full_name: {
              $toLower: "$full_name",
            },
          },
        },
        {
          $match: search
            ? {
              lower_full_name: { $regex: search, $options: "i" },
            }
            : {},
        },
        {
          $sort: {
            lower_full_name: 1,
          },
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
      ]);

      const Messages = await chat.aggregate([
        {
          $match: {
            is_delete_everyone: false,
            is_delete_by: { $ne: new mongoose.Types.ObjectId(user_id) },
            $or: [
              { sender_id: userObjectId },
              { receiver_id: userObjectId },
              { receiver_ids: userObjectId },
            ],
            message_type: { $ne: "clear_chat" },
          },
        },
        {
          $addFields: {
            lower_message: {
              $toLower: "$message",
            },
            mediafile: { $arrayElemAt: ["$media_file", 0] },
          },
        },
        {
          $addFields: {
            lower_media_file: { $toLower: "$mediafile.original_name" },
          },
        },
        // {
        //   $match: search
        //     ? {
        //       lower_message: { $regex: search, $options: "i" },

        //       }
        //     : {},
        // },
        {
          $match: search
            ? {
              $or: [
                { lower_message: { $regex: search, $options: "i" } },
                {
                  $and: [
                    {
                      "media_file.file_type": {
                        $in: [
                          "audio",
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
                        ],
                      },
                    },
                    { lower_media_file: { $regex: search, $options: "i" } },
                  ],
                },
              ],
            }
            : {},
        },
        {
          $sort: { createdAt: -1 },
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
            localField: "sender_id",
            foreignField: "_id",
            as: "sender",
          },
        },
        {
          $unwind: {
            path: "$sender",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "receiver_id",
            foreignField: "_id",
            as: "receiver",
          },
        },
        {
          $unwind: {
            path: "$receiver",
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
          $lookup: {
            from: "chat_rooms", // Reference to `reply_message_id`
            localField: "chat_room_id",
            foreignField: "_id",
            as: "chat_room_data",
          },
        },
        {
          $unwind: {
            path: "$chat_room_data",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $addFields: {
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
            sender_profile_picture: {
              $cond: {
                if: { $ifNull: ["$sender.profile_picture", false] },
                then: {
                  $concat: [process.env.BASE_URL, "$sender.profile_picture"],
                },
                else: "$sender.profile_picture",
              },
            },
            sender_name: "$sender.full_name",
            receiver_name: "$receiver.full_name",
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
            chat_room_type: "$chat_room_data.room_type",
            group_name: "$chat_room_data.group_name",
            group_image: {
              $cond: {
                if: {
                  $and: [
                    { $eq: ["$chat_room_data.room_type", "group"] }, // Check if room_type is "group"
                    { $ifNull: ["$chat_room_data.group_image", false] }, // Check if group_image exists
                  ],
                },
                then: {
                  $concat: [
                    process.env.BASE_URL,
                    "$chat_room_data.group_image",
                  ],
                },
                else: null,
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
            sender_id: 1,
            sender_profile_picture: 1,
            sender_name: 1,
            receiver_name: 1,
            receiver_id: 1,
            chat_room_type: 1,
            group_name: 1,
            group_image: 1,
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
            replied_message_media: 1,
            lower_media_file: 1,
            chat_reactions: 1,
            createdAt: 1,
            updatedAt: 1,
          },
        },
      ]);

      let res_data = {
        chat_room_list: room_list,
        other_user_list: other_user_list,
        messages: Messages,
      };

      return socketSuccessRes("chat data get successfully", res_data);
    } catch (error) {
      console.log(error);
      return socketErrorRes("Error in getChatRoomData", error);
    }
  },

  getChatRoomData: async (data) => {
    try {
      let { chat_room_id, user_id } = data;

      let userObjectId = new mongoose.Types.ObjectId(user_id);
      let chatRoomObjectId = new mongoose.Types.ObjectId(chat_room_id);

      let [chatRoomDetails] = await chat_room.aggregate([
        {
          $match: {
            _id: chatRoomObjectId,
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
        // {
        //   $lookup: {
        //     from: "chats",
        //     let: { roomId: "$_id" },
        //     pipeline: [
        //       {
        //         $match: {
        //           $expr: {
        //             $and: [
        //               { $eq: ["$chat_room_id", "$$roomId"] },
        //               { $not: { $in: [userObjectId, "$is_delete_by"] } },
        //             ],
        //           },
        //         },
        //       },
        //       { $sort: { createdAt: -1 } },
        //       { $limit: 1 },
        //     ],
        //     as: "last_message",
        //   },
        // },
        {
          $lookup: {
            from: "chats",
            let: {
              roomId: "$_id",
              userId: new mongoose.Types.ObjectId(user_id),
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$chat_room_id", "$$roomId"] },
                      { $not: { $in: [userObjectId, "$is_delete_by"] } },
                      // { $eq: ["$is_delete_everyone", false] },
                      {
                        $or: [
                          { $eq: ["$sender_id", "$$userId"] },
                          { $eq: ["$receiver_id", "$$userId"] },
                          { $in: ["$$userId", "$receiver_ids"] },
                        ],
                      },
                      { $ne: ["$is_delete_by", "$$userId"] },
                    ],
                  },
                },
              },
              { $sort: { createdAt: -1 } },
              { $limit: 1 },
            ],
            as: "last_message",
          },
        },
        {
          $unwind: {
            path: "$last_message",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $sort: {
            "last_message.message_time": -1,
          },
        },
        {
          $lookup: {
            from: "chats",
            let: { roomId: "$_id", userId: userObjectId },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$chat_room_id", "$$roomId"] },
                      { $eq: ["$receiver_id", "$$userId"] },
                      { $ne: ["$is_read", "seen"] },
                      { $eq: ["$is_delete_everyone", false] },
                      { $not: { $in: [userObjectId, "$is_delete_by"] } },
                    ],
                  },
                },
              },
              { $count: "unread_count" },
            ],
            as: "unread_messages_personal",
          },
        },
        {
          $lookup: {
            from: "chats",
            let: { roomId: "$_id", userId: userObjectId },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$chat_room_id", "$$roomId"] },
                      { $in: [userObjectId, "$receiver_ids"] },
                      // { $not: { $in: ["$$userId", "$is_read_by"] } },
                      {
                        $not: {
                          $in: [
                            "$$userId",
                            {
                              $map: {
                                input: "$is_read_by",
                                as: "readUser",
                                in: "$$readUser.user_id",
                              },
                            },
                          ],
                        },
                      },
                      { $eq: ["$is_delete_everyone", false] },
                      { $not: { $in: ["$$userId", "$is_delete_by"] } },
                    ],
                  },
                },
              },
              { $count: "unread_count" },
            ],
            as: "unread_messages_group",
          },
        },
        {
          $lookup: {
            from: "user_sessions",
            let: { userId: "$other_user_data._id" },
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
            from: "users",
            localField: "member_ids",
            foreignField: "_id",
            as: "group_members",
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "last_message.sender_id",
            foreignField: "_id",
            as: "sender",
          },
        },
        {
          $unwind: {
            path: "$sender",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "last_message.user_ids",
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
            receiver_data: {
              $filter: {
                input: "$group_members",
                as: "group_member",
                cond: {
                  $eq: ["$$group_member", new mongoose.Types.ObjectId(user_id)],
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
            is_pinned: {
              $cond: {
                if: {
                  $gt: [
                    {
                      $size: {
                        $filter: {
                          input: "$pinned_by",
                          as: "pinned",
                          cond: { $eq: ["$$pinned.user_id", userObjectId] },
                        },
                      },
                    },
                    0,
                  ],
                },
                then: true,
                else: false,
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
            // "last_message.message": {
            //   $function: {
            //     body: function (encryptedMessage) {
            //       return decryptMessage(encryptedMessage); // Call your function
            //     },
            //     args: ["$last_message.message"], // Pass the encrypted message
            //     lang: "js",
            //   },
            // },
          },
        },
        {
          $addFields: {
            user_id: "$other_user_data._id",
            profile_picture: {
              $cond: {
                if: { $ifNull: ["$other_user_data.profile_picture", false] },
                then: {
                  $concat: [
                    process.env.BASE_URL,
                    "$other_user_data.profile_picture",
                  ],
                },
                else: null,
              },
            },
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
            unread_count: {
              $cond: {
                if: { $eq: ["$room_type", "personal"] },
                then: {
                  $ifNull: [
                    {
                      $arrayElemAt: [
                        "$unread_messages_personal.unread_count",
                        0,
                      ],
                    },
                    0,
                  ],
                },
                else: {
                  $ifNull: [
                    {
                      $arrayElemAt: ["$unread_messages_group.unread_count", 0],
                    },
                    0,
                  ],
                },
              },
            },
            is_mute: {
              $cond: [{ $in: [userObjectId, "$muted_by"] }, true, false],
            },
            is_favorite: {
              $cond: [{ $in: [userObjectId, "$favorites_by"] }, true, false],
            },
            is_archived: {
              $cond: [{ $in: [userObjectId, "$archived_by"] }, true, false],
            },
            is_unread: {
              $cond: [{ $in: [userObjectId, "$unread_by"] }, true, false],
            },
            is_online: { $gt: [{ $size: "$online_status" }, 0] },
            full_name: "$other_user_data.full_name",
            //working till 29/01/25 kpnode
            //last_msg: { $ifNull: ["$last_message.message", null] },
            last_msg: {
              $cond: {
                if: {
                  $in: [
                    "$last_message.message_type",
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
                        case: {
                          $eq: ["$last_message.message_type", "create_group"],
                        },
                        then: {
                          $cond: {
                            if: {
                              $eq: ["$last_message.sender_id", userObjectId],
                            },
                            then: "You created this group.",
                            else: {
                              $concat: [
                                "You have been added to the '",
                                "$group_name",
                                "' group created by ",
                                "$sender.full_name",
                                ".",
                              ],
                            },
                          },
                        },
                      },
                      {
                        case: {
                          $eq: ["$last_message.message_type", "add_member"],
                        },
                        then: {
                          $cond: {
                            if: { $eq: ["$is_added", true] },
                            then: {
                              $concat: [
                                "You were added to the group by ",
                                "$sender.full_name",
                                ".",
                              ],
                            },
                            else: {
                              $cond: {
                                if: {
                                  $eq: [
                                    "$last_message.sender_id",
                                    userObjectId,
                                  ],
                                },
                                then: {
                                  $concat: [
                                    "You added ",
                                    "$users",
                                    " to the group.",
                                  ],
                                },
                                else: {
                                  $concat: [
                                    "$sender.full_name",
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
                        case: {
                          $eq: ["$last_message.message_type", "make_admin"],
                        },
                        then: "You're now an admin.",
                      },
                      {
                        case: {
                          $eq: ["$last_message.message_type", "remove_admin"],
                        },
                        then: "You're no longer an admin.",
                      },
                      {
                        case: {
                          $eq: ["$last_message.message_type", "remove_member"],
                        },
                        then: {
                          $cond: {
                            if: { $eq: ["$is_added", true] },
                            then: {
                              $concat: [
                                "$sender.full_name",
                                " removed you",
                                ".",
                              ],
                            },
                            else: {
                              $cond: {
                                if: {
                                  $eq: [
                                    "$last_message.sender_id",
                                    userObjectId,
                                  ],
                                },
                                then: {
                                  $concat: ["You removed ", "$users", "."],
                                },
                                else: {
                                  $concat: [
                                    "$sender.full_name",
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
                          $eq: ["$last_message.message_type", "exit_group"],
                        },
                        // then: {
                        //   $concat: [
                        //     "$sender.full_name",
                        //     " left the group",
                        //     ".",
                        //   ],
                        // },
                        then: {
                          $cond: {
                            if: {
                              $eq: ["$last_message.sender_id", userObjectId],
                            },
                            then: "You left the group.",
                            else: {
                              $concat: [
                                "$sender.full_name",
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
                else: { $ifNull: ["$last_message.message", null] },
              },
            },
            last_msg_time: { $ifNull: ["$last_message.message_time", null] },
            last_msg_type: { $ifNull: ["$last_message.message_type", null] },
            last_msg_sender_id: { $ifNull: ["$last_message.sender_id", null] },
            last_msg_sender_name: { $ifNull: ["$sender.full_name", null] },
            last_msg_status: { $ifNull: ["$last_message.is_read", null] },
            last_msg_delete_everyone: "$last_message.is_delete_everyone",
            poll_question: {
              $cond: {
                if: { $eq: ["$last_message.message_type", "poll"] },
                then: "$last_message.poll.question",
                else: "$$REMOVE",
              },
            },
          },
        },
        {
          $project: {
            _id: 1,
            room_type: 1,
            unread_messages_personal: 1,
            is_mute: 1,
            is_favorite: 1,
            is_archived: 1,
            is_pinned: 1,
            chat_wallpaper: 1,
            is_global: 1,
            is_unread: 1,
            group_name: 1,
            group_image: 1,
            user_id: 1,
            unread_count: 1,
            profile_picture: 1,
            is_online: 1,
            full_name: 1,
            last_msg: 1,
            last_msg_sender_name: 1,
            last_msg_sender_id: 1,
            last_msg_time: 1,
            last_msg_type: 1,
            last_msg_status: 1,
            last_msg_delete_everyone: 1,
            poll_question: 1,
            createdAt: 1,
          },
        },
      ]);

      if (chatRoomDetails) {
        return socketSuccessRes(
          "Chat room data fetched successfully",
          chatRoomDetails
        );
      } else {
        return socketErrorRes("Chat room not found.");
      }
    } catch (error) {
      console.log(error);
      return socketErrorRes("Error in getChatRoomData", error);
    }
  },

  getChatData: getChatData,

  voteInPoll: async (data, v1version) => {
    try {
      let { chat_room_id, chat_id, user_id, option_id, is_poll } = data;

      let chat_room_data = await chat_room.findOne({
        _id: chat_room_id,
        is_deleted: false,
      });

      if (!chat_room_data) {
        return socketErrorRes("Chat room does not exist.");
      }

      let findChat = await chat.findOne({
        _id: chat_id,
        is_delete_everyone: false,
        $not: { $in: [user_id, "$is_delete_by"] },
      });

      if (!findChat) {
        return socketErrRes("Chat not found");
      }

      let pollData = findChat.poll;

      let findPoll = await pollData.options.find(
        (option) => option._id.toString() == option_id
      );

      if (!findPoll) {
        return socketErrRes("Poll option not found");
      }

      if (is_poll == true || is_poll == "true") {
        if (pollData.is_multiple == false) {
          const userVoteDetails = pollData.voters.some(
            (voter) => voter.user_id.toString() === user_id.toString()
          );

          const userVotedOption = pollData.voters.find(
            (voter) => voter.user_id.toString() === user_id.toString()
          );

          if (
            userVoteDetails &&
            userVotedOption.option_id.toString() == option_id
          ) {
            return socketErrRes("User has already voted");
          } else {
            if (userVoteDetails) {
              await chat.updateOne(
                { _id: chat_id },
                {
                  $pull: {
                    "poll.voters": {
                      user_id: user_id,
                      option_id: userVotedOption.option_id,
                    },
                  },
                }
              );

              let res_data = {
                success: true,
                statuscode: 1,
                message: "User interacted in poll",
                data: {
                  is_poll: false,
                  vote_data: userVotedOption,
                  chat_id: chat_id.toString(),
                  poll_id: pollData._id.toString(),
                },
              };

              v1version
                .to(pollData._id.toString())
                .emit("userInteractWithPoll", res_data);
            }

            const updatedChat = await chat.findOneAndUpdate(
              { _id: chat_id },
              {
                $push: {
                  "poll.voters": {
                    user_id: user_id,
                    option_id: option_id,
                  },
                },
              },
              { new: true }
            );

            let userVotedInPoll = updatedChat.poll.voters.find(
              (voter) =>
                voter.user_id.toString() === user_id.toString() &&
                voter.option_id.toString() === option_id.toString()
            );

            let findUser = await users
              .findOne({
                _id: user_id,
              })
              .select("full_name profile_picture");

            if (findUser) {
              let full_name = findUser.full_name;
              let profile_picture = findUser.profile_picture
                ? process.env.BASE_URL + findUser.profile_picture
                : null;

              userVotedInPoll = {
                ...userVotedInPoll._doc,
                full_name: full_name,
                profile_picture: profile_picture,
              };
            }

            if (chat_room_data.room_type == "personal") {
              let receiver_id;

              if (chat_room_data.user_id.toString() == user_id.toString()) {
                receiver_id = chat_room_data.other_user_id;
              } else {
                receiver_id = chat_room_data.user_id;
              }

              let receiver_is_online = await user_session.findOne({
                user_id: receiver_id,
                is_active: true,
                chat_room_id: chat_room_id,
                is_deleted: false,
              });

              let findUserMuteChat = await chat_room_data.muted_by.some(
                (user) => user.toString() == receiver_id.toString()
              );

              let is_delete_by_reciever = findChat.is_delete_by
                .map(String)
                .includes(String(user_id));

              if (
                !receiver_is_online &&
                !findUserMuteChat &&
                !is_delete_by_reciever
              ) {
                let noti_title = findUser.full_name;

                let noti_msg = `Voted in : "📊 ${pollData.question}"`;

                let noti_for = "chat_notification";

                let notiData = {
                  noti_msg,
                  noti_title,
                  noti_for,
                  // id: user_id
                };

                let find_token = await user_session.find({
                  user_id: receiver_id,
                  is_deleted: false,
                });

                let device_token_array = find_token.map(
                  (row) => row.device_token
                );

                if (device_token_array.length > 0) {
                  notiData = { ...notiData, device_token: device_token_array };
                  console.log("noti sent topic");
                  // notiSendMultipleDevice(notiData);
                }
              }
            } else {
              let receiver_ids = chat_room_data.member_ids.filter(
                (id) => String(id) !== String(user_id)
              );

              console.log({ receiver_ids });

              let active_members = await user_session.distinct("user_id", {
                user_id: { $in: receiver_ids }, // Filter by group members
                is_active: true,
                chat_room_id: new mongoose.Types.ObjectId(chat_room_id),
                is_deleted: false,
              });

              console.log({ active_members });

              let non_active_members = receiver_ids.filter(
                (id) => !active_members.map(String).includes(id.toString())
              );

              console.log("Non-Active Members:", non_active_members);

              console.log({ receiver_ids });
              console.log({ non_active_members });

              let non_active_chat_deleted_members = non_active_members.filter(
                (id) =>
                  !chat_room_data.is_delete_by.some(
                    (user) => user.toString() === id.toString()
                  )
              );

              let non_active_unmuted_members =
                non_active_chat_deleted_members.filter(
                  (id) =>
                    !chat_room_data.muted_by.some(
                      (user) => user.toString() === id.toString()
                    )
                );

              console.log({ non_active_unmuted_members });

              if (non_active_unmuted_members.length > 0) {
                let noti_title = chat_room_data.group_name;

                let noti_msg = `${findUser.full_name} voted in : "📊 ${pollData.question}"`;

                let noti_for = "chat_notification";

                let notiData = {
                  noti_msg,
                  noti_title,
                  noti_for,
                  // id: user_id
                };

                let find_token = await user_session.find({
                  user_id: { $in: non_active_unmuted_members },
                  is_deleted: false,
                });

                let device_token_array = find_token.map(
                  (row) => row.device_token
                );

                if (device_token_array.length > 0) {
                  notiData = { ...notiData, device_token: device_token_array };
                  console.log("noti sent topic");
                  // notiSendMultipleDevice(notiData);
                }
              }
            }

            return socketSuccessRes("Successfully vote in poll", {
              is_poll,
              vote_data: userVotedInPoll,
              chat_id: chat_id.toString(),
              poll_id: pollData._id.toString(),
            });
          }
        } else {
          let findUserVotedInThisOption = pollData.voters.find(
            (voter) =>
              voter.user_id.toString() === user_id.toString() &&
              voter.option_id.toString() === option_id.toString()
          );

          if (findUserVotedInThisOption) {
            return socketErrRes("User has already voted for this option");
          } else {
            const updatedChat = await chat.findOneAndUpdate(
              { _id: chat_id },
              {
                $push: {
                  "poll.voters": {
                    user_id: user_id,
                    option_id: option_id,
                  },
                },
              },
              { new: true }
            );

            let userVotedInPoll = updatedChat.poll.voters.find(
              (voter) =>
                voter.user_id.toString() === user_id.toString() &&
                voter.option_id.toString() === option_id.toString()
            );

            let findUser = await users
              .findOne({
                _id: user_id,
              })
              .select("full_name profile_picture");

            if (findUser) {
              let full_name = findUser.full_name;
              let profile_picture = findUser.profile_picture
                ? process.env.BASE_URL + findUser.profile_picture
                : null;

              userVotedInPoll = {
                ...userVotedInPoll._doc,
                full_name: full_name,
                profile_picture: profile_picture,
              };
            }

            if (chat_room_data.room_type == "personal") {
              let receiver_id;

              if (chat_room_data.user_id.toString() == user_id.toString()) {
                receiver_id = chat_room_data.other_user_id;
              } else {
                receiver_id = chat_room_data.user_id;
              }

              let receiver_is_online = await user_session.findOne({
                user_id: receiver_id,
                is_active: true,
                chat_room_id: chat_room_id,
                is_deleted: false,
              });

              let findUserMuteChat = await chat_room_data.muted_by.some(
                (user) => user.toString() == receiver_id.toString()
              );

              let is_delete_by_reciever = findChat.is_delete_by
                .map(String)
                .includes(String(user_id));

              if (
                !receiver_is_online &&
                !findUserMuteChat &&
                !is_delete_by_reciever
              ) {
                let noti_title = findUser.full_name;

                let noti_msg = `Voted in : "📊 ${pollData.question}"`;

                let noti_for = "chat_notification";

                if (chat_room_data.room_type == "group") {
                  noti_title = chat_room_data.group_name;
                  noti_msg = `${findUser.full_name} voted in : "📊 ${pollData.question}"`;
                }

                let notiData = {
                  noti_msg,
                  noti_title,
                  noti_for,
                  // id: user_id
                };

                let find_token = await user_session.find({
                  user_id: receiver_id,
                  is_deleted: false,
                });

                let device_token_array = find_token.map(
                  (row) => row.device_token
                );

                if (device_token_array.length > 0) {
                  notiData = { ...notiData, device_token: device_token_array };
                  console.log("noti sent topic");
                  // notiSendMultipleDevice(notiData);
                }
              }
            } else {
              let receiver_ids = chat_room_data.member_ids.filter(
                (id) => String(id) !== String(user_id)
              );

              console.log({ receiver_ids });

              let active_members = await user_session.distinct("user_id", {
                user_id: { $in: receiver_ids }, // Filter by group members
                is_active: true,
                chat_room_id: new mongoose.Types.ObjectId(chat_room_id),
                is_deleted: false,
              });

              console.log({ active_members });

              let non_active_members = receiver_ids.filter(
                (id) => !active_members.map(String).includes(id.toString())
              );

              console.log("Non-Active Members:", non_active_members);

              console.log({ receiver_ids });
              console.log({ non_active_members });

              let non_active_chat_deleted_members = non_active_members.filter(
                (id) =>
                  !chat_room_data.is_delete_by.some(
                    (user) => user.toString() === id.toString()
                  )
              );

              let non_active_unmuted_members =
                non_active_chat_deleted_members.filter(
                  (id) =>
                    !chat_room_data.muted_by.some(
                      (user) => user.toString() === id.toString()
                    )
                );

              console.log({ non_active_unmuted_members });

              if (non_active_unmuted_members.length > 0) {
                let noti_title = chat_room_data.group_name;

                let noti_msg = `${findUser.full_name} voted in : "📊 ${pollData.question}"`;

                let noti_for = "chat_notification";

                let notiData = {
                  noti_msg,
                  noti_title,
                  noti_for,
                  // id: user_id
                };

                let find_token = await user_session.find({
                  user_id: { $in: non_active_unmuted_members },
                  is_deleted: false,
                });

                let device_token_array = find_token.map(
                  (row) => row.device_token
                );

                if (device_token_array.length > 0) {
                  notiData = { ...notiData, device_token: device_token_array };
                  console.log("noti sent topic");
                  // notiSendMultipleDevice(notiData);
                }
              }
            }

            return socketSuccessRes("Successfully vote in poll", {
              is_poll,
              vote_data: userVotedInPoll,
              chat_id: chat_id.toString(),
              poll_id: pollData._id.toString(),
            });
          }
        }
      } else {
        let findVote = pollData.voters.find(
          (voter) =>
            voter.user_id.toString() === user_id.toString() &&
            voter.option_id.toString() === option_id.toString()
        );

        if (!findVote) {
          return socketErrRes("User has not voted for this option");
        } else {
          await chat.updateOne(
            { _id: chat_id },
            {
              $pull: {
                "poll.voters": {
                  user_id: user_id,
                  option_id: option_id,
                },
              },
            }
          );

          return socketSuccessRes("Successfully unvote from poll", {
            is_poll,
            vote_data: findVote,
            chat_id: chat_id.toString(),
            poll_id: pollData._id.toString(),
          });
        }
      }
    } catch (error) {
      console.log("=== voteInPoll ===", error);
      return socketErrRes("Error in voteInPoll", error);
    }
  },

  pollVoteDetails: async (data) => {
    try {
      let { chat_room_id, chat_id, poll_id, user_id } = data;

      let findChatRoom = await chat_room.findOne({
        _id: chat_room_id,
        is_deleted: false,
      });

      if (!findChatRoom) {
        return socketErrorRes("Chat room does not exist.");
      }

      let findChat = await chat.findOne({
        _id: chat_id,
        is_delete_everyone: false,
        $not: { $in: [user_id, "$is_delete_by"] },
      });

      if (!findChat) {
        return socketErrRes("Chat not found");
      }

      if (findChat.message_type != "poll") {
        return socketErrRes("Chat is not a poll");
      }

      const pipeline = [
        {
          $match: {
            _id: new mongoose.Types.ObjectId(chat_id),
            "poll._id": new mongoose.Types.ObjectId(poll_id),
            is_delete_everyone: false,
            is_delete_by: { $ne: new mongoose.Types.ObjectId(user_id) },
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
                              user_id: "$$voter.user_id",
                              full_name: {
                                $arrayElemAt: [
                                  {
                                    $map: {
                                      input: {
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
                                      as: "profile",
                                      in: "$$profile.full_name",
                                    },
                                  },
                                  0,
                                ],
                              },
                              profile_picture: {
                                $arrayElemAt: [
                                  {
                                    $map: {
                                      input: {
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
                                      as: "profile",
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
                                  0,
                                ],
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                  is_multiple: "$poll.is_multiple",
                  total_voter_count: {
                    $size: { $setUnion: ["$poll.voters.user_id"] },
                  }, // Count unique voters
                },
                else: "$$REMOVE",
              },
            },
          },
        },
        {
          $project: {
            _id: 1,
            poll: 1,
            createdAt: 1,
            updatedAt: 1,
          },
        },
      ];

      const [findPoll] = await chat.aggregate(pipeline);

      return socketSuccessRes(
        "Poll vote details fetched successfully",
        findPoll
      );
    } catch (error) {
      console.log("=== pollVoteDetails ===", error);
      return socketErrRes("Error in pollVoteDetails", error);
    }
  },

  userIsTyping: async (data) => {
    try {
      const { user_id, chat_room_id, is_typing } = data;

      let chatRoomObjectId = new mongoose.Types.ObjectId(chat_room_id);
      let userObjectId = new mongoose.Types.ObjectId(user_id);

      let [chatRoomDetails] = await chat_room.aggregate([
        {
          $match: {
            _id: chatRoomObjectId,
            is_deleted: false,
          },
        },
        {
          $addFields: {
            current_user: userObjectId,
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "current_user",
            foreignField: "_id",
            as: "current_user_data",
          },
        },
        {
          $unwind: {
            path: "$current_user_data",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $addFields: {
            user_id: "$current_user_data._id",
            profile_picture: {
              $cond: {
                if: { $ifNull: ["$current_user_data.profile_picture", false] },
                then: {
                  $concat: [
                    process.env.BASE_URL,
                    "$current_user_data.profile_picture",
                  ],
                },
                else: null,
              },
            },
            full_name: "$current_user_data.full_name",
          },
        },
        {
          $project: {
            _id: 1,
            user_id: 1,
            full_name: 1,
            profile_picture: 1,
            createdAt: 1,
          },
        },
      ]);

      if (!chatRoomDetails) {
        return socketErrorRes("Chat room not found");
      }

      return socketSuccessRes("User is typing...", {
        user_id: user_id,
        chat_room_data: chatRoomDetails,
        is_typing: is_typing,
      });
    } catch (error) {
      console.log("=== userIsTyping ===", error);
      return socketErrorRes("Error in userIsTyping", error);
    }
  },

  starredMessageList: async (data) => {
    try {
      let { user_id, page = 1, limit = 10 } = data;

      const userObjectId = new mongoose.Types.ObjectId(user_id);

      const pipeline = [
        {
          $match: {
            stared_by: userObjectId,
            is_delete_by: { $ne: new mongoose.Types.ObjectId(user_id) },
            is_delete_everyone: false,
          },
        },
        {
          $sort: { createdAt: -1 },
        },
        {
          $skip: (parseInt(page) - 1) * parseInt(limit),
        },
        {
          $limit: parseInt(limit),
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
            localField: "sender_id",
            foreignField: "_id",
            as: "sender",
          },
        },
        {
          $unwind: {
            path: "$sender",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "receiver_id",
            foreignField: "_id",
            as: "receiver",
          },
        },
        {
          $unwind: {
            path: "$receiver",
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
          $lookup: {
            from: "chat_rooms", // Reference to `reply_message_id`
            localField: "chat_room_id",
            foreignField: "_id",
            as: "chat_room_data",
          },
        },
        {
          $unwind: {
            path: "$chat_room_data",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $addFields: {
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
            sender_profile_picture: {
              $cond: {
                if: { $ifNull: ["$sender.profile_picture", false] },
                then: {
                  $concat: [process.env.BASE_URL, "$sender.profile_picture"],
                },
                else: "$sender.profile_picture",
              },
            },
            sender_name: "$sender.full_name",
            receiver_name: "$receiver.full_name",
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
            chat_room_type: "$chat_room_data.room_type",
            group_name: "$chat_room_data.group_name",
            group_image: {
              $cond: {
                if: {
                  $and: [
                    { $eq: ["$chat_room_data.room_type", "group"] }, // Check if room_type is "group"
                    { $ifNull: ["$chat_room_data.group_image", false] }, // Check if group_image exists
                  ],
                },
                then: {
                  $concat: [
                    process.env.BASE_URL,
                    "$chat_room_data.group_image",
                  ],
                },
                else: null,
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
            sender_id: 1,
            sender_profile_picture: 1,
            sender_name: 1,
            receiver_name: 1,
            receiver_id: 1,
            chat_room_type: 1,
            group_name: 1,
            group_image: 1,
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
            replied_message_media: 1,
            chat_reactions: 1,
            createdAt: 1,
            updatedAt: 1,
          },
        },
      ];

      const staredMessage = await chat.aggregate(pipeline);

      const count_pipeline = [
        {
          $match: {
            stared_by: userObjectId,
            is_delete_by: { $ne: new mongoose.Types.ObjectId(user_id) },
            is_delete_everyone: false,
          },
        },
        {
          $project: {
            _id: 1,
          },
        },
      ];

      const staredMessage_list_count = await chat.aggregate(count_pipeline);

      return socketMultiSuccessRes(
        "Starred message list get successfully",
        staredMessage_list_count.length,
        staredMessage
      );
    } catch (error) {
      console.log(error);
      return socketErrRes("Something went wrong", error);
    }
  },

  getPinnedMessage: async (data) => {
    try {
      let { chat_room_id, user_id, page = 1, limit = 10 } = data;

      const userObjectId = new mongoose.Types.ObjectId(user_id);

      let [findRoom] = await chat_room.aggregate([
        {
          $match: {
            _id: new mongoose.Types.ObjectId(chat_room_id),
          },
        },
        {
          $addFields: {
            current_user: {
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
            full_name: "$user_id.full_name",
          },
        },
        {
          $project: {
            _id: 1,
            user_id: 1,
            full_name: 1,
            profile_picture: 1,
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
            is_pin: true,
            is_delete_everyone: false,
            $or: [
              { sender_id: userObjectId },
              { receiver_id: userObjectId },
              { receiver_ids: userObjectId },
            ],
            is_delete_by: { $ne: new mongoose.Types.ObjectId(user_id) },
          },
        },
        {
          $sort: { createdAt: -1 },
        },
        {
          $skip: (parseInt(page) - 1) * parseInt(limit),
        },
        {
          $limit: parseInt(limit),
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
            from: "chat_rooms", // Reference to `reply_message_id`
            localField: "chat_room_id",
            foreignField: "_id",
            as: "chat_room_data",
          },
        },
        {
          $unwind: {
            path: "$chat_room_data",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $addFields: {
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
            is_read: {
              $cond: {
                if: {
                  $and: [
                    { $eq: ["$chat_room_data.room_type", "group"] },
                    {
                      $eq: [
                        { $size: "$receiver_ids" },
                        { $size: "$is_read_by" },
                      ],
                    },
                  ],
                },
                then: "seen",
                else: "$is_read",
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
            location: 1,
            // poll:1,
            reply_message_id: {
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
              location: 1,
              media_file: 1,
              sender_id: 1,
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
        },
      ];

      const findAllMessage = await chat.aggregate(pipeline);

      const count_pipeline = [
        {
          $match: {
            chat_room_id: new mongoose.Types.ObjectId(chat_room_id),
            is_pin: true,
            is_delete_everyone: false,
            is_delete_by: { $ne: new mongoose.Types.ObjectId(user_id) },
          },
        },
        {
          $project: {
            _id: 1,
          },
        },
      ];

      const message_list_count = await chat.aggregate(count_pipeline);

      let res_data = {
        chat_room_data: findRoom,
        messages: findAllMessage,
      };

      return socketMultiSuccessRes(
        "Message list get successfully",
        message_list_count.length,
        res_data
      );
    } catch (error) {
      console.log("=== getPinnedMessage ===", error);
      return socketErrRes("Error in getPinnedMessage", error);
    }
  },

  addReaction: async (data) => {
    try {
      let { chat_room_id, chat_id, user_id, emoji } = data;

      let findChat = await chat.findOne({
        _id: chat_id,
        chat_room_id: chat_room_id,
        is_delete_everyone: false,
        is_deleted: false,
      });

      if (!findChat) {
        return socketErrRes("Chat not found");
      }

      let find_reaction = await chat_reaction.findOne({
        chat_room_id: chat_room_id,
        chat_id: chat_id,
        user_id: user_id,
      });

      if (find_reaction) {
        let update_data = {
          emoji: emoji,
        };

        let result = await chat_reaction.findByIdAndUpdate(
          find_reaction._id,
          update_data,
          { new: true }
        );

        return socketSuccessRes("Reaction added successfully", result);
      } else {
        let insert_data = {
          chat_room_id: chat_room_id,
          chat_id: chat_id,
          user_id: user_id,
          emoji: emoji,
        };

        let result = await chat_reaction.create(insert_data);

        return socketSuccessRes("Reaction added successfully", result);
      }
    } catch (error) {
      console.log(error);
      return socketErrRes("Error in addReaction");
    }
  },

  reactionList: async (data) => {
    try {
      let { chat_id } = data;

      let findChat = await chat.findOne({
        _id: chat_id,
        is_delete_everyone: false,
        is_deleted: false,
      });

      if (!findChat) {
        return socketErrRes("Chat not found");
      }

      let reaction_list = await chat_reaction.aggregate([
        {
          $match: {
            chat_id: new mongoose.Types.ObjectId(chat_id),
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "user_id",
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
          $addFields: {
            "user_id.profile_picture": {
              $cond: {
                if: { $ifNull: ["$user_id.profile_picture", false] },
                then: {
                  $concat: [process.env.BASE_URL, "$user_id.profile_picture"],
                },
                else: null,
              },
            },
          },
        },
        {
          $project: {
            _id: 1,
            chat_id: 1,
            chat_room_id: 1,
            user_id: {
              _id: 1,
              full_name: 1,
              profile_picture: 1,
              emoji: 1,
            },
            emoji: 1,
            createdAt: 1,
            updatedAt: 1,
          },
        },
      ]);

      return socketSuccessRes("Reaction list successfully", reaction_list);
    } catch (error) {
      console.log(error);
      return socketErrRes("Error in reactionList", error);
    }
  },

  removeReaction: async (data) => {
    try {
      let { chat_reaction_id } = data;

      let find_reaction = await chat_reaction.findOne({
        _id: chat_reaction_id,
      });

      if (!find_reaction) {
        return socketErrRes("Reaction not found");
      }

      await chat_reaction.findByIdAndDelete(chat_reaction_id);

      return socketSuccessRes("Reaction removed successfully", data);
    } catch (error) {
      console.log(error);
      return socketErrRes("Error in addReaction");
    }
  },

  pinMessage: async (data) => {
    try {
      const { user_id, message_id } = data;

      const pinMessage = await chat.findOneAndUpdate(
        { _id: message_id },
        {
          $set: {
            is_pin: true,
            pin_user_id: user_id,
          },
        },
        { new: true }
      );

      return socketSuccessRes("message pinned successfully", pinMessage);
    } catch (error) {
      console.log("=== pinMessage ===", error);
      return socketErrorRes("Error in pinMessage", error);
    }
  },

  unPinMessage: async (data) => {
    try {
      const { user_id, message_id } = data;

      const unPinMessage = await chat.findOneAndUpdate(
        { _id: message_id },
        {
          $set: {
            is_pin: false,
            pin_user_id: null,
          },
        },
        { new: true }
      );

      return socketSuccessRes("message unpin successfully", unPinMessage);
    } catch (error) {
      console.log("=== unPinMessage ===", error);
      return socketErrorRes("Error in unPinMessage", error);
    }
  },

  deleteChatRoom: async (data) => {
    try {
      let { chat_room_id, user_id } = data;

      let findChat = await chat_room.findOne({
        _id: chat_room_id,
        is_deleted: false,
      });

      if (!findChat) {
        return socketErrRes("Chat room not found");
      }

      let delete_data = { is_delete_by: user_id };

      await chat
        .updateMany({ chat_room_id: chat_room_id }, { $push: delete_data })
        .where({ is_delete_by: { $ne: user_id } });

      await chat_room
        .updateMany({ _id: chat_room_id }, { $push: delete_data })
        .where({ is_delete_by: { $ne: user_id } });

      await chat_room
        .updateMany(
          { _id: chat_room_id },
          {
            $pull: {
              favorites_by: user_id,
            },
          }
        )
        .where({ favorites_by: { $eq: user_id } });

      await chat_room
        .updateMany(
          { _id: chat_room_id },
          {
            $pull: {
              archived_by: user_id,
            },
          }
        )
        .where({ archived_by: { $eq: user_id } });

      await chat_room.updateMany(
        { _id: chat_room_id },
        {
          $pull: {
            pinned_by: { user_id: user_id }, // Correct way to remove objects inside an array
          },
        }
      );
      // .where({ "pinned_by.user_id": { $eq: user_id } });

      return socketSuccessRes("Chat deleted successfully", { chat_room_id });
    } catch (error) {
      console.log("=== deleteChatRoom ===", error);
      return socketErrRes("Error in deleteChatRoom", error);
    }
  },

  clearChat: async (data) => {
    try {
      let { chat_room_id, user_id } = data;

      let findChat = await chat_room.findOne({
        _id: chat_room_id,
        is_deleted: false,
      });

      if (!findChat) {
        return socketErrRes("Chat room not found");
      }

      let find_last_msg = await chat
        .findOne({
          chat_room_id: chat_room_id,
          is_delete_by: { $ne: user_id },
        })
        .sort({
          message_time: -1,
        });

      let delete_data = { is_delete_by: user_id };

      await chat
        .updateMany({ chat_room_id: chat_room_id }, { $push: delete_data })
        .where({ is_delete_by: { $ne: user_id } });

      if (find_last_msg) {
        let message_data;
        if (findChat.room_type == "group") {
          message_data = {
            chat_room_id: chat_room_id,
            sender_id: user_id,
            receiver_ids: [user_id],
            message: "History was cleared",
            message_time: find_last_msg.message_time,
            is_read_by: [
              {
                user_id: user_id,
                read_at: new Date(),
              },
            ],
            message_type: "clear_chat",
            is_read: "seen",
          };
        } else {
          message_data = {
            chat_room_id: chat_room_id,
            sender_id: user_id,
            receiver_id: user_id,
            message: "History was cleared",
            message_time: find_last_msg.message_time,
            message_type: "clear_chat",
            is_read: "seen",
          };
        }
        await chat.create(message_data);
      }

      return socketSuccessRes("Chat deleted successfully", { chat_room_id });
    } catch (error) {
      console.log("=== clearChat ===", error);
      return socketErrRes("Error in clearChat", error);
    }
  },

  starredMessage: async (data) => {
    try {
      let { chat_ids, user_id, is_stared } = data;

      let findChat = await chat.find({
        _id: chat_ids,
        is_delete_everyone: false,
        is_delete_by: { $ne: user_id },
      });

      if (findChat.length != chat_ids.length) {
        return socketErrRes("Chat not found");
      }

      let update_data = { stared_by: user_id };

      if (is_stared == true) {
        await chat
          .updateMany({ _id: { $in: chat_ids } }, { $push: update_data })
          .where({ stared_by: { $ne: user_id } });

        return socketSuccessRes("Message starred successfully", { chat_ids });
      } else {
        await chat.updateMany(
          { _id: { $in: chat_ids } },
          { $pull: update_data }
        );

        return socketSuccessRes("Message unstarred successfully", { chat_ids });
      }
    } catch (error) {
      console.log("=== starredMessage ===", error);
      return socketErrRes("Error in starredMessage", error);
    }
  },

  unStarAllMessage: async (data) => {
    try {
      let { user_id } = data;

      let update_data = { stared_by: user_id };

      await chat.updateMany({ stared_by: user_id }, { $pull: update_data });

      return socketSuccessRes("All message unstarred successfully", []);
    } catch (error) {
      console.log("=== unStarAllMessage ===", error);
      return socketErrRes("Error in unStarAllMessage", error);
    }
  },

  muteUnmuteChat: async (data) => {
    try {
      let { chat_room_ids, user_id, is_mute } = data;

      let userObjectId = new mongoose.Types.ObjectId(user_id);

      if (chat_room_ids.length == 0) {
        return socketErrorRes("No chat room ids provided");
      }

      let findChats = await chat_room.find({
        _id: { $in: chat_room_ids },
        $or: [
          { user_id: userObjectId },
          { other_user_id: userObjectId },
          // { member_ids: userObjectId },
          { all_member_ids: userObjectId },
        ],
        is_delete_by: { $ne: new mongoose.Types.ObjectId(user_id) },
        is_deleted: false,
      });

      if (findChats.length != chat_room_ids.length) {
        return socketErrorRes("Chat room not found");
      }

      let update_data = { muted_by: user_id };

      if (is_mute == true || is_mute == "true") {
        await chat_room
          .updateMany({ _id: chat_room_ids }, { $push: update_data })
          .where({ muted_by: { $ne: user_id } });

        return socketSuccessRes("Chat muted successfully", {
          chat_room_ids,
          user_id,
          is_mute,
        });
      } else {
        await chat_room.updateMany(
          { _id: chat_room_ids },
          { $pull: update_data }
        );

        return socketSuccessRes("Chat unmuted successfully", {
          chat_room_ids,
          user_id,
          is_mute,
        });
      }
    } catch (error) {
      console.log("=== MuteUnmuteChat ===", error);
      return socketErrRes("Error in MuteUnmuteChat", error);
    }
  },

  editChat: async (data) => {
    try {
      let { chat_room_id, chat_id, user_id, message, message_type } = data;

      if (!(message_type === "text" || message_type === "emoji")) {
        return socketErrRes("Invalid message type");
      }

      let findChatRoom = await chat_room.findOne({
        _id: chat_room_id,
        is_deleted: false,
      });

      if (!findChatRoom) {
        return socketErrRes("Chat room not found");
      }

      let findChat = await chat.findOne({
        _id: chat_id,
        sender_id: user_id,
        chat_room_id: chat_room_id,
        is_delete_everyone: false,
      });

      if (!findChat) {
        return socketErrRes("Chat not found");
      }

      if (findChat.sender_id.toString() != user_id) {
        return socketErrRes("You can't edit this message");
      }

      if (
        findChat &&
        (findChat.message_type === "text" ||
          findChat.message_type === "emoji" ||
          findChat.message_type === "media_with_text")
      ) {
        let update_data = {
          message: message,
          message_type: message_type,
          is_edited: true,
        };

        if (
          message_type == "text" ||
          message_type == "media_with_text" ||
          message_type === "link"
        ) {
          const urlRegex = /(https?:\/\/[^\s]+)/g; // Matches HTTP/HTTPS links
          let checkURL = urlRegex.test(message);
          if (checkURL) {
            update_data.message_type = "link";
          }
        }

        let result = await chat.findByIdAndUpdate(chat_id, update_data, {
          new: true,
        });

        return socketSuccessRes("Chat edited successfully", {
          chat_room_data: findChatRoom,
          message: result,
        });
      } else {
        return socketErrRes("Only text and emoji messages can be edited");
      }
    } catch (error) {
      console.log("=== deleteChat ===", error);
      return socketErrRes("Error in deleteChat", error);
    }
  },

  deleteChat: async (data) => {
    try {
      let { chat_room_id, chat_ids, user_id } = data;

      let chatObjectIds = chat_ids.map((id) => new mongoose.Types.ObjectId(id));

      let findChat = await chat.find({
        _id: { $in: chat_ids },
        // is_delete_everyone: false,
        $not: { $in: [user_id, "$is_delete_by"] },
      });

      if (findChat.length != chat_ids.length) {
        return socketErrRes("Chat not found");
      }

      let delete_data = { is_delete_by: user_id };

      let delete_chats = await Promise.all(
        chat_ids.map(async (id) => {
          let find_chat = await chat.findOne({
            _id: id,
            // is_delete_everyone: false,
          });

          if (!find_chat) {
            return socketErrRes("Chat not found");
          }

          await chat
            .updateOne({ _id: find_chat._id }, { $push: delete_data })
            .where({ is_delete_by: { $ne: user_id } });

          if (find_chat.reply_message_id != null) {
            if (find_chat.replied_message_media.length > 0) {
              let reply_message_media = find_chat.replied_message_media[0];

              await chat
                .updateOne(
                  { "replied_message_media._id": reply_message_media._id },
                  {
                    $push: { "replied_message_media.$.is_deleted_by": user_id },
                  }
                )
                .where({
                  "replied_message_media.$.is_deleted_by": { $ne: user_id },
                });

              const specificMedia = await chat.findOne({ _id: find_chat._id });

              let reply_message_media1 = specificMedia.replied_message_media[0];

              if (
                reply_message_media1.deleted_everyone == false &&
                reply_message_media1.is_deleted_by?.length == 2
              ) {
                const mediaPath = path.join(
                  __dirname + `./../../public/${reply_message_media1.file_name}`
                );

                try {
                  await fs.access(mediaPath);
                  await fs.unlink(mediaPath);
                } catch (err) {
                  if (err.code === "ENOENT") {
                    console.log(
                      `Media file ${reply_message_media1.file_name} does not exist.`
                    );
                  } else {
                    console.error(
                      `Error deleting media file ${reply_message_media1.file_name}:`,
                      err
                    );
                  }
                }
              }
            }
          }

          if (
            ["media", "gif", "voice", "media_with_text"].includes(
              find_chat.message_type
            )
          ) {
            const delete_chat_media = find_chat.media_file.map(
              async (media) => {
                await chat
                  .updateOne(
                    { "media_file._id": media._id },
                    { $push: { "media_file.$.is_deleted_by": user_id } }
                  )
                  .where({ "media_file.$.is_deleted_by": { $ne: user_id } });

                const specificMedia = await chat.aggregate([
                  { $match: { _id: new mongoose.Types.ObjectId(id) } },
                  { $unwind: "$media_file" },
                  {
                    $match: {
                      "media_file._id": new mongoose.Types.ObjectId(media._id),
                    },
                  },
                  { $project: { media_file: 1, _id: 0 } },
                ]);

                if (
                  specificMedia[0].media_file.deleted_everyone == false &&
                  specificMedia[0].media_file.is_deleted_by?.length == 2
                ) {
                  const removeMediaPath = path.join(
                    __dirname + `./../../public/${media.file_name}`
                  );
                  await fs.unlink(removeMediaPath);

                  if (media.file_type == "video") {
                    const removeThumbnailPath = path.join(
                      __dirname + `./../../public/${media.thumbnail}`
                    );
                    await fs.unlink(removeThumbnailPath);
                  }
                }
              }
            );

            await Promise.all(delete_chat_media);
          }
        })
      );

      return socketSuccessRes("Chat deleted successfully", {
        chat_room_id: chat_room_id,
        chat_ids: chatObjectIds,
      });
    } catch (error) {
      console.log("=== deleteChat ===", error);
      return socketErrRes("Error in deleteChat", error);
    }
  },

  deleteForEveryone: async (data) => {
    try {
      let { chat_room_id, chat_ids, user_id } = data;

      let findChatRoom = await chat_room.findOne({
        _id: chat_room_id,
        is_deleted: false,
      });

      if (!findChatRoom) {
        return socketErrRes("Chat room not found");
      }

      let chatObjectIds = chat_ids.map((id) => new mongoose.Types.ObjectId(id));

      let findChat = await chat.find({
        _id: { $in: chat_ids },
        is_delete_everyone: false,
        sender_id: user_id,
        is_deleted: false,
      });

      if (findChat.length != chat_ids.length) {
        return socketErrRes("Chat not found");
      }

      // let delete_chats = await Promise.all(
      //   chat_ids.map(async (id) => {
      //     let find_chat = await chat.findById(id);

      //     if (!find_chat) {
      //       return socketErrRes("Chat not found");
      //     }

      //     await chat.findByIdAndUpdate(id, {
      //       $set: {
      //         is_delete_everyone: true,
      //         is_pin: false,
      //       },
      //     });

      //     if (find_chat.reply_message_id != null) {
      //       if (find_chat.replied_message_media.length > 0) {
      //         let reply_message_media = find_chat.replied_message_media[0];

      //         const result = await chat.updateOne(
      //           {
      //             _id: id,
      //             "replied_message_media._id": reply_message_media._id, // Match specific replied media
      //           },
      //           {
      //             $set: {
      //               "replied_message_media.$.deleted_everyone": true, // Update the key
      //             },
      //           }
      //         );

      //         const specificMedia = await chat.findOne({ _id: find_chat._id });

      //         let reply_message_media1 = specificMedia.replied_message_media[0];

      //         const mediaPath = path.join(
      //           __dirname + `./../../public/${reply_message_media1.file_name}`
      //         );

      //         try {
      //           await fs.access(mediaPath);
      //           await fs.unlink(mediaPath);
      //         } catch (err) {
      //           if (err.code === "ENOENT") {
      //             console.log(
      //               `Media file ${reply_message_media1.file_name} does not exist.`
      //             );
      //           } else {
      //             console.error(
      //               `Error deleting media file ${reply_message_media1.file_name}:`,
      //               err
      //             );
      //           }
      //         }
      //       }
      //     }

      //     if (
      //       ["media", "gif", "voice", "media_with_text"].includes(
      //         find_chat.message_type
      //       )
      //     ) {
      //       const delete_chat_media = find_chat.media_file.map(
      //         async (media) => {
      //           await chat.updateOne(
      //             { _id: id, "media_file._id": media._id },
      //             { $set: { "media_file.$.deleted_everyone": true } }
      //           );

      //           const removeMediaPath = path.join(
      //             __dirname + `./../../public/${media.file_name}`
      //           );
      //           await fs.unlink(removeMediaPath);

      //           if (media.file_type == "video") {
      //             const removeThumbnailPath = path.join(
      //               __dirname + `./../../public/${media.thumbnail}`
      //             );
      //             await fs.unlink(removeThumbnailPath);
      //           }
      //         }
      //       );

      //       await Promise.all(delete_chat_media);
      //     }
      //   })
      // );

      console.log("chat_ids", chat_ids);

      for (let id of chat_ids) {
        let find_chat = await chat.findById(id);
        if (!find_chat) {
          return socketErrRes("Chat not found");
        }
        console.log("inner chats", id);
        await chat.findByIdAndUpdate(id, {
          $set: {
            is_delete_everyone: true,
            is_pin: false,
          },
        });

        console.log(
          find_chat.reply_message_id != null &&
          find_chat.replied_message_media.length > 0
        );

        if (
          find_chat.reply_message_id != null &&
          find_chat.replied_message_media.length > 0
        ) {
          let reply_message_media = find_chat.replied_message_media[0];

          await chat.updateOne(
            { _id: id, "replied_message_media._id": reply_message_media._id },
            { $set: { "replied_message_media.$.deleted_everyone": true } }
          );

          let mediaPath = path.join(
            __dirname,
            `./../../public/${reply_message_media.file_name}`
          );
          try {
            await fs.access(mediaPath);
            await fs.unlink(mediaPath);
          } catch (err) {
            console.log(
              `Media file ${reply_message_media.file_name} does not exist.`
            );
          }
        }

        console.log(
          ["media", "gif", "voice", "media_with_text"].includes(
            find_chat.message_type
          )
        );

        if (
          ["media", "gif", "voice", "media_with_text"].includes(
            find_chat.message_type
          )
        ) {
          for (let media of find_chat.media_file) {
            await chat.updateOne(
              { _id: id, "media_file._id": media._id },
              { $set: { "media_file.$.deleted_everyone": true } }
            );

            let removeMediaPath = path.join(
              __dirname,
              `./../../public/${media.file_name}`
            );
            try {
              await fs.unlink(removeMediaPath);
            } catch (err) {
              console.error(
                `Error deleting media file ${media.file_name}:`,
                err
              );
            }

            if (media.file_type == "video") {
              let removeThumbnailPath = path.join(
                __dirname,
                `./../../public/${media.thumbnail}`
              );
              try {
                await fs.unlink(removeThumbnailPath);
              } catch (err) {
                console.error(
                  `Error deleting thumbnail ${media.thumbnail}:`,
                  err
                );
              }
            }
          }
        }
      }

      return socketSuccessRes("Chat deleted for everyone successfully", {
        chat_room_data: findChatRoom,
        chat_ids: chatObjectIds,
      });
    } catch (error) {
      console.log("error", error.message);
      return socketErrorRes("Error deleting chat", error);
    }
  },

  deleteMediaChat: async (data) => {
    try {
      let { chat_room_id, chat_id, chat_media_ids, user_id } = data;

      let chatMediaObjectIds = chat_media_ids.map(
        (id) => new mongoose.Types.ObjectId(id)
      );

      let findChat = await chat.findOne({
        _id: chat_id,
        is_delete_everyone: false,
        $not: { $in: [user_id, "$is_delete_by"] },
      });

      if (!findChat) {
        return socketErrRes("Chat not found");
      }

      if (findChat.media_file.length < chat_media_ids.length) {
        return socketErrRes("Can't delete media from this chat");
      }

      const validMediaFileIds = findChat.media_file.map((media) =>
        media._id.toString()
      );

      const areAllIdsValid = chat_media_ids.every((id) =>
        validMediaFileIds.includes(id)
      );
      console.log({ areAllIdsValid });

      if (!areAllIdsValid) {
        return socketErrRes("Invalid media files");
      }

      for (let media of findChat.media_file) {
        if (chat_media_ids.includes(String(media._id))) {
          if (
            !media.is_deleted_by.includes(new mongoose.Types.ObjectId(user_id))
          ) {
            await chat.updateOne(
              { _id: chat_id, "media_file._id": media._id },
              { $push: { "media_file.$.is_deleted_by": user_id } },
              { new: true }
            );
          }

          const specificMedia = await chat.aggregate([
            { $match: { _id: new mongoose.Types.ObjectId(chat_id) } },
            { $unwind: "$media_file" },
            {
              $match: {
                "media_file._id": new mongoose.Types.ObjectId(media._id),
              },
            },
            { $project: { media_file: 1, _id: 0 } },
          ]);

          if (
            specificMedia[0].media_file.deleted_everyone == false &&
            specificMedia[0].media_file.is_deleted_by?.length == 2
          ) {
            const removeMediaPath = path.join(
              __dirname + `./../../public/${media.file_name}`
            );
            await fs.unlink(removeMediaPath);

            if (media.file_type == "video") {
              const removeThumbnailPath = path.join(
                __dirname + `./../../public/${media.thumbnail}`
              );
              await fs.unlink(removeThumbnailPath);
            }
          }
        }
      }

      let updatedChat = await chat.findOne({
        _id: chat_id,
        is_delete_everyone: false,
        $not: { $in: [user_id, "$is_delete_by"] },
      });

      const checkMediaFilesExists = updatedChat.media_file.filter(
        (media) =>
          !media.deleted_everyone && !media.is_deleted_by.includes(user_id)
      );

      console.log({ checkMediaFilesExists });

      let delete_data = { is_delete_by: user_id };

      if (checkMediaFilesExists.length == 0) {
        //if all media files deleted by user then delete chat
        await chat
          .updateOne({ _id: chat_id }, { $push: delete_data })
          .where({ is_delete_by: { $ne: user_id } });
      }

      return socketSuccessRes("Chat media deleted successfully", {
        chat_id: chat_id,
        chat_room_id: chat_room_id,
        chat_media_ids: chat_media_ids,
      });
    } catch (error) {
      console.log("=== deleteChat ===", error);
      return socketErrRes("Error in deleteChat", error);
    }
  },

  deleteMediaChatEveryOne: async (data) => {
    try {
      let { chat_room_id, chat_id, chat_media_ids, user_id } = data;

      let findChatRoom = await chat_room.findOne({
        _id: chat_room_id,
        is_deleted: false,
      });

      if (!findChatRoom) {
        return socketErrRes("Chat room not found");
      }

      let chatMediaObjectIds = chat_media_ids.map(
        (id) => new mongoose.Types.ObjectId(id)
      );

      let findChat = await chat.findOne({
        _id: chat_id,
        is_delete_everyone: false,
        sender_id: user_id,
        $not: { $in: [user_id, "$is_delete_by"] },
      });

      if (!findChat) {
        return socketErrRes("Chat not found");
      }

      if (findChat.media_file.length < chat_media_ids.length) {
        return socketErrRes("Can't delete media from this chat");
      }

      const validMediaFileIds = findChat.media_file.map((media) =>
        media._id.toString()
      );

      const areAllIdsValid = chat_media_ids.every((id) =>
        validMediaFileIds.includes(id)
      );

      if (!areAllIdsValid) {
        return socketErrRes("Invalid media files");
      }

      for (let media of findChat.media_file) {
        if (chat_media_ids.includes(String(media._id))) {
          if (
            !media.is_deleted_by.includes(new mongoose.Types.ObjectId(user_id))
          ) {
            await chat.updateOne(
              { _id: chat_id, "media_file._id": media._id },
              { $set: { "media_file.$.deleted_everyone": true } }
            );
          }

          const removeMediaPath = path.join(
            __dirname + `./../../public/${media.file_name}`
          );
          await fs.unlink(removeMediaPath);

          if (media.file_type == "video") {
            const removeThumbnailPath = path.join(
              __dirname + `./../../public/${media.thumbnail}`
            );
            await fs.unlink(removeThumbnailPath);
          }
        }
      }

      let updatedChat = await chat.findOne({
        _id: chat_id,
        is_delete_everyone: false,
        $not: { $in: [user_id, "$is_delete_by"] },
      });

      const checkMediaFilesExists = updatedChat.media_file.filter(
        (media) =>
          !media.deleted_everyone && !media.is_deleted_by.includes(user_id)
      );

      let delete_data = { is_delete_everyone: true };

      if (checkMediaFilesExists.length == 0) {
        //if all media files deleted by everyone then delete chat

        await chat.updateOne({ _id: chat_id }, { $set: delete_data });
      }

      return socketSuccessRes("Chat media deleted successfully", {
        chat_room_data: findChatRoom,
        chat_media_ids: chat_media_ids,
      });
    } catch (error) {
      console.log("=== deleteChat ===", error);
      return socketErrRes("Error in deleteChat", error);
    }
  },

  readMessage: async (data) => {
    try {
      let { chat_room_id, user_id } = data;

      let find_chat_room = await chat_room.findOne({
        _id: chat_room_id,
        is_deleted: false,
      });

      if (!find_chat_room) {
        return socketErrRes("Chat room not found");
      }

      if (find_chat_room.room_type == "personal") {
        let sender_id;

        if (find_chat_room.user_id == user_id) {
          sender_id = find_chat_room.other_user_id;
        } else {
          sender_id = find_chat_room.user_id;
        }

        let chatUpdate = await chat.updateMany(
          { chat_room_id: chat_room_id, receiver_id: user_id },
          {
            $set: { is_read: "seen" },
            $addToSet: {
              is_read_by: { user_id: user_id, read_at: new Date() },
            },
          },
          { new: true }
        );

        let result = {
          chat_room_id: chat_room_id,
          read_user_id: user_id,
          room_type: "personal",
          sender_id: sender_id.toString(),
          is_read: "seen",
          read_by_all: true,
        };

        await chat_room
          .updateMany(
            { _id: chat_room_id },
            {
              $pull: {
                unread_by: user_id,
              },
            }
          )
          .where({ unread_by: { $eq: user_id } });

        return socketSuccessRes("Message read successfully", result);
      } else {
        if (!find_chat_room.all_member_ids.includes(user_id)) {
          return socketErrRes("You are not a member of this group.");
        }

        await chat.updateMany(
          {
            chat_room_id: chat_room_id,
            all_member_ids: user_id,
            receiver_ids: user_id,
            "is_read_by.user_id": { $ne: user_id },
            // is_delete_by: { $ne: user_id },
            // is_delete_everyone: false,
          },
          {
            $addToSet: {
              is_read_by: { user_id: user_id, read_at: new Date() },
            },
          }
        );

        let find_last_group_msg = await chat
          .findOne({
            chat_room_id: chat_room_id,
          })
          .sort({
            createdAt: -1,
          });

        await chat_room
          .updateMany(
            { _id: chat_room_id },
            {
              $pull: {
                unread_by: user_id,
              },
            }
          )
          .where({ unread_by: { $eq: user_id } });

        if (find_last_group_msg) {
          if (
            find_last_group_msg.receiver_ids.length ==
            find_last_group_msg.is_read_by.length
          ) {
            let result = {
              chat_room_id: chat_room_id,
              read_user_id: user_id,
              room_type: "group",
              sender_id: find_last_group_msg.sender_id.toString(),
              is_read: "seen",
              read_by_all: true,
            };

            let chatUpdate = await chat.updateMany(
              { chat_room_id: chat_room_id },
              { $set: { is_read: "seen" } },
              { new: true }
            );

            return socketSuccessRes("Message read successfully", result);
          } else {
            let result = {
              chat_room_id: chat_room_id,
              read_user_id: user_id,
              room_type: "group",
              sender_id: find_last_group_msg.sender_id.toString(),
              is_read: "seen",
              read_by_all: false,
            };

            return socketSuccessRes("Message read successfully", result);
          }
        } else {
          return socketErrRes("No message found");
        }
      }
    } catch (error) {
      console.log("=== readMessage ===", error);
      return socketErrRes("Error in readMessage", error);
    }
  },

  getMessageInfo: async (data) => {
    try {
      let { chat_room_id, chat_id, user_id } = data;

      let findChatRoom = await chat_room.findOne({
        _id: chat_room_id,
        is_deleted: false,
      });

      if (!findChatRoom) {
        return socketErrRes("Chat room not found");
      }

      let findChat = await chat.findOne({
        _id: chat_id,
        sender_id: user_id,
        chat_room_id: chat_room_id,
        is_delete_everyone: false,
      });

      if (!findChat) {
        return socketErrRes("Chat not found");
      }

      let [message_info] = await chat.aggregate([
        {
          $match: {
            _id: new mongoose.Types.ObjectId(chat_id),
          },
        },
        {
          $lookup: {
            from: "users", // Assuming the users collection is named "users"
            localField: "is_read_by.user_id",
            foreignField: "_id",
            as: "read_by_users",
          },
        },
        {
          $project: {
            _id: 1,
            message: 1,
            read_by_users: {
              $map: {
                input: "$read_by_users",
                as: "user",
                in: {
                  user_id: "$$user._id",
                  full_name: "$$user.full_name",
                  profile_picture: {
                    $cond: {
                      if: { $ne: ["$$user.profile_picture", null] },
                      then: { $concat: [process.env.BASE_URL, "$$user.profile_picture"] },
                      else: null,
                    },
                  },
                  read_at: {
                    $let: {
                      vars: {
                        readInfo: {
                          $arrayElemAt: [
                            {
                              $filter: {
                                input: "$is_read_by",
                                as: "read",
                                cond: { $eq: ["$$read.user_id", "$$user._id"] },
                              },
                            },
                            0,
                          ],
                        },
                      },
                      in: "$$readInfo.read_at",
                    },
                  },
                },
              },
            },
          },
        },
        {
          $addFields: {
            read_by_users: {
              $sortArray: {
                input: "$read_by_users",
                sortBy: { read_at: -1 }  // -1 for descending order (latest first)
              }
            }
          }
        }
      ]);

      console.log(message_info)

      return socketSuccessRes("Successfully get mesage information", message_info.read_by_users);
    } catch (error) {
      console.log("=== getMessageInfo ===", error);
      return socketErrRes("Error in getMessageInfo", error);
    }
  },

  changeScreenStatus: async (data) => {
    try {
      let { user_id, screen_status, chat_room_id, socket_id } = data;

      let find_chat_room = await chat_room.findOne({
        _id: chat_room_id,
        is_deleted: false,
      });

      if (!find_chat_room) {
        return socketErrRes("Chat room not found");
      }

      if (screen_status == "true" || screen_status == true) {
        let updatedMessage = await user_session.updateOne(
          {
            user_id: user_id,
            socket_id: socket_id,
          },
          {
            $set: {
              chat_room_id: chat_room_id,
            },
          },
          { new: true }
        );
      } else {
        let updatedMessage = await user_session.updateOne(
          {
            user_id: user_id,
            socket_id: socket_id,
          },
          {
            $set: {
              chat_room_id: null,
            },
          },
          { new: true }
        );
      }

      return socketSuccessRes("Screen status changed successfully", []);
    } catch (error) {
      console.log("=== changeScreenStatus ===", error);
      return socketErrRes("Error in changeScreenStatus", error);
    }
  },

  addOrRemoveFavorites: async (data) => {
    try {
      let { chat_room_ids, user_id, is_favorite } = data;

      let userObjectId = new mongoose.Types.ObjectId(user_id);

      if (chat_room_ids.length == 0) {
        return socketErrRes("No chat room ids provided");
      }

      let findChats = await chat_room.find({
        _id: { $in: chat_room_ids },
        $or: [
          { user_id: userObjectId },
          { other_user_id: userObjectId },
          // { member_ids: userObjectId },
          { all_member_ids: userObjectId },
        ],
        is_delete_by: { $ne: new mongoose.Types.ObjectId(user_id) },
        is_deleted: false,
      });

      if (findChats.length != chat_room_ids.length) {
        return socketErrRes("Chat room not found");
      }

      let update_data = { favorites_by: user_id };

      if (is_favorite == true || is_favorite == "true") {
        await chat_room
          .updateMany({ _id: chat_room_ids }, { $push: update_data })
          .where({ favorites_by: { $ne: user_id } });

        return socketSuccessRes("Chat added to favorites successfully", {
          chat_room_ids,
          is_favorite,
        });
      } else {
        await chat_room.updateMany(
          { _id: chat_room_ids },
          { $pull: update_data }
        );

        return socketSuccessRes("Chat removed from favorites successfully", {
          chat_room_ids,
          is_favorite,
        });
      }
    } catch (error) {
      console.log("=== addOrRemoveFavorites ===", error);
      return socketErrRes("Error in addOrRemoveFavorites", error);
    }
  },

  addOrRemoveArchives: async (data) => {
    try {
      let { chat_room_ids, user_id, is_archive } = data;

      let userObjectId = new mongoose.Types.ObjectId(user_id);

      if (chat_room_ids.length == 0) {
        return socketErrRes("No chat room ids provided");
      }

      let findChats = await chat_room.find({
        _id: { $in: chat_room_ids },
        $or: [
          { user_id: userObjectId },
          { other_user_id: userObjectId },
          // { member_ids: userObjectId },
          { all_member_ids: userObjectId },
        ],
        is_delete_by: { $ne: new mongoose.Types.ObjectId(user_id) },
        is_deleted: false,
      });

      if (findChats.length != chat_room_ids.length) {
        return socketErrRes("Chat room not found");
      }

      let update_data = { archived_by: user_id };

      if (is_archive == true || is_archive == "true") {
        await chat_room
          .updateMany({ _id: chat_room_ids }, { $push: update_data })
          .where({ archived_by: { $ne: user_id } });

        await chat_room
          .updateMany(
            { _id: chat_room_ids },
            {
              $pull: {
                favorites_by: user_id,
              },
            }
          )
          .where({ favorites_by: { $eq: user_id } });

        await chat_room
          .updateMany(
            { _id: chat_room_ids },
            {
              $pull: { pinned_by: { user_id: userObjectId } },
            }
          )
          .where({ "pinned_by.user_id": { $eq: user_id } });

        return socketSuccessRes("Chat archived successfully", {
          chat_room_ids,
          is_archive,
        });
      } else {
        await chat_room.updateMany(
          { _id: chat_room_ids },
          { $pull: update_data }
        );

        return socketSuccessRes("Chat archived successfully", {
          chat_room_ids,
          is_archive,
        });
      }
    } catch (error) {
      console.log("=== addOrRemoveArchives ===", error);
      return socketErrRes("Error in addOrRemoveArchives", error);
    }
  },

  pinUnpinChatRoom: async (data) => {
    try {
      let { chat_room_ids, user_id, is_pin } = data;

      let userObjectId = new mongoose.Types.ObjectId(user_id);

      if (chat_room_ids.length == 0) {
        return socketErrorRes("No chat room ids provided");
      }

      if (chat_room_ids.length > 3) {
        return socketErrorRes("You can pin upto 3 chats");
      }

      let findChats = await chat_room.find({
        _id: { $in: chat_room_ids },
        $or: [
          { user_id: userObjectId },
          { other_user_id: userObjectId },
          // { member_ids: userObjectId },
          { all_member_ids: userObjectId },
        ],
        is_delete_by: { $ne: new mongoose.Types.ObjectId(user_id) },
        is_deleted: false,
      });

      if (findChats.length != chat_room_ids.length) {
        return socketErrorRes("Chat room not found");
      }

      let update_data = { pinned_by: { user_id, pinned_at: new Date() } };

      if (is_pin == true || is_pin == "true") {
        console.log(findChats[0].room_type);

        if (findChats[0].room_type == "personal") {
          let find_pinned_chats_count = await chat_room.countDocuments({
            room_type: "personal",
            $or: [{ user_id: userObjectId }, { other_user_id: userObjectId }],
            is_delete_by: { $ne: new mongoose.Types.ObjectId(user_id) },
            is_deleted: false,
            "pinned_by.user_id": user_id,
          });

          let total_pinned_chats =
            find_pinned_chats_count + chat_room_ids.length;

          if (total_pinned_chats > 3) {
            return socketErrorRes("You can pin upto 3 chats");
          }

          await chat_room
            .updateMany({ _id: chat_room_ids }, { $push: update_data })
            .where({ "pinned_by.user_id": { $ne: user_id } });

          await chat_room
            .updateMany(
              { _id: chat_room_ids },
              {
                $pull: {
                  favorites_by: user_id,
                },
              }
            )
            .where({ favorites_by: { $eq: user_id } });

          return socketSuccessRes("Chat pin successfully", {
            chat_room_ids,
            is_pin,
            total_pinned_chats,
          });
        } else {
          let find_pinned_chats_count = await chat_room.countDocuments({
            room_type: "group",
            all_member_ids: userObjectId,
            is_delete_by: { $ne: new mongoose.Types.ObjectId(user_id) },
            is_deleted: false,
            "pinned_by.user_id": user_id,
          });

          let total_pinned_chats =
            find_pinned_chats_count + chat_room_ids.length;

          console.log({ total_pinned_chats });

          if (total_pinned_chats > 3) {
            return socketErrorRes("You can pin upto 3 chats");
          }

          await chat_room
            .updateMany({ _id: chat_room_ids }, { $push: update_data })
            .where({ "pinned_by.user_id": { $ne: user_id } });

          await chat_room
            .updateMany(
              { _id: chat_room_ids },
              {
                $pull: {
                  favorites_by: user_id,
                },
              }
            )
            .where({ favorites_by: { $eq: user_id } });

          return socketSuccessRes("Chat pin successfully", {
            chat_room_ids,
            room_type: findChats[0].room_type,
            is_pin,
            total_pinned_chats,
          });
        }
      } else {
        await chat_room.updateMany(
          { _id: { $in: chat_room_ids } },
          { $pull: { pinned_by: { user_id: userObjectId } } }
        );
        let find_pinned_chats_count = 0;
        if (findChats[0].room_type == "personal") {
          find_pinned_chats_count = await chat_room.countDocuments({
            room_type: "personal",
            $or: [{ user_id: userObjectId }, { other_user_id: userObjectId }],
            is_delete_by: { $ne: new mongoose.Types.ObjectId(user_id) },
            is_deleted: false,
            "pinned_by.user_id": user_id,
          });
        } else {
          find_pinned_chats_count = await chat_room.countDocuments({
            room_type: "group",
            all_member_ids: userObjectId,
            is_delete_by: { $ne: new mongoose.Types.ObjectId(user_id) },
            is_deleted: false,
            "pinned_by.user_id": user_id,
          });
        }

        console.log({ find_pinned_chats_count });

        return socketSuccessRes("Chat unpin successfully", {
          chat_room_ids,
          room_type: findChats[0].room_type,
          is_pin,
          total_pinned_chats: find_pinned_chats_count,
        });
      }
    } catch (error) {
      console.log("=== pinUnpinChatRoom ===", error);
      return socketErrRes("Error in pinUnpinChatRoom", error);
    }
  },

  mediaLinksDocsMessages: async (data) => {
    try {
      let { chat_room_id, user_id, type, page = 1, limit = 10 } = data;

      let userObjectId = new mongoose.Types.ObjectId(user_id);
      let chatRoomObjectId = new mongoose.Types.ObjectId(chat_room_id);
      // let skip = (parseInt(page) - 1) * parseInt(limit);

      let findChatRoom = await chat_room.findOne({
        _id: chat_room_id,
        $or: [
          { user_id: userObjectId },
          { other_user_id: userObjectId },
          { member_ids: userObjectId },
        ],
        is_delete_by: { $ne: userObjectId },
        is_deleted: false,
      });

      if (!findChatRoom) {
        return socketErrRes("Chat room not found");
      }

      let matchStage = {
        chat_room_id: chatRoomObjectId,
        is_delete_by: { $ne: userObjectId },
        is_delete_everyone: false,
      };

      let filterStage = {};
      if (type === "media") {
        filterStage["media_file.file_type"] = {
          $in: ["image", "video", "gif", "audio"],
        };
      } else if (type === "docs") {
        filterStage["message_type"] = "document";
      } else if (type === "links") {
        filterStage["message_type"] = "link";
      }

      let pipeline;

      if (type == "links") {
        pipeline = [
          { $match: matchStage },
          { $match: filterStage }, // Filter only selected type
          { $sort: { createdAt: -1 } },
          {
            $project: {
              _id: 1,
              message: 1,
              message_type: 1,
              sender_id: 1,
              createdAt: 1,
            },
          },
        ];

        let mediaMessages = await chat.aggregate(pipeline);

        return socketSuccessRes(
          "Messages retrieved successfully",
          mediaMessages,
          { type }
        );
      } else {
        pipeline = [
          { $match: matchStage },
          {
            $unwind: {
              path: "$media_file",
              preserveNullAndEmptyArrays: false,
            },
          },
          {
            $match: {
              $or: [
                { "media_file.is_delete_everyone": false }, // Media is not deleted for everyone
                { "media_file.is_delete_by": { $ne: userObjectId } }, // Media is not deleted by the user
              ],
            },
          },
          { $match: filterStage },
          {
            $sort: {
              createdAt: -1,
              "media_file.media_date": -1,
            },
          },
          // { $skip: skip },
          // { $limit: parseInt(limit) },
          {
            $addFields: {
              "media_file.file_name": {
                $cond: [
                  { $ne: ["$media_file.file_name", null] },
                  { $concat: [process.env.BASE_URL, "$media_file.file_name"] },
                  "$media_file.file_name",
                ],
              },
              "media_file.thumbnail": {
                $cond: [
                  {
                    $and: [
                      { $ne: ["$media_file.thumbnail", null] },
                      { $eq: ["$media_file.file_type", "video"] },
                    ],
                  },
                  { $concat: [process.env.BASE_URL, "$media_file.thumbnail"] },
                  "$media_file.thumbnail",
                ],
              },
              "media_file.chat_id": "$_id",
            },
          },
          {
            $group: {
              _id: "$chat_room_id",
              result: {
                $push: type === "links" ? "$message" : "$media_file",
              },
            },
          },
        ];

        let mediaMessages = await chat.aggregate(pipeline);

        return socketSuccessRes(
          "Messages retrieved successfully",
          mediaMessages.length ? mediaMessages[0].result : [],
          { type }
        );
      }
    } catch (error) {
      console.log("=== mediaLinksDocsMessages ===", error);
      return socketErrRes("Error in mediaLinksDocsMessages", error);
    }
  },

  markAsUnread: async (data) => {
    try {
      let { chat_room_id, user_id } = data;

      let update_data = { unread_by: user_id };

      await chat_room
        .updateMany({ _id: chat_room_id }, { $push: update_data })
        .where({ unread_by: { $ne: user_id } });

      return socketSuccessRes("Marked as unread successfully", {
        chat_room_id,
        user_id,
      });
    } catch (error) {
      console.log("=== markAsUnread ===", error);
      return socketErrRes("Error in markAsUnread", error);
    }
  },

  getUserWallpaper: async (data) => {
    try {
      let { chat_room_id, user_id } = data;

      let userObjectId = new mongoose.Types.ObjectId(user_id);
      let chatRoomObjectId = new mongoose.Types.ObjectId(chat_room_id);

      // Find the chat room
      let findChatRoom = await chat_room.findOne({ _id: chatRoomObjectId });

      if (!findChatRoom) {
        return res
          .status(404)
          .json({ success: false, message: "Chat room not found" });
      }

      let is_global = true;
      let find_user = await users.findOne({
        _id: user_id,
        is_deleted: false,
      });

      // Find the theme for the user
      let userTheme = findChatRoom.themes.find(
        (theme) => theme.user_id.toString() === userObjectId.toString()
      );

      if (!userTheme) {
        if (find_user) {
          userTheme = find_user.chat_wallpaper
            ? process.env.BASE_URL + find_user.chat_wallpaper
            : null;
        }
      } else {
        userTheme = userTheme.chat_wallpaper
          ? process.env.BASE_URL + userTheme.chat_wallpaper
          : null;
        is_global = false;
      }

      let res_data = {
        user_id: user_id,
        chat_room_id: chat_room_id,
        chat_wallpaper: userTheme,
        is_global: is_global,
      };

      return socketSuccessRes("User wallpaper get successfully", res_data);
    } catch (error) {
      console.error("Error fetching user wallpaper:", error);
      return socketErrRes("Error in getUserWallpaper", error);
    }
  },

  startVideoCall: async (data) => {
    try {
      let { chat_room_id, user_id, uuid, channel_name, call_type } = data;

      let find_chat_room = await chat_room.findOne({
        _id: chat_room_id,
        is_deleted: false,
      });

      if (!find_chat_room) {
        return socketErrRes("Chat room not found");
      }

      console.log({ find_chat_room });

      let find_user = await users.findOne({
        _id: user_id,
        is_deleted: false,
      });

      if (find_chat_room.is_call_in_progress == true) {
        return socketErrorRes("Call is already in progress");
      }

      if (find_chat_room.room_type == "personal") {
        let receiver_id;

        if (find_chat_room.user_id.toString() == user_id) {
          receiver_id = find_chat_room.other_user_id;
        } else {
          receiver_id = find_chat_room.user_id;
        }

        const create_message = await chat.create({
          chat_room_id: chat_room_id,
          sender_id: user_id,
          receiver_id: receiver_id,
          message_time: new Date(),
          message_type: call_type,
          call_data: {
            call_status: "in_progress",
            call_type: call_type,
            start_time: new Date(),
            joined_users: [user_id]
          }
        });

        let res_data = {
          sender_id: user_id,
          sender_name: find_user.full_name,
          sender_profile_picture:
            find_user.profile_picture != null
              ? process.env.BASE_URL + find_user.profile_picture
              : null,
          receiver_id,
          room_type: "personal",
          chat_room_id,
          channel_name,
          create_message
        };

        let noti_title = find_user.full_name;

        let noti_msg = "Incomming video call";

        let noti_image = null;

        if (find_user.profile_picture != null) {
          noti_image = process.env.BASE_URL + find_user.profile_picture;
        }

        let noti_for = "video_call";

        if (call_type == "audio_call") {
          noti_for = "audio_call"
        }

        let notiData = {
          call_type,
          noti_msg,
          noti_title,
          noti_for,
          noti_image,
          room_type: "personal",
          chat_room_id: chat_room_id,
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

        // await chat_room.updateOne(
        //   { _id: chat_room_id },
        //   {
        //     $set: {
        //       is_call_in_progress: true,
        //       joined_users_in_call: [user_id],
        //     },
        //   }
        // );

        await chat_room.updateOne(
          { _id: chat_room_id },
          {
            $set: {
              is_call_in_progress: true,
              // joined_users_in_call: [
              //   {
              //     user_id,
              //     uuid: uuid || 0, // default 0 if not provided
              //   },
              // ],
            },
          }
        );

        return socketSuccessRes("Video call started succesfully", res_data);
      } else {
        let noti_title = find_chat_room.group_name;

        let noti_msg = `Incomming video call from ${find_user.full_name}`;

        let noti_image = null;

        if (find_chat_room.group_image != null) {
          noti_image = process.env.BASE_URL + find_chat_room.group_image;
        }

        if (find_user.profile_picture != null) {
          sender_image = process.env.BASE_URL + find_user.profile_picture;
        }

        let receiver_ids = find_chat_room.member_ids.filter(
          (id) => String(id) !== String(user_id)
        );

        const create_message = await chat.create({
          chat_room_id: chat_room_id,
          sender_id: user_id,
          receiver_ids: receiver_ids,
          message_time: new Date(),
          message_type: call_type,
          call_data: {
            call_status: "in_progress",
            call_type: call_type,
            start_time: new Date(),
            joined_users: [user_id]
          }
        });

        console.log({ receiver_ids });

        let noti_for = "video_call";

        if (call_type == "audio_call") {
          noti_for = "audio_call"
        }

        receiver_ids.forEach(async (receiver_id) => {

          let notiData = {
            noti_msg,
            noti_title,
            noti_for,
            noti_image,
            room_type: "group",
            chat_room_id: chat_room_id,
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

        await chat_room.updateOne(
          { _id: chat_room_id },
          {
            $set: {
              is_call_in_progress: true,
              // joined_users_in_call: [
              //   {
              //     user_id,
              //     uuid: uuid || 0, // default 0 if not provided
              //   },
              // ],
            },
          }
        );

        let res_data = {
          call_type,
          sender_id: user_id,
          sender_name: find_user.full_name,
          sender_profile_picture:
            find_user.profile_picture != null
              ? process.env.BASE_URL + find_user.profile_picture
              : null,
          room_type: "group",
          receiver_id: receiver_ids,
          chat_room_id,
          channel_name,
          create_message
        };

        return socketSuccessRes("Video call started succesfully", res_data);
      }
    } catch (error) {
      console.error("Error fetching user wallpaper:", error);
      return socketErrRes("Error in getUserWallpaper", error);
    }
  },

  endVideoCall: async (data) => {
    try {
      let { chat_room_id, user_id } = data;

      if (!chat_room_id) {
        return socketErrRes("Chat room is required");
      }

      let find_chat_room = await chat_room.findOne({
        _id: chat_room_id,
        is_deleted: false,
      });

      if (!find_chat_room) {
        return socketErrRes("Chat room not found");
      }

      let receiver_id;

      if (find_chat_room.user_id == user_id) {
        receiver_id = find_chat_room.other_user_id;
      } else {
        receiver_id = find_chat_room.user_id;
      }

      await chat_room.updateOne(
        { _id: chat_room_id },
        {
          $set: {
            is_call_in_progress: false,
            joined_users_in_call: [],
          },
        }
      );

      return socketSuccessRes("Video call ended succesfully", {
        ...find_chat_room._doc,
        receiver_id,
      });
    } catch (error) {
      console.error("Error in endVideoCall:", error);
      return socketErrRes("Error in endVideoCall", error);
    }
  },

  joinCall: async (data) => {
    try {
      let { chat_room_id, user_id, uuid } = data;

      let find_chat_room = await chat_room.findOne({
        _id: chat_room_id,
        is_deleted: false,
      });

      if (!find_chat_room) {
        return socketErrRes("Chat room not found");
      }

      console.log(find_chat_room.is_call_in_progress);

      if (find_chat_room.is_call_in_progress != true) {
        return socketErrRes("Call is ended");
      }

      let find_call_chat = await chat.findOne({
        chat_room_id: chat_room_id,
        message_type: { $in: ["video_call", "audio_call"] },
      }).sort({ createdAt: -1 })

      if (find_call_chat && find_call_chat.call_data.call_status == "in_progress") {
        await chat.updateOne(
          { _id: find_call_chat._id },
          {
            $addToSet: {
              "call_data.joined_users": user_id
            }
          }
        );
      }

      const joined_users_in_call = find_chat_room.joined_users_in_call.map(
        (id) => id.toString()
      );

      if (joined_users_in_call.includes(user_id)) {
        return socketErrorRes("User alredy joined with other device");
      } else {
        await chat_room.updateOne(
          { _id: chat_room_id },
          {
            $push: {
              // joined_users_in_call: user_id,
              joined_users_in_call: [
                {
                  user_id,
                  uuid: uuid || 0, // default 0 if not provided
                },
              ],
            },
          }
        );

        let find_user = await users.findOne({
          _id: user_id,
          is_deleted: false,
        });

        if (!find_user) {
          return socketErrRes("User not found");
        }

        let res_data = {
          uuid: uuid,
          user_id: find_user._id,
          full_name: find_user.full_name,
          profile_picture: find_user.profile_picture
            ? process.env.BASE_URL + find_user.profile_picture
            : null,
        };

        return socketSuccessRes("You joined succesfully", res_data);
      }

    } catch (error) {
      console.error("Error joinCall:", error);
      return socketErrRes("Error in joinCall", error);
    }
  },

  joinedMembersInCall: async (data) => {
    try {
      let { chat_room_id, uuid } = data;

      let find_chat_room = await chat_room.findOne({
        _id: chat_room_id,
        is_deleted: false,
      });

      if (!find_chat_room) {
        return socketErrRes("Chat room not found");
      }

      if (find_chat_room.is_call_in_progress != true) {
        return socketErrRes("Call is ended now");
      }

      let matchedMember = find_chat_room.joined_users_in_call.find(
        (member) => member.uuid == uuid
      );

      console.log(find_chat_room.joined_users_in_call);
      console.log({ matchedMember });

      if (!matchedMember) {
        return socketErrRes("User with given UUID not found in call");
      }

      // Step 2: Fetch user details using user_id
      let find_user = await users.findOne({
        _id: matchedMember.user_id,
        is_deleted: false,
      });

      if (!find_user) {
        return socketErrRes("User not found");
      }

      let res_data = {
        uuid: uuid,
        user_id: find_user._id,
        full_name: find_user.full_name,
        profile_picture: find_user.profile_picture
          ? process.env.BASE_URL + find_user.profile_picture
          : null,
      };

      return socketSuccessRes("List get successfully", res_data);
    } catch (error) {
      console.error("Error joinCall:", error);
      return socketErrRes("Error in joinCall", error);
    }
  },

  leaveCall: async (data, v1version) => {
    try {
      let { chat_room_id, uuid, missed_call } = data;

      let find_chat_room = await chat_room.findOne({
        _id: chat_room_id,
        is_deleted: false,
      });

      if (!find_chat_room) {
        return socketErrRes("Chat room not found");
      }

      if (find_chat_room.is_call_in_progress != true) {
        return socketErrRes("Call is ended now");
      }

      const joined_uuids_in_call = find_chat_room.joined_users_in_call.find(
        (user) => user.uuid
      );

      console.log("joined_user", find_chat_room.joined_users_in_call)
      console.log({ joined_uuids_in_call })

      let find_user = await users.findOne({
        _id: joined_uuids_in_call.user_id
      })


      let call_status = "end"

      if (missed_call == true) {
        if (find_chat_room.room_type == "personal") {
          let receiver_id;

          if (find_chat_room.user_id.toString() == joined_uuids_in_call.user_id) {
            receiver_id = find_chat_room.other_user_id;
          } else {
            receiver_id = find_chat_room.user_id;
          }

          let noti_title = find_user.full_name;

          let noti_msg = "Missed call";

          let noti_image = null;

          if (find_user.profile_picture != null) {
            noti_image = process.env.BASE_URL + find_user.profile_picture;
          }

          let noti_for = "missed_call";

          let notiData = {
            call_type: "missed_call",
            noti_msg,
            noti_title,
            noti_for,
            noti_image,
            room_type: "personal",
            chat_room_id: chat_room_id,
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
          let noti_title = find_chat_room.group_name;

          let noti_msg = `Missed call from ${find_user.full_name}`;

          let noti_image = null;

          if (find_chat_room.group_image != null) {
            noti_image = process.env.BASE_URL + find_chat_room.group_image;
          }

          if (find_user.profile_picture != null) {
            sender_image = process.env.BASE_URL + find_user.profile_picture;
          }

          let receiver_ids = find_chat_room.member_ids.filter(
            (id) => String(id) !== String(find_user._id)
          );

          console.log({ receiver_ids });

          let noti_for = "missed_call";

          receiver_ids.forEach(async (receiver_id) => {

            let notiData = {
              call_type: "missed_call",
              noti_msg,
              noti_title,
              noti_for,
              noti_image,
              room_type: "group",
              chat_room_id: chat_room_id,
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
        }
        // call_status = "missed_call"
      }

      await chat_room.updateOne(
        { _id: chat_room_id },
        {
          $pull: {
            joined_users_in_call: {
              uuid: uuid, // match the user_id field inside the object
            },
          },
        }
      );

      let find_updated_chat_room = await chat_room.findOne({
        _id: chat_room_id,
        is_deleted: false,
      });

      let is_end_call = false;
      let chat_id;

      console.log("bc", find_updated_chat_room.joined_users_in_call.length)

      if (find_updated_chat_room.joined_users_in_call.length <= 1) {
        await chat_room.updateOne(
          { _id: chat_room_id },
          {
            $set: {
              is_call_in_progress: false,
              joined_users_in_call: [],
            },
          }
        );

        let find_call_chat = await chat.findOne({
          chat_room_id: chat_room_id,
          message_type: { $in: ["video_call", "audio_call"] }
        }).sort({ createdAt: -1 })

        let joined_users = find_call_chat.call_data.joined_users.map((id) => id.toString());

        await chat.updateOne(
          { _id: find_call_chat._id },
          {
            $set: {
              "call_data.call_status": call_status,
              "call_data.end_time": new Date()
            }
          }
        );

        is_end_call = true;
        chat_id = find_call_chat._id;

        console.log(find_chat_room.room_type == "personal")


        if (find_chat_room.room_type == "personal") {

          let status_data = {
            chat_id: chat_id,
            user_id: find_call_chat.sender_id,
          }

          let get_sender_data = await getChatData(status_data)



          v1version
            .to(find_call_chat.sender_id.toString())
            .emit("callStatusChange", { chat_id: chat_id, ...get_sender_data.data.call_data });


          let other_status_data = {
            chat_id: chat_id,
            user_id: find_call_chat.receiver_id,
          }

          let get_receiver_data = await getChatData(other_status_data)

          if (!joined_users.includes(find_call_chat.receiver_id.toString())) {
            get_receiver_data.data.call_data.call_status = "missed_call"
          } else {
            get_receiver_data.data.call_data.call_status = "end"
          }

          v1version
            .to(find_call_chat.receiver_id.toString())
            .emit("callStatusChange", { chat_id: chat_id, ...get_receiver_data.data.call_data });
        } else {
          let status_data = {
            chat_id: chat_id,
            user_id: find_call_chat.sender_id,
          }

          let get_sender_data = await getChatData(status_data)

          v1version
            .to(find_call_chat.sender_id.toString())
            .emit("callStatusChange", { chat_id: chat_id, ...get_sender_data.data.call_data });

          for (const member_id of find_call_chat.receiver_ids) {
            let other_status_data = {
              chat_id: chat_id,
              user_id: member_id,
            }

            let get_receiver_data = await getChatData(other_status_data)

            console.log("call data", { chat_id: chat_id, ...get_receiver_data.data.call_data })

            if (!joined_users.includes(member_id.toString())) {
              get_receiver_data.data.call_data.call_status = "missed_call"
            } else {
              get_receiver_data.data.call_data.call_status = "end"
            }

            v1version
              .to(member_id.toString())
              .emit("callStatusChange", { chat_id: chat_id, ...get_receiver_data.data.call_data })
          }
        }
      }

      return socketSuccessRes("You leaved succesfully", { is_end_call, chat_id });
    } catch (error) {
      console.error("Error userRespondCall:", error);
      return socketErrRes("Error in userRespondCall", error);
    }
  },

  userRespondCall: async (data) => {
    try {
      // let { chat_room_id, user_id } = data;

      return socketSuccessRes("user respond call succesfully", data);
    } catch (error) {
      console.error("Error userRespondCall:", error);
      return socketErrRes("Error in userRespondCall", error);
    }
  },
};
