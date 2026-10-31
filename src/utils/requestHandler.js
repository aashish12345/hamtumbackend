const {MESSAGES} = require('../constant');
const sendSuccess = (res, result = {},message) => {
    const response = {};
    response.result = result;
    response.time = new Date().getTime();
    if (message) {
        response.message = message;
    }
    return res.status(200).json(response);
  };

  const sendError = (res, err = {},message) => {
    const response = {};
    response.time = new Date().getTime();
    let errorCode = 404;
    if(!err.code){
        response.err = {code:500, message:MESSAGES.internalServer};
        errorCode = 500;
    }else{ 
        if (message) {
            response.message = message;
        }
        response.err = err;
    }
    return res.status(errorCode).json(response);
  };
  
  module.exports = {
    sendSuccess,
    sendError
  };