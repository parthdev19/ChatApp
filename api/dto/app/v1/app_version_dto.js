const joi = require("joi");
const addAppVersionDto = joi.object().keys({
    app_version: joi.string().allow().label("App version"),
    is_maintenance: joi.string().allow().label("Is maintenance"),
    app_update_status: joi.string().allow().label("App update status"),
    app_platform: joi.string().allow().label("App platform"),
    app_url: joi.string().allow().label("App url"),
    api_base_url: joi.string().allow().label("API base url"),
    is_live: joi.string().allow().label("Is live"),
});

const appVersionCheckDto = joi.object().keys({
    app_version: joi.string().allow().label("App version"),
    user_id: joi.string().allow().label("User id"),
    login_time: joi.string().allow().label("Login time"),
    app_platform: joi.string().allow().label("App platform"),
    device_token: joi.string().allow().label("Device token"),
    location: joi.string().allow().label("Location"),
    address: joi.string().allow().label("Address"),
});

module.exports = {
    addAppVersionDto,
    appVersionCheckDto,
}