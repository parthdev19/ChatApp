const users = require("./../../../models/M_user");
const chat_room = require("./../../../models/M_chat_room");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const fs = require("fs");
const outputPath = path.join(__dirname, "../../../../");

const {
  successRes,
  errorRes,
  multiSuccessRes,
} = require("../../../../utils/common_fun");

const socket = require("../../../../socket/config/socket");
const io = socket.getIO();
const v1version = io.of("/v1");

const uploadGroupImage = async (req, res) => {
  try {
    const files = req.files.group_image;

    if (files) {
      const file_extension = path.extname(files.originalFilename);

      const group_image = `${uuidv4()}${file_extension}`;

      const savePath = path.join(
        __dirname,
        `./../../../../public/group_image/${group_image}`
      );

      const mediaFolder = path.join(outputPath, "public/group_image");

      // Ensure the directory exists
      if (!fs.existsSync(mediaFolder)) {
        fs.mkdirSync(mediaFolder, { recursive: true });
      }

      await fs.readFile(files.path, function (err, data) {
        if (err) throw err;

        fs.writeFile(savePath, data, function (err) {
          if (err) throw err;
        });
      });

      const resData = {
        group_image: `group_image/${group_image}`,
        group_image_url: process.env.BASE_URL + `group_image/${group_image}`,
      };

      return successRes(res, "Group image uploaded successfully", resData);
    }
  } catch (error) {
    console.log("Error : ", error);
    return errorRes(res, "Internal server error");
  }
};

const changeGroupIcon = async (req, res) => {
  try {
    let user_id = req.user._id;

    const { group_id, group_image } = req.body;

    if (!group_image) {
      return errorRes(res, "Group image is required");
    }

    let find_user = await users.findOne({
      _id: user_id,
      is_deleted: false,
    });

    if (!find_user) {
      return errorRes(res, "User not found");
    }

    let find_group = await chat_room.findOne({
      _id: group_id,
      is_deleted: false,
    });

    if (!find_group) {
      return errorRes(res, "Group not found");
    }

    if (!find_group.admin_ids.includes(user_id)) {
      return errorRes(res, "Only admin can change group icon");
    }

    let update_group = await chat_room.findByIdAndUpdate(group_id, {
      $set: {
        group_image: group_image,
      },
    });

    if (!update_group) {
      return errorRes(res, "Failed to change group icon");
    } else {
      if (group_image) {
        const removeMediaPath = path.join(
          __dirname + `./../../../../public/${find_group.group_image}`
        );
        console.log({ removeMediaPath });
        if (fs.existsSync(removeMediaPath)) {
          fs.unlinkSync(removeMediaPath);
        }
      }

      const resData = {
        group_id: group_id,
        group_image: process.env.BASE_URL + group_image,
      };

      v1version.emit("groupImgChanged", resData);

      return successRes(res, "Group icon changed successfully", resData);
    }
  } catch (error) {
    console.log("Error : ", error);
    return errorRes(res, "Internal server error");
  }
};

const editGroup = async (req, res) => {
  try {
    let user_id = req.user._id;

    const { group_id, group_name, group_description } = req.body;

    let find_user = await users.findOne({
      _id: user_id,
      is_deleted: false,
    });

    if (!find_user) {
      return errorRes(res, "User not found");
    }

    let find_group = await chat_room.findOne({
      _id: group_id,
      is_deleted: false,
    });

    if (!find_group) {
      return errorRes(res, "Group not found");
    }

    if (!find_group.admin_ids.includes(user_id)) {
      return errorRes(res, "Only admin can change group details");
    }

    let update_data = {
      group_name: group_name,
      group_description: group_description,
    };

    let update_group = await chat_room.findByIdAndUpdate(
      group_id,
      {
        $set: update_data,
      },
      { new: true }
    );

    if (!update_group) {
      return errorRes(res, "Failed to edit group details");
    } else {
      return successRes(res, "Group details edited successfully", update_group);
    }
  } catch (error) {
    console.log("Error : ", error);
    return errorRes(res, "Internal server error");
  }
};

const userListForGroup = async (req, res) => {
  try {
    let user_id = req.user._id;

    let { page = 1, limit = 10, group_id, search = "" } = req.body;

    let find_group = await chat_room.findOne({
      _id: group_id,
      is_deleted: false,
    });

    if (!find_group) {
      return errorRes(res, "Group not found");
    }

    let pipeline = [
      {
        $match: {
          _id: { $nin: find_group.member_ids },
          user_type: "user",
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
          }
        },
      },
      {
        $sort: {
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
          _id: { $nin: find_group.member_ids },
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

module.exports = {
  uploadGroupImage,
  changeGroupIcon,
  editGroup,
  userListForGroup
};
