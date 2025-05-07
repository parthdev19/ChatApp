const {
  setSocketId,
  disconnectSocket,
  checkUserIsOnline,
} = require("./connect");

const {
  createRoom,
  sendMessage,
  forwardMessage,
  forwardMediaMessage,
  getAllMessage,
} = require("./chat");

const {
  createGroup,
  getGroupDetails,
  getAllGroupMessage,
  sendGroupMessage,
  forwardMessageToGroup,
  forwardMediaMessageToGroup,
  addMemberToGroup,
  removeMemberFromGroup,
  makeGroupAdmin,
  dismissFromAdmin,
  exitGroup,
} = require("./group");

const {
  chatUserList,
  getChatRoomData,
  getChatData,
  voteInPoll,
  pollVoteDetails,
  userIsTyping,
  starredMessageList,
  getPinnedMessage,
  addReaction,
  reactionList,
  removeReaction,
  pinMessage,
  unPinMessage,
  deleteChatRoom,
  clearChat,
  starredMessage,
  unStarAllMessage,
  muteUnmuteChat,
  editChat,
  deleteChat,
  deleteForEveryone,
  deleteMediaChat,
  deleteMediaChatEveryOne,
  readMessage,
  changeScreenStatus,
  addOrRemoveArchives,
  addOrRemoveFavorites,
  pinUnpinChatRoom,
  mediaLinksDocsMessages,
  markAsUnread,
  searchAlldata,
  getUserWallpaper,
  startVideoCall,
  userRespondCall,
  endVideoCall,
  joinCall,
  leaveCall,
  joinedMembersInCall,
  getMessageInfo
} = require("./common");

