const mongoose = require("mongoose");
const { encryptMessage, decryptMessage } = require("../../utils/secure_pwd");
const { json } = require("express");

const mediaFileImage = new mongoose.Schema([
  {
    file_type: {
      type: String,
      enum: [
        "image",
        "video",
        "gif",
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
        "emoji",
      ],
      required: [true, "File type is required."],
    },
    file_name: {
      type: String,
      default: null,
    },
    original_name: {
      type: String,
      default: null,
    },
    file_size: {
      type: Number,
      default: 0,
    },
    thumbnail: {
      type: String,
      default: null,
    },
    media_date: {
      type: Date,
      default: Date.now,
    },
    is_deleted_by: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
      },
    ],
    deleted_everyone: {
      type: Boolean,
      enum: [true, false],
      default: false,
    },
  },
]);

const repliedMedia = new mongoose.Schema([
  {
    media_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "chat",
    },
    file_type: {
      type: String,
      enum: [
        "image",
        "video",
        "audio",
        "gif",
        "doc",
        "txt",
        "pdf",
        "zip",
        "emoji",
      ],
      required: [true, "File type is required."],
    },
    file_name: {
      type: String,
      default: null,
    },
    original_name: {
      type: String,
      default: null,
    },
    file_size: {
      type: Number,
      default: 0,
    },
    thumbnail: {
      type: String,
      default: null,
    },
    deleted_everyone: {
      type: Boolean,
      enum: [true, false],
      default: false,
    },
    is_deleted_by: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
      },
    ],
  },
]);

const pollSchema = new mongoose.Schema({
  question: {
    type: String,
    required: [true, "Poll question is required."],
  },
  options: [
    {
      _id: {
        type: mongoose.Schema.Types.ObjectId, // MongoDB automatically generates an ID for each option
        auto: true,
      },
      text: {
        type: String,
        required: [true, "Option text is required."],
      },
    },
  ],
  is_multiple: {
    type: Boolean,
    default: false, // true - multiple options can be selected, false - single option
  },
  voters: [
    {
      user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
      },
      option_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "poll.options",
      },
      vote_time: {
        type: Date,
        default: Date.now,
      },
    },
  ],
});

const locationSchema = new mongoose.Schema({
  type: {
    type: String,
    default: "Point",
  },
  coordinates: {
    type: [Number],
    required: [true, "coordinates is required."], // [long , lat]
  },
});

const callSchema = new mongoose.Schema({
  call_type: {
    type: String,
    enum: ["video_call", "audio_call"],
    required: [true, "Call type required"],
  },
  call_status: {
    type: String,
    enum: ["in_progress", "end", "missed_call"],
    // default:"in_progress"
  },
  start_time: {
    type: Date,
  },
  end_time: {
    type: Date,
  },
  joined_users: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: "users",
  },
});

const chatSchema = new mongoose.Schema(
  {
    chat_room_id: {
      // chat room id  needed when it's individual messages
      type: mongoose.Schema.Types.ObjectId,
      ref: "chat_room",
      required: true,
    },
    reply_message_id: {
      // reply message id is for any perticular message reply (parent message id)
      type: mongoose.Schema.Types.ObjectId,
      ref: "chat",
    },
    sender_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: [true, "Sender id is required."],
    },
    //personal chat
    receiver_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
    },
    // group chat
    receiver_ids: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "users",
    },
    message_time: {
      type: Date,
      default: Date.now, // Date.now is automatically set to the current date and time when a new document is created.
      required: [true, "Message time is required."],
    },
    message: {
      type: String,
      // set: function (value) {
      //   const encrypted = encryptMessage(value);
      //   return encrypted; // Store encrypted object as JSON
      // },
      // get: function (value) {
      //   const decrypted = decryptMessage(value);
      //   // const { encryptedData, iv } = JSON.parse(value);
      //   return decryptMessage(decrypted);
      // },
    },
    message_type: {
      type: String,
      enum: [
        "text",
        "link",
        "media",
        "emoji",
        "document",
        "contact",
        "media_with_text",
        "poll",
        "create_group",
        "add_member",
        "make_admin",
        "remove_admin",
        "remove_member",
        "exit_group",
        "clear_chat",
        "location",
        "video_call",
        "audio_call"
      ],
      required: [true, "Message type is required."],
    },
    contact: { type: mongoose.Schema.Types.Mixed, default: null }, // Stores JSON
    media_file: {
      type: [mediaFileImage],
    },
    call_data: {
      type: callSchema,
    },
    poll: {
      type: pollSchema,
    },
    location: {
      type: locationSchema,
    },
    is_read: {
      type: String,
      enum: ["seen", "sent"],
      default: "sent", // true-read, false-unread
    },
    is_pin: {
      type: Boolean,
      enum: [true, false],
      default: false, // true-read, false-unread
    },
    pin_user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
    },
    replied_message_media: {
      type: [repliedMedia],
    },
    is_edited: {
      type: Boolean,
      enum: [true, false],
      default: false, // true-read, false-unread
    },
    is_forwarded: {
      type: Boolean,
      enum: [true, false],
      default: false, // true-forward, false-not-forward
    },
    is_delete_everyone: {
      //v2
      type: Boolean,
      enum: [true, false],
      default: false,
    },
    // group chat
    // for add member ,remove member ,make admin
    user_ids: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
      },
    ],
    is_read_by: [
      {
        user_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "users",
        },
        read_at: {
          type: Date,
          // default: Date.now,
        },
      },
    ],
    stared_by: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
      },
    ],
    is_delete_by: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
      },
    ],
  },
  {
    timestamps: true,
    versionKey: false,
    // toJSON: { getters: true }, // Ensure getters apply in JSON responses
    // toObject: { getters: true },
  }
);

// chatSchema.path("message").get((value) => {
//   const decrypted = decryptMessage(value);
//   return decrypted;
// });

// chatSchema.virtual("decryptedMessage").get(function () {
//   return decryptMessage(this.message); // Call once
// });

chatSchema.set("toJSON", { getters: true, setters: true });
chatSchema.set("toObject", { getters: true, setters: true });

module.exports = mongoose.model("chat", chatSchema);
