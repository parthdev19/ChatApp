const joi = require("joi");

const editGroupDto = joi.object().keys({
  group_id: joi.string().required().label("Group id"),
  group_name: joi.string().allow().label("Group name"),
  group_description: joi.string().allow().label("Group description"),
});

module.exports = {
    editGroupDto
};
