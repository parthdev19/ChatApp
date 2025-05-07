const mongoose = require("mongoose");

const reactionSchema = new mongoose.Schema(
  {
    chat_room_id: {
      type: mongoose.Schema.Types.ObjectId, // Reference to the chat room
      ref: "chat_rooms",
      required: true,
    },
    chat_id: {
      type: mongoose.Schema.Types.ObjectId, // Reference to the chat message
      ref: "chat",
      required: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId, // User who reacted
      ref: "users",
      required: true,
    },
    emoji: {
      type: String, // The emoji used in the reaction
      required: true,
    },
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model("chat_reactions", reactionSchema);
