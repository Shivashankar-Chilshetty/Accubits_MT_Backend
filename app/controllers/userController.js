const mongoose = require('mongoose');
const shortid = require('shortid');
const time = require('../libs/timeLib')
const response = require('../libs/responseLib')
const validateInput = require('./../libs/paramsValidationLib')
const check = require('../libs/checkLib')
const logger = require('../libs/loggerLib')
const passwordLib = require('../libs/generatePasswordLib')
const token = require('../libs/tokenLib')

const UserModel = mongoose.model('User');
const AuthModel = mongoose.model('Auth');



let getAllUser = (req, res) => {
    UserModel.find()
        .select('-__v-_id') //fields to be hidden
        .lean()  //converting the mongoose object to the plain JS object
        .exec((err, result) => {
            if (err) {
                console.log(err)
                logger.error(err.message, 'User Controller: getAllUser', 10)
                let apiResponse = response.generate(true, 'Failed To Find User Details', 500, null)
                res.send(apiResponse)
            } else if (check.isEmpty(result)) {
                logger.info('No User Found', 'User Controller: getAllUser')
                let apiResponse = response.generate(true, 'No User Found', 404, null)
                res.send(apiResponse)
            } else {
                let finalRes = result.map((item) => {
                    delete item._id
                    delete item.__v
                    delete item.password;
                    return item
                })
                let apiResponse = response.generate(false, 'All User Details Found', 200, finalRes)
                res.send(apiResponse)
            }
        })

}// end get all users



let getSingleUser = (req, res) => {
    let deleteAuthToken = (req, res) => {
        return new Promise((resolve, reject) => {
            AuthModel.findOneAndRemove({ 'userId': req.params.userId }, (err, authDetails) => {
                if (err) {
                    console.log(err)
                    logger.error(err.message, 'AuthorizationMiddleware', 10)
                    let apiResponse = responseLib.generate(true, 'Failed To Authorized', 500, null)
                    reject(apiResponse)
                } else if (check.isEmpty(authDetails)) {
                    logger.error('No AuthorizationKey Is Present', 'AuthorizationMiddleware', 10)
                    let apiResponse = responseLib.generate(true, 'Invalid Or Expired AuthorizationKey', 404, null)
                    reject(apiResponse)
                } else {
                    resolve()
                }
            })
        })
    }
    let findUser = () => {
        return new Promise((resolve, reject) => {
            UserModel.findOne({ 'userId': req.params.userId }, (err, result) => {
                if (err) {
                    console.log(err)
                    logger.error(err.message, 'User Controller: getSingleUser', 10)
                    let apiResponse = response.generate(true, 'Failed To Find User Details', 500, null)
                    reject(apiResponse)
                } else if (check.isEmpty(result)) {
                    logger.info('No User Found', 'User Controller:getSingleUser')
                    let apiResponse = response.generate(true, 'No User Found', 404, null)
                    reject(apiResponse)
                } else {
                    resolve(result)
                }
            })
        })
    }


    let generateToken = (userDetails) => {
        return new Promise((resolve, reject) => {
            token.generateToken(userDetails, (err, tokenDetails) => {
                if (err) {
                    console.log(err)
                    let apiResponse = response.generate(true, 'Failed to generate token', 500, null)
                    reject(apiResponse)
                }
                else {
                    tokenDetails.userId = userDetails.userId
                    tokenDetails.userDetails = userDetails
                    resolve(tokenDetails)
                }
            })
        })
    }

    let saveToken = (tokenDetails) => {
        return new Promise((resolve, reject) => {
            AuthModel.findOne({ userId: tokenDetails.userId }, (err, retrievedTokenDetails) => {
                if (err) {
                    logger.error(err.message, 'userController:saveToken', 10)
                    let apiResponse = response.generate(true, 'Failed to save token', 500, null)
                    reject(apiResponse)
                }
                else if (check.isEmpty(retrievedTokenDetails)) {
                    let newAuthToken = new AuthModel({
                        userId: tokenDetails.userId,
                        authToken: tokenDetails.token,
                        tokenSecret: tokenDetails.tokenSecret,
                        tokenGenerationTime: time.now()
                    })
                    newAuthToken.save((err, newTokenDetails) => {
                        if (err) {
                            console.log(err)
                            logger.error(err.message, 'userController:saveToken()', 10)
                            let apiResponse = response.generate(true, 'Failed to generate token', 500, null)
                            reject(apiResponse)
                        }
                        else {
                            let responseBody = {
                                authToken: newTokenDetails.authToken,
                                userDetails: tokenDetails.userDetails
                            }
                            resolve(responseBody)
                        }
                    })
                }
            })
        })
    }

    deleteAuthToken(req, res)
        .then(findUser)
        .then(generateToken)
        .then(saveToken)
        .then((resolve) => {
            delete resolve.password
            let apiResponse = response.generate(false, 'Authtoken expiry time increased', 200, resolve)
            res.send(apiResponse)
        })
        .catch((err) => {
            console.log(err)
            res.send(err)
        })

}// end get single user





