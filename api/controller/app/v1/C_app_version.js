const app_versions = require("../../../../models/M_app_version");
const user_interactions = require("../../../../models/M_user_interactions");
const mongoose = require("mongoose");
const subinterest = require("../../../../models/M_sub_interest");
const user_session = require("../../../../models/M_user_session");

const users = require("../../../../models/M_user");
const { successRes, errorRes } = require("../../../../utils/common_fun");

const addAppVersion = async (req, res) => {
  try {
    let {
      app_version,
      is_maintenance,
      app_update_status,
      app_platform,
      app_url,
      api_base_url,
      is_live,
    } = req.body;

    let insert_qry = await app_versions.create({
      app_version,
      is_maintenance,
      app_update_status,
      app_platform,
      app_url,
      api_base_url,
      is_live,
    });

    return await successRes(res, `App version added`, insert_qry);
  } catch (error) {
    console.log(error);
    return errorRes(res, "Internal server error");
  }
};

// const appVersionCheck = async (req, res) => {
//   try {
//     let {
//       app_version,
//       user_id,
//       app_platform,
//       device_token,
//       location,
//       address,
//       login_time
//     } = req.body;

//     const updatedUser = await users.findByIdAndUpdate(
//       user_id,
//       {
//         $set: {
//           user_last_active_date: login_time,
//         },
//       },
//     );
//     // const pipeline = [
//     //   {
//     //     $match: {
//     //       createdAt: { $lte: new Date(login_time) },
//     //       user_id: new mongoose.Types.ObjectId(user_id)
//     //     }
//     //   },
//     //   {
//     //     $group: {
//     //       _id: {
//     //         userId: '$_id',
//     //         createdAt: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
//     //       },
//     //     },
//     //   },
//     //   {
//     //     $group: {
//     //       _id: '$_id.createdAt',
//     //       userIds: { $addToSet: '$_id.userId' },
//     //       data: { $push: { userId: '$_id.userId', count: '$count' } },
//     //     },
//     //   },
//     //   { $sort: { _id: -1 } },
//     //   { $limit: 7 }
//     // ];

//     // const pipeline = [
//     //   {
//     //     $match: {
//     //       createdAt: { $lte: new Date(login_time) },
//     //       user_id: new mongoose.Types.ObjectId(user_id)
//     //     }
//     //   },
//     //   {
//     //     $group: {
//     //       _id: {
//     //         userId: '$_id',
//     //         createdAt: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
//     //       },
//     //     },
//     //   },
//     //   {
//     //     $group: {
//     //       _id: '$_id.createdAt',
//     //       userIds: { $addToSet: '$_id.userId' },
//     //       data: { $push: { userId: '$_id.userId', count: '$count' } },
//     //     },
//     //   },
//     //   { $sort: { _id: -1 } },
//     //   { $limit: 7 }
//     // ];

//     const pipeline = [
//       // Stage 1: Match documents based on provided criteria
//       {
//         $match: {
//           createdAt: { $lte: new Date(login_time) },
//           user_id: new mongoose.Types.ObjectId(user_id)
//         }
//       },
//       // Stage 2: Group by user ID and date
//       {
//         $group: {
//           _id: {
//             userId: '$_id',
//             createdAt: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
//           },
//           count: { $sum: 1 } // Count the documents within each group
//         }
//       },
//       // Stage 3: Group by date to collect all user IDs and their counts
//       {
//         $group: {
//           _id: '$_id.createdAt',
//           userIds: { $addToSet: '$_id.userId' },
//           data: { $push: { userId: '$_id.userId', count: '$count' } },
//         },
//       },
//       // Stage 4: Sort by date in descending order
//       { $sort: { _id: -1 } },
//       // Stage 5: Limit to the first 7 results
//       { $limit: 7 }
//     ];

//     const userImpressionData = await user_interactions.aggregate(pipeline);

//     const allIds = new Set();
//     userImpressionData.forEach(async entry => {
//       await entry.userIds.forEach(userId => {
//         allIds.add(userId);
//       });
//     });

//     const allIdsArray = [...allIds];

//     if (allIdsArray.length == 0) {

//       var find_subinterste = await subinterest.find({ is_deleted: false });

//       var find_user_interest = await users.findOne({ _id: user_id, is_deleted: false })
//       if (find_user_interest) {
//         find_user_interest?.interested.map(async (value) => {
//           find_subinterste?.map(async (data) => {
//             if (value.toString() == data?._id.toString()) {
//               var create_data = await user_interactions.create(
//                 {
//                   user_id: user_id,
//                   sub_interest_id: value,
//                   interest_id: data.interest_id,
//                 })
//             }
//           })
//         })
//       }
//     }

