

const router = require("express").Router();
const multipart = require("connect-multiparty");
const multipartMiddleware = multipart();
const userAuth = require("./../../../middlewares/auth");
const validateRequest = require("../../../middlewares/validation");

const {
    uploadGroupImage,
    changeGroupIcon,
    editGroup,
    userListForGroup
} = require("./../../../controller/app/v1/C_group");

const { 
    editGroupDto
} = require("./../../../dto/app/v1/group_dto");

router.post("/upload_group_image", multipartMiddleware, userAuth, uploadGroupImage);

router.post("/user_list_for_group", multipartMiddleware, userAuth, userListForGroup);

router.post("/change_group_icon", multipartMiddleware, userAuth, changeGroupIcon);

router.post("/edit_group", multipartMiddleware, userAuth, validateRequest(editGroupDto) ,editGroup);

module.exports = router;