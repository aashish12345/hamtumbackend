const MESSAGES = require('./messages');
const ERROR_CODE = require('./errorCode');
const USER_TYPE = require('./userType');
const EMAIL = require('./email');
const SMS= require('./sms');
const AWS=require('./awsCredencials');
const ENCDNC = require('./encDecKey');
const COMMON=require('./common');

const PAYMENT=require('./payment');
const FEATUREFLAGS = require('./featureFlag');
module.exports = {
    MESSAGES,
    ERROR_CODE,
    USER_TYPE,
    EMAIL,
    SMS,
    AWS,
    ENCDNC,
    COMMON,
    PAYMENT,
    FEATUREFLAGS

};