//     console.log("allIdsArray", JSON.stringify(allIdsArray))
//     var jkl_data = await user_interactions.deleteMany({
//       _id: { $nin: allIdsArray },
//       user_id: user_id,
//       createdAt: { $lt: new Date(login_time) }
//     });

//     var result = [];

//     let check_version = await app_versions.findOne().where({
//       app_version: app_version,
//       is_live: true,
//       app_platform: app_platform,
//       is_deleted: false,
//     });

//     var data = {
//       device_type: app_platform,
//       device_token: device_token,
//     };

//     if (user_id) {
//       data = { ...data, user_id: user_id };

//       var find_user = await users.findById(user_id);

//       if (find_user) {
//         result = {
//           ...result,
//           is_deleted: find_user.is_deleted,
//           is_active: find_user.is_active,
//           noti_badge: find_user.noti_badge,
//         };
//       }

//       if (device_token != undefined && device_token != null) {
//         let update_data = {
//           device_type: app_platform,
//           device_token: device_token,
//           app_version: app_version,
//         };

//         if (location) {
//           update_data = {
//             ...update_data,
//             location: JSON.parse(location),
//             address: address,
//           };
//         }

//         if (app_platform) {
//           if (app_platform == "ios") {
//             var device_type = "ios";
//           } else {
//             var device_type = "android";
//           }
//           update_data = { ...update_data, device_type: device_type };
//         }

//         await users.findByIdAndUpdate(user_id, update_data);
//       }
//       result["unread_notification"] = find_user?.noti_badge;
//     }

//     var app_update_status = "";

//     if (check_version) {
//       if (check_version.app_version != app_version) {
//         app_update_status = check_version.app_update_status;

//         if (app_update_status == "is_force_update") {
//           result = {
//             ...result,
//             is_need_update: false,
//             is_force_update: false,
//           };
//         } else {
//           result = {
//             ...result,
//             is_need_update: false,
//             is_force_update: false,
//           };
//         }
//       } else {
//         result = {
//           ...result,
//           is_need_update: false,
//           is_force_update: false,
//         };
//       }

//       result["is_maintenance"] = check_version.is_maintenance;
//     } else {
//       let check_version = await app_versions.findOne().where({
//         is_live: true,
//         app_platform: app_platform,
//         is_deleted: false,
//       });

//       app_update_status = check_version?.app_update_status;

//       if (app_update_status == "is_force_update") {
//         result = { ...result, is_need_update: false, is_force_update: false };
//       } else {
//         result = {
//           ...result,
//           is_need_update: false,
//           is_force_update: false,
//         };
//       }
//       result["is_maintenance"] = check_version?.is_maintenance;
//     }

//     return await successRes(res, `App version updated successfully`, result);
//   } catch (error) {
//     console.log(error);
//     return errorRes(res, "Internal server error");
//   }
// };

