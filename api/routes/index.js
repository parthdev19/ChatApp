var logger = require("../../utils/logger");
const _ = require("lodash");
module.exports = function (router) {
  router.get("*", function (req, res) {
    logger.info("404 Hit", req.method, req.url);
    res.status(400);
  });
};
