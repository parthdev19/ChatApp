const jwt = require("jsonwebtoken");
const users = require("../models/M_user");

const { errorRes, authFailRes } = require("../../utils/common_fun");

const verifyToken = async (req, res, next) => {
  try {
    const bearerHeader = req.headers["authorization"];

    if (!bearerHeader) {
      return errorRes(res, `A token is required for authentication.`);
    }

    const bearer = bearerHeader.split(" ");
    const bearerToken = bearer[1];

    const { id } = jwt.verify(bearerToken, process.env.TOKEN_KEY);
    const findUsers = await users.findById(id).where({
      is_deleted: false,
      // is_block: false,
    });

    if (!findUsers) {
      return await authFailRes(res, "Authentication failed.");
    }
    req.user = findUsers;
    req.user.token = bearerToken;
    next();
  } catch (error) {
    console.error("JWT ERROR:", error);

    if (error.message === "jwt malformed") {
      return await authFailRes(res, "Authentication failed: Malformed token.");
    }

    if (error.message === "invalid signature") {
      return await authFailRes(
        res,
        "Authentication failed: Invalid signature."
      );
    }

    if (error.message === "jwt expired") {
      return await authFailRes(res, "Authentication failed: Token expired.");
    }

    return await errorRes(res, "Internal server error");
  }
};

module.exports = verifyToken;