const appVersionCheck = async (req, res) => {
  try {
    let {
      app_version,
      user_id,
      app_platform,
      device_token,
      location,
      address,
      login_time,
    } = req.body;

    const updatedUser = await users.findByIdAndUpdate(user_id, {
      $set: {
        user_last_active_date: login_time,
      },
    });

    if (app_version == "1.0.12 " && app_platform== "ios" ) {

    }
    // const pipeline = [
    //   {
    //     $match: {
    //       createdAt: { $lte: new Date(login_time) },
    //       user_id: new mongoose.Types.ObjectId(user_id)
    //     }
    //   },
    //   {
    //     $group: {
    //       _id: {
    //         userId: '$_id',
    //         createdAt: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
    //       },
    //     },
    //   },
    //   {
    //     $group: {
    //       _id: '$_id.createdAt',
    //       userIds: { $addToSet: '$_id.userId' },
    //       data: { $push: { userId: '$_id.userId', count: '$count' } },
    //     },
    //   },
    //   { $sort: { _id: -1 } },
    //   { $limit: 7 }
    // ];

    // const pipeline = [
    //   {
    //     $match: {
    //       createdAt: { $lte: new Date(login_time) },
    //       user_id: new mongoose.Types.ObjectId(user_id)
    //     }
    //   },
    //   {
    //     $group: {
    //       _id: {
    //         userId: '$_id',
    //         createdAt: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
    //       },
    //     },
    //   },
    //   {
    //     $group: {
    //       _id: '$_id.createdAt',
    //       userIds: { $addToSet: '$_id.userId' },
    //       data: { $push: { userId: '$_id.userId', count: '$count' } },
    //     },
    //   },
    //   { $sort: { _id: -1 } },
    //   { $limit: 7 }
    // ];

    const pipeline = [
      // Stage 1: Match documents based on provided criteria
      {
        $match: {
          createdAt: { $lte: new Date(login_time) },
          user_id: new mongoose.Types.ObjectId(user_id),
        },
      },
      // Stage 2: Group by user ID and date
      {
        $group: {
          _id: {
            userId: "$_id",
            createdAt: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
          },
          count: { $sum: 1 }, // Count the documents within each group
        },
      },
      // Stage 3: Group by date to collect all user IDs and their counts
      {
        $group: {
          _id: "$_id.createdAt",
          userIds: { $addToSet: "$_id.userId" },
          data: { $push: { userId: "$_id.userId", count: "$count" } },
        },
      },
      // Stage 4: Sort by date in descending order
      { $sort: { _id: -1 } },
      // Stage 5: Limit to the first 7 results
      { $limit: 7 },
    ];

    const userImpressionData = await user_interactions.aggregate(pipeline);

    const allIds = new Set();
    userImpressionData.forEach(async (entry) => {
      await entry.userIds.forEach((userId) => {
        allIds.add(userId);
      });
    });

    const allIdsArray = [...allIds];

    if (allIdsArray.length == 0) {
      var find_subinterste = await subinterest.find({ is_deleted: false });

      var find_user_interest = await users.findOne({
        _id: user_id,
        is_deleted: false,
      });
      if (find_user_interest) {
        find_user_interest?.interested.map(async (value) => {
          find_subinterste?.map(async (data) => {
            if (value.toString() == data?._id.toString()) {
              var create_data = await user_interactions.create({
                user_id: user_id,
                sub_interest_id: value,
                interest_id: data.interest_id,
              });
            }
          });
        });
      }
    }

    console.log("allIdsArray", JSON.stringify(allIdsArray));
    var jkl_data = await user_interactions.deleteMany({
      _id: { $nin: allIdsArray },
      user_id: user_id,
      createdAt: { $lt: new Date(login_time) },
    });

    var result = [];

    let check_version = await app_versions.findOne().where({
      app_version: app_version,
      is_live: true,
      app_platform: app_platform,
      is_deleted: false,
    });

    var data = {
      device_type: app_platform,
      device_token: device_token,
    };

    if (user_id) {
      data = { ...data, user_id: user_id };

      var find_user = await users.findById(user_id);

      if (find_user) {
        result = {
          ...result,
          is_deleted: find_user.is_deleted,
          is_active: find_user.is_active,
          noti_badge: find_user.noti_badge,
        };
      }

      if (device_token != undefined && device_token != null) {
        let update_data = {
          device_type: app_platform,
          device_token: device_token,
          app_version: app_version,
        };

        if (location) {
          update_data = {
            ...update_data,
            location: JSON.parse(location),
            address: address,
          };
        }

        if (app_platform) {
          if (app_platform == "ios") {
            var device_type = "ios";
          } else {
            var device_type = "android";
          }
          update_data = { ...update_data, device_type: device_type };
        }

        await user_session.updateOne(
          { user_id: user_id, device_token: device_token },
          { $set: { update_data } },
          { new: true }
        );
      }
      // result["unread_notification"] = find_user?.noti_badge;
    }

    var app_update_status = "";

    if (check_version) {
      if (check_version.app_version != app_version) {
        app_update_status = check_version.app_update_status;

        if (app_update_status == "is_force_update") {
          result = {
            ...result,
            is_need_update: true,
            is_force_update: true,
          };
        } else {
          result = {
            ...result,
            is_need_update: true,
            is_force_update: false,
          };
        }
      } else {
        result = {
          ...result,
          is_need_update: false,
          is_force_update: false,
        };
      }

      result["is_maintenance"] = check_version.is_maintenance;
    } else {
      let check_version = await app_versions.findOne().where({
        is_live: true,
        app_platform: app_platform,
        is_deleted: false,
      });

      if (check_version) {
        app_update_status = check_version?.app_update_status;

        if (app_update_status == "is_force_update") {
          result = { ...result, is_need_update: true, is_force_update: true };
        } else {
          result = {
            ...result,
            is_need_update: true,
            is_force_update: false,
          };
        }
        result["is_maintenance"] = check_version?.is_maintenance;
      } else {
        result = { ...result, is_need_update: false, is_force_update: false };

        return await successRes(
          res,
          `No any version available for this platform`,
          result
        );
      }
    }

    return await successRes(res, `App version updated successfully`, result);
  } catch (error) {
    console.log(error);
    return errorRes(res, "Internal server error");
  }
};

module.exports = {
  addAppVersion,
  appVersionCheck,
};
