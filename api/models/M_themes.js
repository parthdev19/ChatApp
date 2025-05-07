const mongoose = require("mongoose");

const themesSchema = new mongoose.Schema(
  {
    theme:{
        type: String,
        required: true
    },
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model("themes", themesSchema);
