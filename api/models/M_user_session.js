const mongoose = require("mongoose"),
  Schema = mongoose.Schema;

const userSessionSchema = new Schema(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    device_token: {
      type: String,
      required: [true, "Device token is required."],
    },
    auth_token: {
      type: String,
      required: false,
    },
    device_type: {
      type: String,
      enum: ["ios", "android", "web"],
      required: [true, "Device type is required."],
    },
    chat_room_id: {
      type: Schema.Types.ObjectId,
      ref: "chat_rooms",
      default: null
    },
    is_deleted: {
      type: Boolean,
      required: true,
      default: false,
    },
    socket_id: {
      type: String, //store socket ID,
      default: null,
    },
    is_active: {
      type: Boolean,
      required: true,
      default: true,
    },
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model("user_session", userSessionSchema);