let signUpFunction = (req, res) => {
    let validateUserInput = () => {
        return new Promise((resolve, reject) => {
            if (req.body.email) {
                if (!validateInput.Email(req.body.email)) {
                    let apiResponse = response.generate(true, 'Email Does Not meet the requirement', 400, null);
                    reject(apiResponse);
                }
                else if (check.isEmpty(req.body.password)) {
                    let apiResponse = response.generate(true, '"password" parameter is missing', 400, null);
                    reject(apiResponse);
                }
                else {
                    resolve(req);
                }
            }
            else {
                logger.error('Field Missing During User creation', 'userController : createUser()', 5)
                let apiResponse = response.generate(true, 'One or More Parameters is missing', 400, null)
                reject(apiResponse)
            }
        })
    }
    let createUser = () => {
        return new Promise((resolve, reject) => {
            UserModel.findOne({ email: req.body.email }, (err, retrievedUserDetails) => {
                if (err) {
                    logger.error(err.message, 'userController:createUser', 10)
                    let apiResponse = response.generate(true, 'failed to create User', 500, null)
                    reject(apiResponse)
                }
                else if (check.isEmpty(retrievedUserDetails)) {
                    let newUser = new UserModel({
                        userId: shortid.generate(),
                        name: req.body.name,
                        email: req.body.email.toLowerCase(),
                        password: passwordLib.hashpassword(req.body.password),
                        createdOn: time.now()
                    })
                    newUser.save((err, newUser) => {
                        if (err) {
                            console.log(err)
                            logger.error(err.message, 'userController:createUser', 10)
                            let apiResponse = response.generate(true, 'Failed to create new user', 500, null)
                            reject(apiResponse)
                        }
                        else {
                            let newUserObj = newUser.toObject();
                            resolve(newUserObj)
                        }
                    })
                }
                else {
                    logger.error('User Cannot Be created . User Already present', 'userController:createUser', 4)
                    let apiResponse = response.generate(true, 'User Already Present with this email', 403, null)
                    reject(apiResponse)
                }
            })
        })
    }//end create user function
    validateUserInput(req, res)
        .then(createUser)
        .then((resolve) => {
            delete resolve.password
            let apiResponse = response.generate(false, 'User created', 200, resolve)
            res.send(apiResponse)
        })
        .catch((err) => {
            console.log(err)
            res.send(err)
        })


}// end user signup function 

