const axios = require("axios");
const serviceAccount = require("../credentails/service_account.json");
const { google } = require("googleapis");
const projectId = "chat-app-f5bb6";
const admin = require("firebase-admin");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

async function getAccessToken(serviceAccount) {
  const scopes = ["https://www.googleapis.com/auth/firebase.messaging"];
  const jwtClient = new google.auth.JWT(
    serviceAccount.client_email,
    null,
    serviceAccount.private_key,
    scopes
  );

  return new Promise((resolve, reject) => {
    jwtClient.authorize((err, tokens) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(tokens.access_token);
    });
  });
}

const subscribeToTopic = async (deviceTokens, topic) => {
  try {
    const response = await admin
      .messaging()
      .subscribeToTopic(deviceTokens, topic);
    console.log(
      `Successfully subscribed ${response.successCount} tokens to topic: ${topic}`
    );
    return { success: true, count: response.successCount };
  } catch (error) {
    console.error("Error subscribing to topic:", error);
    return { success: false, error: error.message };
  }
};

const unsubscribeFromTopic = async (deviceTokens, topic) => {
  try {
    const response = await admin
      .messaging()
      .unsubscribeFromTopic(deviceTokens, topic);
    console.log(
      `Successfully unsubscribed ${response.successCount} tokens from topic: ${topic}`
    );
    if (response.failureCount > 0) {
      console.error(
        `Failed to unsubscribe ${response.failureCount} tokens from topic: ${topic}`
      );
      // console.error(response.errors);
    }
    return { success: true, count: response.successCount };
  } catch (error) {
    console.error("Error unsubscribing from topic:", error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  notificationSend: async (notification_data) => {
    const accessToken = await getAccessToken(serviceAccount);
    const {
      device_token,
      noti_title,
      noti_msg,
      noti_for,
      id,
      noti_image,
      details,
      sound_name,
    } = notification_data;

    let messageBody = {
      title: noti_title,
      body: noti_msg,
      noti_for: noti_for,
      id: id,
      sound: sound_name + ".caf",
    };

    if (details != undefined) {
      messageBody.details = details;
    }

    let noti_payload = {
      title: noti_title,
      body: noti_msg,
      // sound: sound_name + '.caf',
    };

    if (noti_image != undefined) {
      noti_payload.image = noti_image;
    }

    const message = {
      message: {
        token: device_token,
        notification: noti_payload,
        data: messageBody,
      },
    };

    try {
      const response = await axios.post(
        `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
        message,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      return response;
    } catch (error) {
      console.error("Error sending notification:", error);
    }
  },

  notiSendMultipleDevice: async (notification_data) => {
    const accessToken = await getAccessToken(serviceAccount);
    const {
      device_token,
      noti_title,
      noti_msg,
      noti_for,
      id,
      noti_image,
      room_type,
      sender_image,
      sender_id,
      sender_name,
      details,
      sound_name,
      chat_room_id,
      messages
    } = notification_data;

    let topic =
      Math.floor(1000 + Math.random() * 8999) + "_" + Date.now().toString(); // Define the topic name

    console.log({ topic }); // Define the topic name

    if (Array.isArray(device_token) && device_token.length > 0) {
      // Step 1: Subscribe to the topic
      const subscribeResult = await subscribeToTopic(device_token, topic);
      if (!subscribeResult.success) {
        return {
          success: false,
          message: "Subscription failed",
          error: subscribeResult.error,
        };
      }

      // Step 2: Prepare the notification payload
      const messageBody = {
        title: noti_title,
        body: noti_msg,
        noti_for: noti_for,
        id: id,
        room_type: room_type,
        sender_image: sender_image ? sender_image : null,
        sender_id,
        sender_name,
        chat_room_id,
        messages
        // badge: "10",
        // ...(details && { details }), // Include details if defined
      };

      const noti_payload = {
        title: noti_title,
        body: noti_msg,
        // image: "https://img.freepik.com/free-photo/abstract-autumn-beauty-multi-colored-leaf-vein-pattern-generated-by-ai_188544-9871.jpg",
        ...(noti_image && { image: noti_image }), // Include image if defined
      };

      // Step 3: Send notification to the topic
      const message = {
        message: {
          topic: topic,
          notification: noti_payload,
          data: messageBody,
          android: {
            // collapse_key:chat_room_id.toString(),
            priority: "HIGH",
            notification: {
              // tag: chat_room_id.toString() || "abc",
              // notification_count: 7,
              // color: "#e45d50",
              image: noti_image,
              sound:
                sound_name && sound_name.toLowerCase() === "none"
                  ? ""
                  : sound_name
                    ? `${sound_name}.wav`
                    : "default",
              channel_id:
                sound_name && sound_name.toLowerCase() === "none"
                  ? "none"
                  : sound_name
                    ? `${sound_name}`
                    : "default",
            },
          },
          apns: {
            payload: {
              aps: {
                // badge: 5,
                sound:
                  sound_name && sound_name.toLowerCase() === "none"
                    ? ""
                    : sound_name
                      ? `${sound_name}.caf`
                      : "default",
              },
            },
            fcm_options: {
              image: noti_image,
            },
          },
        },
      };

      try {
        await axios.post(
          `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
          message,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
          }
        );

        // return response;
        console.log("Notification sent to topic:", topic);
      } catch (error) {
        console.error(
          "Error sending notification to topic",
          error.response ? error.response.data : error.message
        );
        // Attempt to unsubscribe even if notification fails
      }

      // Step 4: Unsubscribe from the topic
      const unsubscribeResult = await unsubscribeFromTopic(device_token, topic);
      if (!unsubscribeResult.success) {
        return {
          success: false,
          message: "Unsubscription failed",
          error: unsubscribeResult.error,
        };
      }

      return {
        success: true,
        message: "Notification sent and tokens unsubscribed",
      };
    } else {
      return {
        success: false,
        message: "Device token must be a non-empty array.",
      };
    }
  },

  notiSendWithOneSignal: async (notification_data) => {
    const {
      device_token,
      noti_title,
      noti_image,
      noti_msg,
      noti_for,
      room_type,
      sender_image,
      sender_id,
      sender_name,
      details,
      chat_room_id,
      call_type
    } = notification_data;

    let noti_data = {
      app_id: process.env.ONE_SIGNAL_APP_ID,
      contents: {
        en: noti_msg
      },
      headings: {
        en: noti_title
      },
      small_icon:"ic_chatboxx",
      // android_group: android_group,
      // android_group_message: android_group_message,
      include_player_ids: device_token,
      large_icon: noti_image,
      collapse_id: chat_room_id.toString(),
      priority:10,
      buttons: [
        {
          id: "reply",
          text: "Reply"
        }
      ],
      isAndroid: true,
      data: {
        call_type,
        noti_for,
        chat_room_id,
        room_type,
        sender_id,
        sender_name,
        sender_image,
        details,
      }
    }

    if (noti_for == "video_call" || noti_for == "audio_call") {
      noti_data.buttons = [
        {
          id: "decline",
          text: "Decline",
          action: "com.app.chatapp.DISMISS_NOTIFICATION"
        },
        {
          id: "answer",
          text: "Answer"
        }
      ]
    }

    const data = JSON.stringify(noti_data);

    const config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: 'https://api.onesignal.com/notifications',
      headers: {
        'Authorization': `Key ${process.env.ONE_SIGNAL_KEY}`,
        'accept': 'application/json',
        'content-type': 'application/json',
      },
      data: data,
    };

    try {
      const response = await axios.request(config);
      console.log(JSON.stringify(response.data));
      return {
        success: true,
        message: "Notification sent successfully",
        response: response.data,
      };
    } catch (error) {
      console.error("Error sending notification:", error);
      return {
        success: false,
        message: "Failed to send notification",
        error: error.message,
      };
    }
  },
};


// const notificationData = {
//   device_token: ["5fb13bd8-add8-4722-af8f-a0ddd6f0afa9"], // Array of player IDs
//   noti_title: "Jone Doe",
//   noti_msg: "Hi\nHello\nWhat are you doing\nLet's go.",
//   noti_for: "chat", // or "video_call", "audio_call"
//   room_type: "group", // or "private"
//   sender_image: "https://cdn.pixabay.com/photo/2023/04/21/15/42/portrait-7942151_1280.jpg",
//   sender_id: "user123",
//   sender_name: "John Doe",
//   details: "This is a message detail.",
//   chat_room_id: "room_456",

// };

// // Call the function
// notiSendWithOneSignal(notificationData)
//   .then(response => {
//     console.log("Notification Response:", response);
//   })
//   .catch(error => {
//     console.error("Error calling notification function:", error);
//   });