module.exports = function (io) {
  let v1version = io.of("/v1");
  v1version.on("connection", (socket) => {
    console.log("Socket connected v1.....", socket.id);

    ///////////////////////////  CONNECTION   ////////////////////////////////////////////////////

    // {
    //   "user_id": "6787605d3f83a0c9d66a92d9",
    //     "device_token": "fpg8o2n2Qlu2S1J1ewoE7U:APA91bGYQiOi_BU-_QIB9aNnHWneu1SmeaQ_F4mLKwDZRs5cCdaGBDWltBGtauKa2PKt1zdl39HV6-sOU7IEuuhU1-HcqsRwYGf0eQm_4oeXDOwR1obRJaU"
    // }
    socket.on("setSocketId", async (data) => {
      try {
        console.log("setSocketId  call ::  ", data);

        let socket_id = socket.id;

        let socket_data = {
          ...data,
          socket_id,
        };

        let setSocketData = await setSocketId(socket_data);
        socket.join(socket_data.user_id);
        socket.emit("setSocketId", setSocketData);

        let find_user_online = await checkUserIsOnline(socket_data);

        if (find_user_online.success) {
          v1version.emit("userIsOnline", find_user_online);
        }
      } catch (error) {
        console.log("=== setSocketId ===", error);
      }
    });

    socket.on("disconnect", async (data) => {
      try {
        console.log(" -----------  disconnect  -----------  ", socket.id);

        let data = {
          socket_id: socket.id,
        };

        let disconnect_user = await disconnectSocket(data, v1version);

        if (disconnect_user.success) {
          console.log({ disconnect_user });
          v1version.emit("userIsOffline", disconnect_user);
        }
      } catch (error) {
        console.log("=== disconnect ===", error);
      }
    });

    ////////////////////////////  PERSONAL CHAT  //////////////////////////////////////////////////////

    //   {
    //     "user_id":"678f6b5b57648569a0f2bd1f",
    //     "other_user_id":"678f6ae757648569a0f2bd1b"
    // }
    socket.on("createRoom", async (data) => {
      try {
        console.log("createRoom  on ::  ", data);

        let create_room = await createRoom(data);

        if (create_room.success) {
          socket.join(data.user_id);
          socket.join(create_room.data._id.toString());
        }

        socket.emit("createRoom", create_room);
      } catch (error) {
        console.log("=== createRoom ===", error);
      }
    });

    //   {
    //     "chat_room_id": "6790c46eb7c45d37fbbf5a8c",
    //     "sender_id": "678f6b5b57648569a0f2bd1f",
    //     "receiver_id": "678f6ae757648569a0f2bd1b",
    //     // "message": "day is awesome",
    //     "message_type": "media", //"text", "link", "media", "emoji", "media_with_text", "poll"
    //     // "poll":{
    //     //     "question":"are you fine now",
    //     //     "options":[
    //     //         {
    //     //             "text":"yahh"
    //     //         },
    //     //         {
    //     //             "text":"not yet"
    //     //         },
    //     //         {
    //     //             "text":"yes"
    //     //         }
    //     //     ],
    //     //     "is_multiple":false
    //     // }
    //     // "reply_message_id": "6792109e2fd542f30b44b743",
    //     // "replied_message_media": {
    //     //     "file_type": "video",
    //     //     "file_name": "http://192.168.29.100:4500/public/chat_media/6214_1737625370006.mp4",
    //     //     "thumbnail": "http://192.168.29.100:4500/public/chat_media/6214_1737625370006.jpeg",
    //     //     "is_deleted_by": [],
    //     //     "deleted_everyone": false,
    //     //     "_id": "6792109e2fd542f30b44b745"
    //     // },
    //     "media_file": [
    //         {
    //             "file_type": "image",
    //             "file_name": "chat_media/6035_1737711465071.png"
    //         }
    //     ]
    // }
    socket.on("sendMessage", async (data) => {
      try {
        console.log("sendMessage ==> ", data);
        socket.join(data.chat_room_id);

        let newMessage = await sendMessage(data, v1version);

        if (newMessage.success) {
          v1version.to(data.chat_room_id).emit("sendMessage", newMessage);

          let receiver_data = {
            user_id: data.receiver_id,
            chat_room_id: data.chat_room_id,
          };

          let sender_data = {
            user_id: data.sender_id,
            chat_room_id: data.chat_room_id,
          };

          let receiver_chat_room = await getChatRoomData(receiver_data);

          if (receiver_chat_room.success) {
            v1version
              .to(receiver_data.user_id)
              .emit("updateChatRoom", receiver_chat_room);
          }

          let sender_chat_room = await getChatRoomData(sender_data);

          if (sender_chat_room.success) {
            v1version
              .to(sender_data.user_id)
              .emit("updateChatRoom", sender_chat_room);
          }
        } else {
          console.log("Error in sending message");
          socket.emit("sendMessage", newMessage);
        }
      } catch (error) {
        console.log("Error in sending message", error);
      }
    });

    //   {
    //     "chat_room_id": "6790c46eb7c45d37fbbf5a8c",
    //     "user_id": "678f6b5b57648569a0f2bd1f",
    //     "page": 1,
    //     "limit": 10
    // }
    socket.on("getAllMessage", async (data) => {
      try {
        console.log(" -----------  getAllMessage  -----------  ", data);
        socket.join(data.chat_room_id);

        let allMessageList = await getAllMessage(data);
        socket.emit("getAllMessage", allMessageList);
      } catch (error) {
        console.log("=== getAllMessage ===", error);
      }
    });

    //   {
    //     "chat_room_id": "6790c471b7c45d37fbbf5a90",
    //     "sender_id": "678f6ae757648569a0f2bd1b",
    //     "receiver_id": "678f9bfdab153a42c4399542",
    //     "forwarded_mesaages":["6797572f2be8af12067534cf"]
    // }
    socket.on("forwardMessage", async (data) => {
      try {
        console.log("forwardMessage ==> ", data);
        socket.join(data.chat_room_id);

        let forward_message = await forwardMessage(data, v1version);

        if (forward_message.success) {
          v1version
            .to(data.chat_room_id)
            .emit("forwardMessage", forward_message);

          let receiver_data = {
            user_id: data.receiver_id,
            chat_room_id: data.chat_room_id,
          };

          let sender_data = {
            user_id: data.sender_id,
            chat_room_id: data.chat_room_id,
          };

          let receiver_chat_room = await getChatRoomData(receiver_data);

          if (receiver_chat_room.success) {
            v1version
              .to(receiver_data.user_id)
              .emit("updateChatRoom", receiver_chat_room);
          }

          let sender_chat_room = await getChatRoomData(sender_data);

          if (sender_chat_room.success) {
            v1version
              .to(sender_data.user_id)
              .emit("updateChatRoom", sender_chat_room);
          }
        } else {
          console.log("Error in sending message");
          socket.emit("forwardMessage", forward_message);
        }
      } catch (error) {
        console.log("Error in forwarding message", error);
      }
    });

    //   {
    //     "chat_room_id": "6790c471b7c45d37fbbf5a90",
    //     "sender_id": "678f6ae757648569a0f2bd1b",
    //     "receiver_id": "678f9bfdab153a42c4399542",
    //     "message_id":"6798c035462ebf0a72323820",
    //     "forwarded_media_mesaages":["6798c035462ebf0a72323821"]
    // }
    socket.on("forwardMediaMessage", async (data) => {
      try {
        console.log("forwardMediaMessage ==> ", data);
        socket.join(data.chat_room_id);

        let forward_message = await forwardMediaMessage(data, v1version);

        if (forward_message.success) {
          v1version
            .to(data.chat_room_id)
            .emit("forwardMediaMessage", forward_message);

          let receiver_data = {
            user_id: data.receiver_id,
            chat_room_id: data.chat_room_id,
          };

          let sender_data = {
            user_id: data.sender_id,
            chat_room_id: data.chat_room_id,
          };

          let receiver_chat_room = await getChatRoomData(receiver_data);

          if (receiver_chat_room.success) {
            v1version
              .to(receiver_data.user_id)
              .emit("updateChatRoom", receiver_chat_room);
          }

          let sender_chat_room = await getChatRoomData(sender_data);

          if (sender_chat_room.success) {
            v1version
              .to(sender_data.user_id)
              .emit("updateChatRoom", sender_chat_room);
          }
        } else {
          console.log("Error in sending message");
          socket.emit("forwardMediaMessage", forward_message);
        }
      } catch (error) {
        console.log("Error in forwarding message", error);
      }
    });

    //////////////////////////////////////   COMMON CHAT  ////////////////////////////////////////

    //   {
    //     "chat_room_id": "6790c46eb7c45d37fbbf5a8c",
    //     "chat_id": "679210ad102132a39cd14b33",
    //     "user_id": "678f6ae757648569a0f2bd1b",
    //     "option_id": "679210ad102132a39cd14b37",
    //     "is_poll": true  //true-false
    // }
    socket.on("voteInPoll", async (data) => {
      try {
        console.log("voteInPoll ==> ", data);
        socket.join(data.chat_room_id);

        let vote_in_poll = await voteInPoll(data, v1version);

        if (vote_in_poll.success) {
          socket.join(vote_in_poll.data.poll_id);

          let get_chat_data = await getChatData({
            chat_id: vote_in_poll.data.chat_id,
          });

          if (get_chat_data.success) {
            v1version.to(data.chat_room_id).emit("voteInPoll", get_chat_data);
          }

          v1version
            .to(vote_in_poll.data.poll_id.toString())
            .emit("userInteractWithPoll", vote_in_poll);

          // socket.emit("voteInPoll", get_chat_data);
        } else {
          socket.emit("voteInPoll", vote_in_poll);
        }
      } catch (error) {
        console.log("Error in voteInPoll", error);
      }
    });

    socket.on("pollVoteDetails", async (data) => {
      try {
        console.log("pollVoteDetails ==> ", data);

        let poll_vote_details = await pollVoteDetails(data, v1version);

        if (poll_vote_details.success) {
          socket.join(data.poll_id);
          socket.emit("pollVoteDetails", poll_vote_details);
        } else {
          console.log("Error in pollVoteDetails");
          socket.emit("pollVoteDetails", poll_vote_details);
        }
      } catch (error) {
        console.log("Error in poll_vote_details", error);
      }
    });

    //   {
    //     "chat_room_id": "6790c471b7c45d37fbbf5a90",
    //     "user_id": "678f6ae757648569a0f2bd1b"
    // }
    socket.on("userIsTyping", async (data) => {
      try {
        // console.log("userIsTyping ==> ", data);
        socket.join(data.chat_room_id);

        let user_is_typing = await userIsTyping(data, v1version);

        if (user_is_typing.success) {
          v1version.to(data.chat_room_id).emit("userIsTyping", user_is_typing);
        } else {
          console.log("Error in userIsTyping");
          socket.emit("userIsTyping", user_is_typing);
        }
      } catch (error) {
        console.log("Error in userIsTyping", error);
      }
    });

    //   {
    //     "chat_room_id": "6790c46eb7c45d37fbbf5a8c",
    //     "user_id": "678f6b5b57648569a0f2bd1f",
    //     "chat_id": "678f6ae757648569a0f2bd1b",
    //     "message": "day is mine",
    //     "message_type": "text"
    // }
    socket.on("editChat", async (data) => {
      try {
        console.log("editChat ==> ", data);
        socket.join(data.chat_room_id);

        let edit_chat = await editChat(data, v1version);

        if (edit_chat.success) {
          v1version.to(data.chat_room_id).emit("editChat", edit_chat);

          if (edit_chat.data.chat_room_data.room_type == "group") {
            for (const member_id of edit_chat.data.chat_room_data.member_ids) {
              let user_data = {
                user_id: member_id.toString(),
                chat_room_id: data.chat_room_id,
              };

              let get_chat_room_data = await getChatRoomData(user_data);

              if (get_chat_room_data.success) {
                v1version
                  .to(member_id.toString())
                  .emit("chatEdited", get_chat_room_data);
              }
            }
          } else {
            let receiver_data = {
              user_id: edit_chat.data.chat_room_data.user_id.toString(),
              chat_room_id: data.chat_room_id,
            };

            let sender_data = {
              user_id: edit_chat.data.chat_room_data.other_user_id.toString(),
              chat_room_id: data.chat_room_id,
            };

            let receiver_chat_room = await getChatRoomData(receiver_data);

            if (receiver_chat_room.success) {
              v1version
                .to(receiver_data.user_id)
                .emit("chatEdited", receiver_chat_room);
            }

            let sender_chat_room = await getChatRoomData(sender_data);

            if (sender_chat_room.success) {
              v1version
                .to(sender_data.user_id)
                .emit("chatEdited", sender_chat_room);
            }
          }
        } else {
          console.log("Error in editChat");
          socket.emit("editChat", edit_chat);
        }
      } catch (error) {
        console.log("Error in editChat", error);
      }
    });

    socket.on("getMessageInfo", async (data) => {
      try {
        console.log("getMessageInfo ==> ", data);
        socket.join(data.chat_room_id);

        let message_info = await getMessageInfo(data);

        socket.emit("getMessageInfo", message_info);
      } catch (error) {
        console.log("Error in getMessageInfo", error);
      }
    });

    //   {
    //     "chat_room_id": "6790c46eb7c45d37fbbf5a8c",
    //     "chat_id": "6798c136462ebf0a72323834",
    //     "user_id": "678f6ae757648569a0f2bd1b",
    //     "emoji":"😀"
    // }
    socket.on("addReaction", async (data) => {
      try {
        console.log(" -----------  addReaction  -----------  ");
        socket.join(data.chat_room_id);

        let add_reaction = await addReaction(data);

        if (add_reaction.success) {
          v1version.to(data.chat_room_id).emit("addReaction", add_reaction);
        } else {
          socket.emit("addReaction", add_reaction);
        }
      } catch (error) {
        console.log("=== addReaction ===", error);
      }
    });

    //   {
    //     "chat_reaction_id": "6798cbae462ebf0a72323897"
    // }
    socket.on("removeReaction", async (data) => {
      try {
        console.log(" -----------  removeReaction  -----------  ", data);
        socket.join(data.chat_room_id);

        let remove_reaction = await removeReaction(data);

        if (remove_reaction.success) {
          v1version
            .to(data.chat_room_id)
            .emit("removeReaction", remove_reaction);
        } else {
          socket.emit("removeReaction", remove_reaction);
        }
      } catch (error) {
        console.log("=== removeReaction ===", error);
      }
    });

    //   {
    //     "chat_id": "6798c136462ebf0a72323834"
    // }
    socket.on("reactionList", async (data) => {
      try {
        console.log(" -----------  reactionList  -----------  ");
        socket.join(data.chat_room_id);

        let reaction_list = await reactionList(data);

        socket.emit("reactionList", reaction_list);
      } catch (error) {
        console.log("=== reactionList ===", error);
      }
    });

    //   {
    //     "user_id": "6787605d3f83a0c9d66a92d9",
    //     // "search":"",
    //     "page": 1,
    //     "limit": 10
    // }
    socket.on("chatUserList", async (data) => {
      try {
        console.log(" -----------  chatUserList  -----------  ", data);
        socket.join(data.user_id);

        let chatUserData = await chatUserList(data);

        socket.emit("chatUserList", chatUserData);
      } catch (error) {
        console.log("=== chatUserList ===", error);
      }
    });

    socket.on("searchAlldata", async (data) => {
      try {
        console.log(" -----------  searchAlldata  -----------  ", data);
        // socket.join(data.user_id);

        let chatUserData = await searchAlldata(data);

        socket.emit("searchAlldata", chatUserData);
      } catch (error) {
        console.log("=== searchAlldata ===", error);
      }
    });

    //   {
    //     "chat_room_id": "6790c46eb7c45d37fbbf5a8c",
    //     "user_id": "678f6ae757648569a0f2bd1b",
    //     "page": 1,
    //     "limit": 10
    // }
    socket.on("getPinnedMessage", async (data) => {
      try {
        let get_all_pinned_message = await getPinnedMessage(data);
        socket.emit("getPinnedMessage", get_all_pinned_message);
      } catch (error) {
        console.log("=== getPinnedMessage ===", error);
      }
    });

    //   {
    //     "user_id": "678f6ae757648569a0f2bd1b",
    //     "message_id": "6798c136462ebf0a72323834",
    //     "chat_room_id": "6790c46eb7c45d37fbbf5a8c"
    // }
    socket.on("pinMessage", async (data) => {
      try {
        let pinMessageRes = await pinMessage(data);

        socket.join(data.chat_room_id);

        if (pinMessageRes.success) {
          socket.join(pinMessageRes.data.chat_room_id);
          v1version.to(data.chat_room_id).emit("pinMessage", pinMessageRes);
        } else {
          console.log("Error in pinMessage");
          socket.emit("pinMessage", pinMessageRes);
        }
      } catch (error) {
        console.log("=== pinMessage ===", error);
      }
    });

    //   {
    //     "user_id": "678f6ae757648569a0f2bd1b",
    //     "message_id": "6798c136462ebf0a72323834",
    //     "chat_room_id": "6790c46eb7c45d37fbbf5a8c"
    // }
    socket.on("unPinMessage", async (data) => {
      try {
        let unPinMessageRes = await unPinMessage(data);

        if (unPinMessageRes.success) {
          socket.join(data.chat_room_id);
          v1version.to(data.chat_room_id).emit("unPinMessage", unPinMessageRes);
        } else {
          socket.emit("unPinMessage", unPinMessageRes);
        }
      } catch (error) {
        console.log("Error in unPinMessage : ", error);
      }
    });

    //   {
    //     "chat_room_id": "6790c46eb7c45d37fbbf5a8c",
    //     "user_id": "678f6b5b57648569a0f2bd1f",
    //     "screen_status": true //true = false
    // }
    socket.on("changeScreenStatus", async (data) => {
      try {
        console.log(" -----------  changeScreenStatus  -----------  ", data);

        let req_data = {
          ...data,
          socket_id: socket.id,
        };

        let change_screen_status = await changeScreenStatus(req_data);

        if (change_screen_status.success) {
          v1version
            .to(data.chat_room_id)
            .emit("changeScreenStatus", change_screen_status);
          console.log({});
          let is_background = false;
          if (data.is_backgroud) {
            is_background = true
          }
          console.log({ is_background })
          if (data.screen_status == false && is_background == false) {
            socket.leave(data.chat_room_id);
          }
        } else {
          socket.emit("changeScreenStatus", change_screen_status);
        }
      } catch (error) {
        console.log("=== changeScreenStatus ===", error.message);
      }
    });

    //   {
    //     "chat_room_id": "6790c471b7c45d37fbbf5a90",
    //     "user_id": "678f6ae757648569a0f2bd1b"
    // }
    socket.on("readMessage", async (data) => {
      try {
        console.log(" -----------  readMessage  -----------  ");

        socket.join(data.chat_room_id);
        let updateMessage = await readMessage(data);

        if (updateMessage.success) {
          if (updateMessage.data.room_type == "personal") {
            v1version.to(data.chat_room_id).emit("readMessage", updateMessage);
            v1version
              .to(updateMessage.data.sender_id.toString())
              .emit("msgReadByUser", updateMessage);
            v1version.to(data.user_id).emit("msgReadByUser", updateMessage);
          }
          if (updateMessage.data.room_type == "group") {
            if (updateMessage.data.read_by_all == true) {
              v1version
                .to(data.chat_room_id)
                .emit("readMessage", updateMessage);
              v1version
                .to(updateMessage.data.sender_id.toString())
                .emit("msgReadByUser", updateMessage);
              v1version.to(data.user_id).emit("msgReadByUser", updateMessage);
            } else {
              v1version.to(data.user_id).emit("msgReadByUser", updateMessage);
              socket.emit("readMessage", updateMessage);
            }
          }
        } else {
          socket.emit("readMessage", updateMessage);
        }
      } catch (error) {
        console.log("=== unreadMessage ===", error.message);
      }
    });

    //   {
    //     "chat_room_id": "6790c46eb7c45d37fbbf5a8c",
    //     "user_id": "678f6b5b57648569a0f2bd1f"
    // }
    socket.on("clearChat", async (data) => {
      try {
        console.log(" -----------  clearChat  -----------  ", data);

        let clear_chat = await clearChat(data);

        if (clear_chat.success) {
          socket.join(data.user_id);
          v1version.to(data.user_id).emit("clearChat", clear_chat);
        } else {
          socket.emit("clearChat", clear_chat);
        }
      } catch (error) {
        console.log("=== clearChat ===", error);
      }
    });

    //   {
    //     "chat_room_id": "6790c471b7c45d37fbbf5a90",
    //     "user_id": "678f6ae757648569a0f2bd1b",
    //     "is_mute": false
    // }
    socket.on("muteUnmuteChat", async (data) => {
      try {
        console.log(" -----------  muteUnmuteChat  -----------  ");

        let mute_unmute_chat = await muteUnmuteChat(data);

        if (mute_unmute_chat.success) {
          socket.join(data.user_id);
          v1version.to(data.user_id).emit("muteUnmuteChat", mute_unmute_chat);
        } else {
          socket.emit("muteUnmuteChat", mute_unmute_chat);
        }
      } catch (error) {
        console.log("=== muteUnmuteChat ===", error);
      }
    });

    //   {
    //     "chat_ids": ["679757b437c16985ba70486a","6797578937c16985ba70485e"],
    //     "user_id": "678f6ae757648569a0f2bd1b",
    //     "is_stared": true
    // }
    socket.on("starredMessage", async (data) => {
      try {
        console.log(" -----------  starredMessage  -----------  ");

        let starred_message = await starredMessage(data);

        if (starred_message.success) {
          socket.join(data.user_id);
          v1version.to(data.user_id).emit("starredMessage", starred_message);
        } else {
          socket.emit("starredMessage", starred_message);
        }
      } catch (error) {
        console.log("=== starredMessage ===", error);
      }
    });

    //   {
    //     "user_id": "678f6ae757648569a0f2bd1b"
    // }
    socket.on("unStarAllMessage", async (data) => {
      try {
        console.log(" -----------  unStarAllMessage  -----------  ");

        let unstar_all_messages = await unStarAllMessage(data);

        if (unstar_all_messages.success) {
          socket.join(data.user_id);
          v1version
            .to(data.user_id)
            .emit("unStarAllMessage", unstar_all_messages);
        } else {
          socket.emit("unStarAllMessage", unstar_all_messages);
        }
      } catch (error) {
        console.log("=== unStarAllMessage ===", error);
      }
    });

    //   {
    //     "user_id": "678f6ae757648569a0f2bd1b",
    //     "page": 1,
    //     "limit": 10
    // }
    socket.on("starredMessageList", async (data) => {
      try {
        console.log(" -----------  starredMessageList  -----------  ");

        let starred_message_list = await starredMessageList(data);

        socket.join(data.user_id);
        socket.emit("starredMessageList", starred_message_list);
      } catch (error) {
        console.log("=== starredMessageList ===", error);
      }
    });

    //   {
    //     "chat_room_id": "6790c46eb7c45d37fbbf5a8c",
    //     "user_id": "678f6b5b57648569a0f2bd1f"
    // }
    socket.on("deleteChatRoom", async (data) => {
      try {
        console.log(" -----------  deleteChatRoom  -----------  ");

        let deleteChatData = await deleteChatRoom(data);

        if (deleteChatData.success) {
          socket.join(data.user_id);
          v1version.to(data.user_id).emit("deleteChatRoom", deleteChatData);
        } else {
          socket.emit("deleteChatRoom", deleteChatData);
        }
      } catch (error) {
        console.log("=== deleteChatRoom ===", error);
      }
    });

    //   {
    //     "chat_room_id": "6790c46eb7c45d37fbbf5a8c",
    //     "chat_ids": ["6798c136462ebf0a72323834","6798c035462ebf0a72323820"],
    //     "user_id": "678f6ae757648569a0f2bd1b"
    // }
    socket.on("deleteChat", async (data) => {
      try {
        console.log(" -----------  deleteChat  -----------  ", data);

        socket.join(data.user_id);

        let deleteChatData = await deleteChat(data);

        if (deleteChatData.success) {
          v1version.to(data.user_id).emit("deleteChat", deleteChatData);

          let user_data = {
            user_id: data.user_id,
            chat_room_id: data.chat_room_id,
          };

          let user_chat_room = await getChatRoomData(user_data);

          if (user_chat_room.success) {
            v1version
              .to(user_data.user_id)
              .emit("updateChatRoom", user_chat_room);
          }
        } else {
          socket.emit("deleteChat", deleteChatData);
        }
      } catch (error) {
        console.log("=== deleteChat ===", error);
      }
    });

    //   {
    //     "chat_room_id": "6790c46eb7c45d37fbbf5a8c",
    //     "chat_id": "6798c035462ebf0a72323820",
    //     "user_id": "678f6ae757648569a0f2bd1b",
    //     "chat_media_ids":["6798c035462ebf0a72323821"]
    // }
    socket.on("deleteMediaChat", async (data) => {
      try {
        console.log(" -----------  deleteMediaChat  -----------  ");

        socket.join(data.user_id);
        let deleteMediaChatData = await deleteMediaChat(data);

        if (deleteMediaChatData.success) {
          v1version
            .to(data.user_id)
            .emit("deleteMediaChat", deleteMediaChatData);

          let user_data = {
            user_id: data.user_id,
            chat_room_id: data.chat_room_id,
          };

          let user_chat_room = await getChatRoomData(user_data);

          if (user_chat_room.success) {
            v1version.to(user_data.user_id).emit("u", user_chat_room);
          }
        } else {
          socket.emit("deleteMediaChat", deleteMediaChatData);
        }
      } catch (error) {
        console.log("=== deleteMediaChat ===", error);
      }
    });

    //   {
    //     "chat_room_id": "6790c46eb7c45d37fbbf5a8c",
    //     "chat_id": "6798c035462ebf0a72323820",
    //     "user_id": "678f6ae757648569a0f2bd1b",
    //     "chat_media_ids":["6798c035462ebf0a72323821"]
    // }
    socket.on("deleteMediaChatEveryOne", async (data) => {
      try {
        console.log(" -----------  deleteMediaChatEveryOne  -----------  ");

        socket.join(data.user_id);
        let deleteMediaChatEveryOneData = await deleteMediaChatEveryOne(data);

        if (deleteMediaChatEveryOneData.success) {
          v1version
            .to(data.user_id)
            .emit("deleteMediaChatEveryOne", deleteMediaChatEveryOneData);

          if (
            deleteMediaChatEveryOneData.data.chat_room_data.room_type == "group"
          ) {
            for (const member_id of deleteMediaChatEveryOneData.data
              .chat_room_data.member_ids) {
              let user_data = {
                user_id: member_id.toString(),
                chat_room_id: data.chat_room_id,
              };

              let get_chat_room_data = await getChatRoomData(user_data);

              if (get_chat_room_data.success) {
                v1version
                  .to(member_id.toString())
                  .emit("updateChatRoom", get_chat_room_data);
              }
            }
          } else {
            let receiver_data = {
              user_id:
                deleteMediaChatEveryOneData.data.chat_room_data.user_id.toString(),
              chat_room_id: data.chat_room_id,
            };

            let sender_data = {
              user_id:
                deleteMediaChatEveryOneData.data.chat_room_data.other_user_id.toString(),
              chat_room_id: data.chat_room_id,
            };

            let receiver_chat_room = await getChatRoomData(receiver_data);

            if (receiver_chat_room.success) {
              v1version
                .to(receiver_data.user_id)
                .emit("updateChatRoom", receiver_chat_room);
            }

            let sender_chat_room = await getChatRoomData(sender_data);

            if (sender_chat_room.success) {
              v1version
                .to(sender_data.user_id)
                .emit("updateChatRoom", sender_chat_room);
            }
          }
        } else {
          socket.emit("deleteMediaChatEveryOne", deleteMediaChatEveryOneData);
        }
      } catch (error) {
        console.log("=== deleteMediaChatEveryOne ===", error);
      }
    });

    //   {
    //     "chat_room_id": "6790c46eb7c45d37fbbf5a8c",
    //     "chat_ids": ["6798c136462ebf0a72323834"],
    //     "user_id": "678f6b5b57648569a0f2bd1f"
    // }
    socket.on("deleteForEveryone", async (data) => {
      try {
        console.log(" -----------  deleteForEveryone  -----------  ", data);
        socket.join(data.chat_room_id);

        const delete_for_everyone = await deleteForEveryone(data);
        console.log("res", delete_for_everyone.success);

        console.log("delete_for_everyone", delete_for_everyone);

        if (delete_for_everyone.success) {
          console.log("lord jigs");

          v1version
            .to(data.chat_room_id)
            .emit("deleteForEveryone", JSON.stringify(delete_for_everyone));
          // socket.emit("deleteForEveryone", delete_for_everyone)

          if (delete_for_everyone.data.chat_room_data.room_type == "group") {
            for (const member_id of delete_for_everyone.data.chat_room_data
              .member_ids) {
              let user_data = {
                user_id: member_id.toString(),
                chat_room_id: data.chat_room_id,
              };

              let get_chat_room_data = await getChatRoomData(user_data);

              if (get_chat_room_data.success) {
                v1version
                  .to(member_id.toString())
                  .emit("updateChatRoom", get_chat_room_data);
              }
            }
          } else {
            console.log("else", delete_for_everyone.data);

            let receiver_data = {
              user_id:
                delete_for_everyone.data.chat_room_data.user_id.toString(),
              chat_room_id: data.chat_room_id,
            };

            let sender_data = {
              user_id:
                delete_for_everyone.data.chat_room_data.other_user_id.toString(),
              chat_room_id: data.chat_room_id,
            };

            console.log({ sender_data, receiver_data });

            let receiver_chat_room = await getChatRoomData(receiver_data);
            console.log({ receiver_chat_room });

            if (receiver_chat_room.success) {
              v1version
                .to(receiver_data.user_id)
                .emit("updateChatRoom", receiver_chat_room);
            }

            let sender_chat_room = await getChatRoomData(sender_data);
            console.log({ sender_chat_room });

            if (sender_chat_room.success) {
              v1version
                .to(sender_data.user_id)
                .emit("updateChatRoom", sender_chat_room);
            }
          }
        } else {
          socket.emit("deleteForEveryone", delete_for_everyone);
        }
      } catch (error) {
        console.log("=== deleteForEveryone ===", error);
      }
    });

    socket.on("addOrRemoveFavorites", async (data) => {
      try {
        console.log(" -----------  addOrRemoveFavorites  -----------  ");

        let add_remove_favorites = await addOrRemoveFavorites(data);

        if (add_remove_favorites.success) {
          socket.join(data.user_id);
          v1version
            .to(data.user_id)
            .emit("addOrRemoveFavorites", add_remove_favorites);
        } else {
          socket.emit("addOrRemoveFavorites", add_remove_favorites);
        }
      } catch (error) {
        console.log("=== addOrRemoveFavorites ===", error);
      }
    });

    socket.on("addOrRemoveArchives", async (data) => {
      try {
        console.log(" -----------  addOrRemoveArchives  -----------  ");

        let add_remove_archives = await addOrRemoveArchives(data);
        console.log({ add_remove_archives });

        if (add_remove_archives.success) {
          socket.join(data.user_id);
          v1version
            .to(data.user_id)
            .emit("addOrRemoveArchives", add_remove_archives);
        } else {
          socket.emit("addOrRemoveArchives", add_remove_archives);
        }
      } catch (error) {
        console.log("=== addOrRemoveArchives ===", error);
      }
    });

    socket.on("pinUnpinChatRoom", async (data) => {
      try {
        console.log(" -----------  pinUnpinChatRoom  -----------  ", data);

        let pin_unpin_chat = await pinUnpinChatRoom(data);

        if (pin_unpin_chat.success) {
          socket.join(data.user_id);
          v1version.to(data.user_id).emit("pinUnpinChatRoom", pin_unpin_chat);
        } else {
          socket.emit("pinUnpinChatRoom", pin_unpin_chat);
        }
      } catch (error) {
        console.log("=== pinUnpinChatRoom ===", error);
      }
    });

    socket.on("mediaLinksDocsMessages", async (data) => {
      try {
        console.log(
          " -----------  mediaLinksDocsMessages  -----------  ",
          data
        );

        socket.join(data.chat_room_id);

        let media_links_docs_messages = await mediaLinksDocsMessages(data);

        socket.emit("mediaLinksDocsMessages", media_links_docs_messages);
      } catch (error) {
        console.log("=== mediaLinksDocsMessages ===", error);
      }
    });

    socket.on("markAsUnread", async (data) => {
      try {
        console.log(" -----------  markAsUnread  -----------  ", data);

        socket.join(data.user_id);

        let mark_as_unread = await markAsUnread(data);

        v1version.to(data.user_id).emit("markAsUnread", mark_as_unread);
      } catch (error) {
        console.log("=== markAsUnread ===", error);
      }
    });

    socket.on("getUpdatedChat", async (data) => {
      try {
        // console.log(" -----------  getUpdatedChat  -----------  ", data);

        let get_updated_chat = await getChatRoomData(data);

        socket.emit("getUpdatedChat", get_updated_chat);
      } catch (error) {
        console.log("=== getUpdatedChat ===", error);
      }
    });

    socket.on("getUserWallpaper", async (data) => {
      try {
        console.log(" -----------  getUserWallpaper  -----------  ", data);

        let get_wallpaper = await getUserWallpaper(data);

        socket.emit("getUserWallpaper", get_wallpaper);
      } catch (error) {
        console.log("=== getUserWallpaper ===", error);
      }
    });

    socket.on("startVideoCall", async (data) => {
      try {
        console.log(" -----------  startVideoCall  -----------  ", data);

        let startVideoCallRes = await startVideoCall(data);

        console.log({ startVideoCallRes });


        if (startVideoCallRes.success) {
          socket.join(data.chat_room_id);

          if (startVideoCallRes.data.room_type == "group") {
            const member_ids_as_strings = startVideoCallRes.data.receiver_id.map(id => id.toString());

            v1version
              .to(member_ids_as_strings)
              .emit("startVideoCall", startVideoCallRes);

            let user_data = {
              user_id: data.user_id,
              chat_room_id: data.chat_room_id,
            };

            let sender_data = {
              user_id: data.user_id,
              chat_id: startVideoCallRes.data.create_message._id,
            };

            let get_chat_data = await getChatData(sender_data);

            v1version
              .to(data.chat_room_id)
              .emit("sendGroupMessage", get_chat_data);

            let get_sender_room_data = await getChatRoomData(user_data);

            v1version
              .to(sender_data.user_id.toString())
              .emit("updateChatRoom", get_sender_room_data);

            for (const member_id of startVideoCallRes.data.receiver_id) {
              let user_data = {
                user_id: member_id.toString(),
                chat_room_id: data.chat_room_id,
              };

              let get_chat_room_data = await getChatRoomData(user_data);

              if (get_chat_room_data.success) {
                v1version
                  .to(member_id.toString())
                  .emit("updateChatRoom", get_chat_room_data);
              }
            }

          } else {
            v1version
              .to(startVideoCallRes.data.receiver_id.toString())
              .emit("startVideoCall", startVideoCallRes);

            let user_data = {
              user_id: data.user_id,
              chat_id: startVideoCallRes.data.create_message._id,
            };

            let get_chat_data = await getChatData(user_data);

            console.log({ get_chat_data })

            v1version
              .to(data.chat_room_id)
              .emit("sendMessage", get_chat_data);

            let sender_data = {
              user_id: data.user_id,
              chat_room_id: data.chat_room_id,
            };

            let get_chat_room_data = await getChatRoomData(sender_data);

            console.log({ get_chat_room_data })


            v1version
              .to(user_data.user_id.toString())
              .emit("updateChatRoom", get_chat_room_data);

            let receiver_data = {
              user_id: startVideoCallRes.data.receiver_id,
              chat_room_id: data.chat_room_id,
            };

            let get_receiver_room_data = await getChatRoomData(receiver_data);

            v1version
              .to(receiver_data.user_id.toString())
              .emit("updateChatRoom", get_receiver_room_data);

          }
        } else {
          console.log("Error in startVideoCall");
          socket.emit("startVideoCall", startVideoCallRes);
        }
      } catch (error) {
        console.log("=== startVideoCall ===", error);
      }
    });

    socket.on("endVideoCall", async (data) => {
      try {
        console.log(" -----------  endVideoCall  -----------  ", data);

        let endVideoCallRes = await endVideoCall(data);

        console.log({ endVideoCallRes });

        if (endVideoCallRes.success) {
          // if (endVideoCallRes.data.room_type == "personal") {
          let res_data = {
            success: true,
            statuscode: 1,
            message: "Video call ended succesfully",
            data: data,
          };
          v1version
            .to(data.chat_room_id.toString())
            .emit("endVideoCall", res_data);
          // v1version
          //   .to(endVideoCallRes.data.other_user_id.toString())
          //   .emit("endVideoCall", res_data);
          // v1version.emit("endVideoCall", data);
          // }
        } else {
          console.log("Error in endVideoCall");
          socket.emit("endVideoCall", endVideoCallRes);
        }
      } catch (error) {
        console.log("=== endVideoCall ===", error);
      }
    });

    socket.on("joinCall", async (data) => {
      try {
        console.log(" -----------  joinCall  -----------  ", data);


        let joinCallRes = await joinCall(data);
        console.log({ joinCallRes })
        if (joinCallRes.success) {
          socket.join(data.chat_room_id);
          v1version
            .to(data.chat_room_id.toString())
            .emit("joinCall", joinCallRes);
        } else {
          socket.emit("joinCall", joinCallRes);
        }
      } catch (error) {
        console.log("=== joinCall ===", error);
      }
    });

    socket.on("leaveCall", async (data) => {
      try {
        console.log(" -----------  leaveCall  -----------  ", data);

        let leaveCallRes = await leaveCall(data,v1version);

        if (leaveCallRes.success) {
          if (leaveCallRes.data.is_end_call) {
            let res_data = {
              success: true,  
              statuscode: 1,
              message: "Video call ended succesfully",
              data: data,
            };
            v1version
              .to(data.chat_room_id.toString())
              .emit("endVideoCall", res_data);
          }
        }

        socket.emit("leaveCall", leaveCallRes);
      } catch (error) {
        console.log("=== leaveCall ===", error);
      }
    });

    socket.on("joinedMembersInCall", async (data) => {
      try {
        console.log(" -----------  joinedMembersInCall  -----------  ", data);

        let joinedMembersInCallRes = await joinedMembersInCall(data);

        socket.emit("joinedMembersInCall", joinedMembersInCallRes);
      } catch (error) {
        console.log("=== joinedMembersInCall ===", error);
      }
    });

    socket.on("userRespondCall", async (data) => {
      try {
        console.log(" -----------  userRespondCall  -----------  ", data);

        let userRespondCallRes = await userRespondCall(data);

        if (userRespondCallRes.success) {
          v1version
            .to(data.user_id.toString())
            .emit("userRespondCall", userRespondCallRes);
        } else {
          console.log("Error in userRespondCall");
          socket.emit("userRespondCall", userRespondCallRes);
        }
      } catch (error) {
        console.log("=== userRespondCall ===", error);
      }
    });

    //////////////////////////////////// GROUP CHAT ///////////////////////////////////////

    //{
    //     "group_name": "marvellous",
    //     "member_ids": [
    //         "678f6ae757648569a0f2bd1b",
    //         "678f6b5b57648569a0f2bd1f"
    //     ],
    //     "group_image": "group_image/b8d52071-504c-41ba-92b5-cf20b60cd315.png",
    //     "user_id": "678f6ae757648569a0f2bd1b"
    // }
    socket.on("createGroup", async (data) => {
      try {
        console.log(" -----------  createGroup  -----------  ", data);

        let create_group = await createGroup(data);
        console.log({ create_group: create_group });

        if (create_group.success) {
          socket.emit("createGroup", create_group);
          v1version.to(data.member_ids).emit("createGroup", create_group);

          for (const member_id of create_group.data.member_ids) {
            let user_data = {
              user_id: member_id.toString(),
              chat_room_id: create_group.data._id,
            };

            let get_chat_room_data = await getChatRoomData(user_data);

            if (get_chat_room_data.success) {
              v1version
                .to(member_id.toString())
                .emit("updateChatRoom", get_chat_room_data);
            }
          }
        } else {
          socket.emit("createGroup", create_group);
        }
      } catch (error) {
        console.log("=== createGroup ===", error);
      }
    });

    //   {
    //     "chat_room_id": "6799f6fcda89ce51b041a307",
    //     "user_id": "678f6b5b57648569a0f2bd1f"
    // }
    socket.on("getGroupDetails", async (data) => {
      try {
        console.log(" -----------  getGroupDetails  -----------  ");

        let group_details = await getGroupDetails(data);

        socket.emit("getGroupDetails", group_details);
      } catch (error) {
        console.log("=== getGroupDetails ===", error);
      }
    });

    //   {
    //     "chat_room_id": "6799f6fcda89ce51b041a307",
    //     "user_id": "678f6b5b57648569a0f2bd1f",
    //     "page": 1,
    //     "limit": 10
    // }
    socket.on("getAllGroupMessage", async (data) => {
      try {
        console.log(" -----------  getAllGroupMessage  -----------  ", data);

        let get_all_group_message = await getAllGroupMessage(data);
        if (
          get_all_group_message.success &&
          get_all_group_message.data.chat_room_data.is_member
        ) {
          socket.join(data.chat_room_id);
        }

        socket.emit("getAllGroupMessage", get_all_group_message);
      } catch (error) {
        console.log("=== getAllGroupMessage ===", error);
      }
    });

    //   {
    //     "chat_room_id": "6799f6fcda89ce51b041a307",
    //     "sender_id": "678f6b5b57648569a0f2bd1f",
    //     "message": "day is mine",
    //     "message_type": "text"
    //     // "poll":{
    //     //     "question":"are you fine now",
    //     //     "options":[
    //     //         {
    //     //             "text":"yahh"
    //     //         },
    //     //         {
    //     //             "text":"not yet"
    //     //         },
    //     //         {
    //     //             "text":"yes"
    //     //         }
    //     //     ],
    //     //     "is_multiple":false
    //     // }
    //     // "reply_message_id": "6792109e2fd542f30b44b743",
    //     // "replied_message_media": {
    //     //     "file_type": "video",
    //     //     "file_name": "http://192.168.29.100:4500/public/chat_media/6214_1737625370006.mp4",
    //     //     "thumbnail": "http://192.168.29.100:4500/public/chat_media/6214_1737625370006.jpeg",
    //     //     "is_deleted_by": [],
    //     //     "deleted_everyone": false,
    //     //     "_id": "6792109e2fd542f30b44b745"
    //     // },
    //     // "media_file": [
    //     //     {
    //     //         "file_type": "image",
    //     //         "file_name": "chat_media/6035_1737711465071.png"
    //     //     }
    //     // ]
    // }
    socket.on("sendGroupMessage", async (data) => {
      try {
        console.log(" -----------  sendGroupMessage  -----------  ", data);

        let send_group_message = await sendGroupMessage(data);

        if (send_group_message.success) {
          v1version
            .to(data.chat_room_id)
            .emit("sendGroupMessage", send_group_message);

          let sender_data = {
            user_id: data.sender_id.toString(),
            chat_room_id: data.chat_room_id,
          };

          let get_sender_room_data = await getChatRoomData(sender_data);

          if (get_sender_room_data.success) {
            v1version
              .to(sender_data.user_id.toString())
              .emit("updateChatRoom", get_sender_room_data);
          }

          for (const member_id of send_group_message.data.receiver_ids) {
            let user_data = {
              user_id: member_id.toString(),
              chat_room_id: send_group_message.data.chat_room_id,
            };

            let get_chat_room_data = await getChatRoomData(user_data);

            if (get_chat_room_data.success) {
              v1version
                .to(member_id.toString())
                .emit("updateChatRoom", get_chat_room_data);
            }
          }
        } else {
          socket.emit("sendGroupMessage", send_group_message);
        }
      } catch (error) {
        console.log("=== sendGroupMessage ===", error);
      }
    });

    //   {
    //     "chat_room_id": "679c6ff46bc04a0fb0b019b6",
    //     "sender_id": "678f6ae757648569a0f2bd1b",
    //     "forwarded_mesaages":["679b5e4c52e895f33e51b55f","679c70596bc04a0fb0b019d4"]
    // }
    socket.on("forwardMessageToGroup", async (data) => {
      try {
        console.log(" -----------  forwardMessageToGroup  -----------  ", data);

        let forward_message_to_group = await forwardMessageToGroup(data);

        if (forward_message_to_group.success) {
          v1version
            .to(data.chat_room_id)
            .emit("forwardMessageToGroup", forward_message_to_group);

          let sender_data = {
            user_id: data.sender_id.toString(),
            chat_room_id: data.chat_room_id,
          };

          let get_sender_room_data = await getChatRoomData(sender_data);

          if (get_sender_room_data.success) {
            v1version
              .to(sender_data.user_id.toString())
              .emit("updateChatRoom", get_sender_room_data);
          }

          for (const member_id of forward_message_to_group.data[0]
            .receiver_ids) {
            let user_data = {
              user_id: member_id.toString(),
              chat_room_id: forward_message_to_group.data[0].chat_room_id,
            };

            let get_chat_room_data = await getChatRoomData(user_data);

            if (get_chat_room_data.success) {
              v1version
                .to(member_id.toString())
                .emit("updateChatRoom", get_chat_room_data);
            }
          }
        } else {
          socket.emit("forwardMessageToGroup", forward_message_to_group);
        }
      } catch (error) {
        console.log("=== forwardMessageToGroup ===", error);
      }
    });

    socket.on("forwardMediaMessageToGroup", async (data) => {
      try {
        console.log(
          " -----------  forwardMediaMessageToGroup  -----------  ",
          data
        );

        let forward_media_message_to_group = await forwardMediaMessageToGroup(
          data
        );

        if (forward_media_message_to_group.success) {
          v1version
            .to(data.chat_room_id)
            .emit("forwardMediaMessageToGroup", forward_media_message_to_group);

          let sender_data = {
            user_id: data.sender_id.toString(),
            chat_room_id: data.chat_room_id,
          };

          let get_sender_room_data = await getChatRoomData(sender_data);

          if (get_sender_room_data.success) {
            v1version
              .to(sender_data.user_id.toString())
              .emit("updateChatRoom", get_sender_room_data);
          }

          for (const member_id of forward_media_message_to_group.data
            .receiver_ids) {
            let user_data = {
              user_id: member_id.toString(),
              chat_room_id: forward_media_message_to_group.data.chat_room_id,
            };

            let get_chat_room_data = await getChatRoomData(user_data);

            if (get_chat_room_data.success) {
              v1version
                .to(member_id.toString())
                .emit("updateChatRoom", get_chat_room_data);
            }
          }
        } else {
          socket.emit(
            "forwardMediaMessageToGroup",
            forward_media_message_to_group
          );
        }
      } catch (error) {
        console.log("=== forwardMediaMessageToGroup ===", error);
      }
    });

    socket.on("addMemberToGroup", async (data) => {
      try {
        console.log(" -----------  addMemberToGroup  -----------  ", data);

        let add_member_to_group = await addMemberToGroup(data);

        if (add_member_to_group.success) {
          // v1version
          //   .to(data.member_ids)
          //   .emit("addMemberToGroup", add_member_to_group);
          // socket.emit("addMemberToGroup", add_member_to_group);

          socket.join(data.chat_room_id);

          // v1version
          //   .to(data.chat_room_id)
          //   .emit("addMemberToGroup", add_member_to_group);

          let sender_data = {
            user_id: data.user_id.toString(),
            chat_room_id: data.chat_room_id,
          };

          let chat_for_sender = await getChatData({
            chat_id: add_member_to_group.data.chat_id,
            user_id: data.user_id,
          });

          let get_sender_room_data = await getChatRoomData(sender_data);

          if (get_sender_room_data.success) {
            v1version
              .to(sender_data.user_id.toString())
              .emit("updateChatRoom", get_sender_room_data);
          }

          if (chat_for_sender.success) {
            v1version
              .to(sender_data.user_id.toString())
              .emit("addMemberToGroup", chat_for_sender);
          }

          for (const member_id of add_member_to_group.data.receiver_ids) {
            let user_data = {
              user_id: member_id.toString(),
              chat_room_id: data.chat_room_id,
            };

            let get_chat_room_data = await getChatRoomData(user_data);

            if (get_chat_room_data.success) {
              v1version
                .to(member_id.toString())
                .emit("updateChatRoom", get_chat_room_data);
            }

            let updated_chat = await getChatData({
              chat_id: add_member_to_group.data.chat_id,
              user_id: member_id,
            });

            if (updated_chat.success) {
              v1version
                .to(member_id.toString())
                .emit("addMemberToGroup", updated_chat);
            }
          }
        } else {
          socket.emit("addMemberToGroup", add_member_to_group);
        }
      } catch (error) {
        console.log("=== addMemberToGroup ===", error);
      }
    });

    socket.on("removeMemberFromGroup", async (data) => {
      try {
        console.log(" -----------  removeMemberFromGroup  -----------  ", data);

        let add_member_to_group = await removeMemberFromGroup(data);

        if (add_member_to_group.success) {
          // v1version
          //   .to(data.member_ids)
          //   .emit("removeMemberFromGroup", add_member_to_group);
          // socket.emit("removeMemberFromGroup", add_member_to_group);

          socket.join(data.chat_room_id);

          // v1version
          //   .to(data.chat_room_id)
          //   .emit("removeMemberFromGroup", add_member_to_group);

          let sender_data = {
            user_id: data.user_id.toString(),
            chat_room_id: data.chat_room_id,
          };

          let chat_for_sender = await getChatData({
            chat_id: add_member_to_group.data.chat_id,
            user_id: data.user_id,
          });

          let get_sender_room_data = await getChatRoomData(sender_data);

          if (get_sender_room_data.success) {
            v1version
              .to(sender_data.user_id.toString())
              .emit("updateChatRoom", get_sender_room_data);
          }

          if (chat_for_sender.success) {
            v1version
              .to(sender_data.user_id.toString())
              .emit("removeMemberFromGroup", chat_for_sender);
          }

          for (const member_id of add_member_to_group.data.receiver_ids) {
            let user_data = {
              user_id: member_id.toString(),
              chat_room_id: data.chat_room_id,
            };

            let get_chat_room_data = await getChatRoomData(user_data);

            if (get_chat_room_data.success) {
              v1version
                .to(member_id.toString())
                .emit("updateChatRoom", get_chat_room_data);
            }

            let updated_chat = await getChatData({
              chat_id: add_member_to_group.data.chat_id,
              user_id: member_id.toString(),
            });

            if (updated_chat.success) {
              v1version
                .to(member_id.toString())
                .emit("removeMemberFromGroup", updated_chat);
            }
          }
        } else {
          socket.emit("removeMemberFromGroup", add_member_to_group);
        }
      } catch (error) {
        console.log("=== removeMemberFromGroup ===", error);
      }
    });

    socket.on("exitGroup", async (data) => {
      try {
        console.log(" -----------  exitGroup  -----------  ", data);

        let exit_group = await exitGroup(data, v1version);

        if (exit_group.success) {

          let sender_data = {
            user_id: data.user_id.toString(),
            chat_room_id: data.chat_room_id,
          };

          let chat_for_sender = await getChatData({
            chat_id: exit_group.data.chat_id,
            user_id: data.user_id,
          });

          let get_sender_room_data = await getChatRoomData(sender_data);

          if (get_sender_room_data.success) {
            v1version
              .to(sender_data.user_id.toString())
              .emit("updateChatRoom", get_sender_room_data);
          }

          if (chat_for_sender.success) {
            v1version
              .to(sender_data.user_id.toString())
              .emit("exitGroup", chat_for_sender);
          }

          socket.leave(data.chat_room_id);

          for (const member_id of exit_group.data.receiver_ids) {
            let user_data = {
              user_id: member_id.toString(),
              chat_room_id: data.chat_room_id,
            };

            let get_chat_room_data = await getChatRoomData(user_data);

            if (get_chat_room_data.success) {
              v1version
                .to(member_id.toString())
                .emit("updateChatRoom", get_chat_room_data);
            }

            let updated_chat = await getChatData({
              chat_id: exit_group.data.chat_id,
              user_id: member_id.toString(),
            });

            if (updated_chat.success) {
              v1version
                .to(member_id.toString())
                .emit("exitGroup", updated_chat);
            }
          }
        }
      } catch (error) {
        console.log("=== exitGroup ===", error);
      }
    });

    socket.on("makeGroupAdmin", async (data) => {
      try {
        console.log(" -----------  makeGroupAdmin  -----------  ", data);

        let make_group_admin = await makeGroupAdmin(data);

        if (make_group_admin.success) {
          let admin_data = {
            user_id: data.member_id.toString(),
            chat_room_id: data.chat_room_id,
          };

          let chat_for_admin = await getChatData({
            chat_id: make_group_admin.data.chat_id,
            user_id: data.member_id,
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
        socket.emit("makeGroupAdmin", make_group_admin);
      } catch (error) {
        console.log("=== makeGroupAdmin ===", error);
      }
    });

    socket.on("dismissFromAdmin", async (data) => {
      try {
        console.log(" -----------  dismissFromAdmin  -----------  ", data);

        let dismiss_group_admin = await dismissFromAdmin(data);

        if (dismiss_group_admin.success) {
          let admin_data = {
            user_id: data.admin_id.toString(),
            chat_room_id: data.chat_room_id,
          };

          let chat_for_admin = await getChatData({
            chat_id: dismiss_group_admin.data.chat_id,
            user_id: data.admin_id,
          });

          console.log({ chat_for_admin });

          let get_admin_room_data = await getChatRoomData(admin_data);

          if (get_admin_room_data.success) {
            v1version
              .to(admin_data.user_id.toString())
              .emit("updateChatRoom", get_admin_room_data);
          }

          if (chat_for_admin.success) {
            v1version
              .to(admin_data.user_id.toString())
              .emit("dismissFromAdmin", chat_for_admin);
          }
        }
        socket.emit("dismissFromAdmin", dismiss_group_admin);
      } catch (error) {
        console.log("=== dismissFromAdmin ===", error);
      }
    });

    socket.on("leaveChatRoom", async (data) => {
      try {
        console.log(" -----------  leaveChatRoom  -----------  ", data);

        socket.leave(data.chat_room_id.toString())

      } catch (error) {
        console.log("=== leaveChatRoom ===", error);
      }
    });

    //////////////////////////////////////////////////////////////////////////////////

    socket.on("getChatRoomData", async (data) => {
      try {
        console.log(" -----------  getChatRoomData  -----------  ");

        let get_chat_room_data = await getChatRoomData(data);

        socket.emit("getChatRoomData", get_chat_room_data);
      } catch (error) {
        console.log("=== getChatRoomData ===", error);
      }
    });
  });
};

// manage is_read in in group functionalities also in exit group make admin
