const chat_room = require("./../../api/models/M_chat_room");
const chat = require("./../../api/models/M_chat");
const users = require("./../../api/models/M_user");
const user_session = require("./../../api/models/M_user_session");
const chat_reaction = require("./../../api/models/M_chat_reaction");

const mongoose = require("mongoose");
const os = require("os");


const path = require("path");
const { unlink } = require("fs");
const outputPath = path.join(__dirname, "../../");
const { dateTime } = require("../../utils/date_time");

const {
  socketErrorRes,
  socketErrRes,
  socketSuccessRes,
  socketMultiSuccessRes,
} = require("../../utils/common_fun");

const { changeScreenStatus } = require("./common");

module.exports = {
  setSocketId: async (data) => {
    try {
      const { user_id, device_token, socket_id } = data;

      const user = await users.findOne({ _id: user_id });

      if (user) {
        let update_user = await user_session.updateOne(
          {
            user_id: user_id,
            device_token: device_token,
          },
          {
            $set: {
              socket_id: socket_id,
              is_active: true,
            },
          },
          {
            new: true,
          }
        );

        return socketSuccessRes("Socket id set successfully!", data);
      } else {
        return socketErrorRes("User not found!", null);
      }
    } catch (error) {
      console.log("setSocketId error", error.message);
      socketErrorRes("Something went wrong");
    }
  },

  disconnectSocket: async (data, v1version) => {
    try {
      let { socket_id } = data;

      let find_user_session = await user_session.findOne({
        socket_id: socket_id,
        is_deleted: false,
      });

      console.log({ find_user_session });

      if (find_user_session) {
        let find_user = await users.findOne({
          _id: find_user_session.user_id,
          is_deleted: false,
        });

        if (find_user) {
          let user_id = find_user._id;
          let updatedMessage = await user_session.updateOne(
            {
              _id: find_user_session._id,
            },
            {
              $set: {
                is_active: false,
                socket_id: null,
                chat_room_id: null,
              },
            },
            { new: true }
          );

          if (find_user_session.chat_room_id != null) {
            let find_chat_room = await chat_room.findOne({
              _id: find_user_session.chat_room_id,
              is_deleted: false,
            });

            if (find_chat_room) {
              let user_is_online_in_chat_room = await user_session.find({
                user_id: find_user._id,
                chat_room_id: find_chat_room._id,
                socket_id: { $ne: socket_id },
                is_active: true,
                is_deleted: false,
              });

              if (user_is_online_in_chat_room.length == 0) {
                let change_status_data = {
                  chat_room_id: find_chat_room._id,
                  screen_status: false,
                  user_id: find_user._id,
                  socket_id: socket_id,
                };

                let change_screen_status = await changeScreenStatus(
                  change_status_data
                );

                if (change_screen_status.success) {
                  v1version
                    .to(find_chat_room._id.toString())
                    .emit("changeScreenStatus", change_screen_status);
                }
              }
            }
          }

          let user_is_online = await user_session.find({
            user_id: find_user._id,
            is_active: true,
            is_deleted: false,
          });

          if (user_is_online.length == 0) {
            let update_user = await users.updateOne(
              {
                _id: find_user._id,
              },
              {
                $set: {
                  is_online: false,
                },
              },
              { new: true }
            );

            return socketSuccessRes("User is offline", { user_id });
          } else {
            return socketErrorRes("User is online in other device", {
              user_id,
            });
          }
        } else {
          return socketErrorRes("User not found");
        }
      } else {
        return socketErrorRes("User session not found");
      }
    } catch (error) {
      console.log("error", error);
      return socketErrRes("Somthing went wrong", error);
    }
  },

  checkUserIsOnline: async (data) => {
    try {
      let { user_id } = data;

      let findUser = await users.findOne({
        _id: user_id,
        is_deleted: false,
        is_self_delete: false,
      });

      if (findUser) {
        let user_is_online = await user_session.find({
          user_id: findUser._id,
          is_active: true,
          is_deleted: false,
        });

        if (user_is_online.length > 0) {
          return socketSuccessRes("User is online", { user_id });
        } else {
          return socketSuccessRes("User is offline", { user_id });
        }
      } else {
        return socketErrorRes("User not found");
      }
    } catch (error) {
      console.log("error", error);
      return socketErrRes("Somthing went wrong", error);
    }
  },
};
