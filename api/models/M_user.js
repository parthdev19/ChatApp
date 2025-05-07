const mongoose = require("mongoose");
const { decryptMessage } = require("../../utils/secure_pwd");

const usersSchema = new mongoose.Schema(
  {
    user_type: {
      type: String,
      enum: ["admin", "user","ai"],
      default: "user",
    },
    full_name: {
      type: String,
      default: null,
    },
    email_address: {
      type: String,
      trim: true,
      index: true,
      lowercase: true,
      required: [true, "Email address is required."],
    },
    password: {
      type: String,
      default: null,
    },
    profile_picture: {
      type: String,
      default: null,
    },
    is_self_delete: {
      type: Boolean,
      enum: [true, false],
      default: false,
    },
    is_online: {
      type: Boolean,
      enum: [true, false],
      default: true, // true-online, false-Not online
    },
    otp: {
      type: Number,
      default: null, // one time password for email verification
    },
    otp_expire_time: {
      type: Date,
      default: null, // when otp expires
    },
    is_deleted: {
      type: Boolean,
      enum: [true, false],
      default: false, // true-deleted, false-Not_deleted
    },
    chat_wallpaper: {
      type: String,
      // default: process.env.DEFAULT_WALLPAPER,
      default: null,
    },
  },
  { timestamps: true, versionKey: false }
);

// usersSchema.path("password").get((value) => {
//   const decrypted = decryptMessage(value.toString());
//   return decrypted;
// });

// usersSchema.path("profile_picture").get((value) => {
//   if (value != null) {
//     return process.env.BASE_URL + value;
//   } else {
//     return value;
//   }
// });

// usersSchema.set("toJSON", { getters: true, setters: true });
// usersSchema.set("toObject", { getters: true, setters: true });

module.exports = mongoose.model("users", usersSchema);
