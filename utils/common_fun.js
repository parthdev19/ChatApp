const { toNumber } = require("lodash");

const successRes = async (res, msg, data) => {
  return res.send({
    success: true,
    statuscode: 1,
    message: msg,
    data: data,
  });
};

const multiSuccessRes = async (res, msg, data, total_count) => {
  return res.send({
    success: true,
    statuscode: 1,
    message: msg,
    total_number_of_data: total_count,
    data: data,
  });
};

const multiSuccesspageRes = async (
  res,
  msg,
  data,
  currentPage,
  pageSize,
  totalCount
) => {
  const totalPages = Math.ceil(totalCount / pageSize);
  const hasPrevious = currentPage > 1;
  const hasNext = currentPage < totalPages;

  return res.status(200).json({
    success: true,
    statusCode: 1,
    message: msg,
    pagination: {
      currentPage: toNumber(currentPage),
      totalPages: totalPages,
      pageSize: toNumber(pageSize),
      totalCount: totalCount,
      hasPrevious: hasPrevious,
      hasNext: hasNext,
    },
    data: data,
  });
};

const errorRes = async (res, msg) => {
  return res.status(400).json({
    success: false,
    statuscode: 0,
    message: msg,
  });
};

const authFailRes = async (res, msg) => {
  return res.status(401).json({
    success: false,
    statuscode: 101,
    message: msg,
  });
};

const webAuthFailRes = async (res, msg) => {
  return res.send({
    success: false,
    statuscode: 101,
    message: msg,
  });
};

const statusSuccessRes = async (res, msg, data,key_status, any_status) => {
  return res.send({
    success: true,
    statuscode: 1,
    message: msg,
    [key_status]: any_status,
    data: data,
  });
};

//socket response
const socketErrorRes = async (msg) => {
  return ({
    success: false,
    statuscode: 0,
    message: msg,
  });
};

const socketErrRes = async (msg,err) => {
  return ({
    success: false,
    statuscode: 0,
    message: msg,
    error:err
  });
};

const socketSuccessRes = async (msg, info,extraData = {}) => {
  return ({
    success: true,
    statuscode: 1,
    message: msg,
    data: info,
    ...extraData
  });
};

const socketMultiSuccessRes = async (msg, count, info, extraData = {}) => {
  return {
    success: true,
    statuscode: 1,
    message: msg,
    total: count,
    data: info,
    ...extraData, // Spread additional dynamic key-value pairs
  };
};


module.exports = {
  successRes,
  errorRes,
  authFailRes,
  webAuthFailRes,
  multiSuccessRes,
  statusSuccessRes,
  multiSuccesspageRes,
  socketErrorRes,
  socketErrRes,
  socketSuccessRes,
  socketMultiSuccessRes,
};