//start of login function
let loginFunction = (req, res) => {
    let findUser = () => {
        return new Promise((resolve, reject) => {
            if (req.body.email) {
                UserModel.findOne({ email: req.body.email }, (err, userDetails) => {
                    if (err) {
                        console.log(err)
                        logger.error('Failed to retrieve data', 'userController:findUser()', 10)
                        let apiResponse = response.generate(true, 'Failed to find user details', 500, null)
                        reject(apiResponse)
                    }
                    else if (check.isEmpty(userDetails)) {
                        logger.error('No  User Found', ' userController:findUser()', 7)
                        let apiResponse = response.generate(true, '"No User details found in DB, kindly signup', 400, null)
                        reject(apiResponse)
                    }
                    else {
                        logger.info('User Founnd', 'userController:findUser', 10)
                        resolve(userDetails)
                    }
                })
            }
            else {
                let apiResponse = response.generate(true, 'email Parameter is missing', 400, null)
                reject(apiResponse)
            }
        })
    }
    let validatePassword = (retrievedUserDetails) => {
        return new Promise((resolve, reject) => {
            passwordLib.comparePassword(req.body.password, retrievedUserDetails.password, (err, isMatch) => {
                if (err) {
                    console.log(err)
                    logger.error(err.message, 'userController:validatePassword()', 10)
                    let apiResponse = response.generate(true, 'Login Failed', 500, null)
                    reject(apiResponse)
                }
                else if (isMatch) {
                    let retrievedUserDetailsObj = retrievedUserDetails.toObject()
                    delete retrievedUserDetailsObj.password
                    delete retrievedUserDetailsObj._id
                    delete retrievedUserDetailsObj.__v
                    delete retrievedUserDetailsObj.createdOn
                    resolve(retrievedUserDetailsObj)
                }
                else {
                    logger.info('Login Failed Due to Invalid Password', 'userController:validatePassword()', 10)
                    let apiResponse = response.generate(true, 'Wrong Passsword.Login Failed', 400, null)
                    reject(apiResponse)
                }
            })
        })
    }

    let generateToken = (userDetails) => {
        return new Promise((resolve, reject) => {
            token.generateToken(userDetails, (err, tokenDetails) => {
                if (err) {
                    console.log(err)
                    let apiResponse = response.generate(true, 'Failed to generate token', 500, null)
                    reject(apiResponse)
                }
                else {
                    tokenDetails.userId = userDetails.userId
                    tokenDetails.userDetails = userDetails
                    resolve(tokenDetails)
                }
            })
        })
    }

    let saveToken = (tokenDetails) => {
        return new Promise((resolve, reject) => {
            AuthModel.findOne({ userId: tokenDetails.userId }, (err, retrievedTokenDetails) => {
                if (err) {
                    logger.error(err.message, 'userController:saveToken', 10)
                    let apiResponse = response.generate(true, 'Failed to generate token', 500, null)
                    reject(apiResponse)
                }
                else if (check.isEmpty(retrievedTokenDetails)) {
                    let newAuthToken = new AuthModel({
                        userId: tokenDetails.userId,
                        authToken: tokenDetails.token,
                        tokenSecret: tokenDetails.tokenSecret,
                        tokenGenerationTime: time.now()
                    })
                    newAuthToken.save((err, newTokenDetails) => {
                        if (err) {
                            console.log(err)
                            logger.error(err.message, 'userController:saveToken()', 10)
                            let apiResponse = response.generate(true, 'Failed to generate token', 500, null)
                            reject(apiResponse)
                        }
                        else {
                            let responseBody = {
                                authToken: newTokenDetails.authToken,
                                userDetails: tokenDetails.userDetails
                            }
                            resolve(responseBody)
                        }
                    })
                }
                else {
                    retrievedTokenDetails.authToken = tokenDetails.token
                    retrievedTokenDetails.tokenSecret = tokenDetails.tokenSecret
                    retrievedTokenDetails.tokenGenerationTime = time.now()
                    retrievedTokenDetails.save((err, newTokenDetails) => {
                        if (err) {
                            console.log(err)
                            logger.error(err.message, 'userController:saveToken()', 10)
                            let apiResponse = response.generate(true, 'Failed to generate token', 500, null)
                            reject(apiResponse)
                        }
                        else {
                            let responseBody = {
                                authToken: newTokenDetails.authToken,
                                userDetails: tokenDetails.userDetails
                            }
                            resolve(responseBody)
                        }
                    })
                }
            })

        })
    }


    findUser(req, res)
        .then(validatePassword)
        .then(generateToken)
        .then(saveToken)
        .then((resolve) => {
            let apiResponse = response.generate(false, 'Login Successful', 200, resolve)
            res.status(200)
            res.send(apiResponse)
        })
        .catch((err) => {
            console.log(err)
            res.status(err.status)
            res.send(err)
        })
}

let getListOfLoggedInUsers = (req, res) => {
    AuthModel.find({}, (err, result) => {
        if (err) {
            console.log(err)
            logger.error(err.message, 'User Controller: getListOfLoggedInUsers', 10)
            let apiResponse = response.generate(true, 'Failed To Find Logged-In user Details', 500, null)
            res.send(apiResponse)
        } else if (check.isEmpty(result)) {
            logger.info('No User Found', 'User Controller: getListOfLoggedInUsers')
            let apiResponse = response.generate(true, 'No User Logged-In yet!', 404, null)
            res.send(apiResponse)
        } else {
            let apiResponse = response.generate(false, 'All Logged-In User Details Found', 200, result)
            res.send(apiResponse)
        }
    })
}

module.exports = {
    signUpFunction: signUpFunction,
    loginFunction: loginFunction,
    getAllUser: getAllUser,
    getSingleUser: getSingleUser,
    getListOfLoggedInUsers: getListOfLoggedInUsers
}