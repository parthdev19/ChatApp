const fs = require("fs");
const { errorRes } = require("./common_fun");

const removeFile = (data) => {
  try {
    const filepath = "./uploads/" + data;

    if (Array.isArray(data)) {
      data.map((images) => {
        const filepath = "./uploads/" + images;
        fs.unlink(filepath, function (error) {
          if (error) return error;
        });
      });
    } else {
      fs.unlink(filepath, function (error) {
        if (error) return error;
      });
    }
  } catch (error) {
    return errorRes(res, error.message);
  }
};

module.exports = { removeFile };
