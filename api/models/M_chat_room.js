const mongoose = require("mongoose");

const themesSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
    required: [true, "User Id is required."],
  },
  chat_wallpaper: {
    type: String,
  },
});

const chatRoomSchema = new mongoose.Schema(
  {
    room_type: {
      type: String,
      enum: ["personal", "group"],
      required: [true, "Room type is required."],
    },
    is_call_in_progress: {
      type: Boolean,
      enum: [true, false],
      default: false,
    },
    joined_users_in_call: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "users",
    },
    joined_users_in_call: [
      {
        user_id: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
        uuid: { type: Number, default: 0 },
      },
    ],
    //group
    group_name: {
      type: String,
    },
    group_description: {
      type: String,
    },
    group_image: {
      type: String,
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
    },
    member_ids: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "users",
    },
    all_member_ids: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "users",
    },
    admin_ids: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "users",
    },
    // =====

    //personal
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
    },
    other_user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
    },
    //==========

    //common
    is_deleted: {
      type: Boolean,
      enum: [true, false],
      default: false,
    },
    is_delete_by: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
      },
    ],
    muted_by: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
      },
    ],
    favorites_by: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
      },
    ],
    archived_by: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
      },
    ],
    // pinned_by: [
    //   {
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref: "users",
    //   },
    // ],
    pinned_by: [
      {
        user_id: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
        pinned_at: { type: Date, default: Date.now },
      },
    ],
    unread_by: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
      },
    ],
    themes: {
      type: [themesSchema],
      default: [],
    },
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model("chat_room", chatRoomSchema);
