const express = require('express');
const router = express.Router();
const userController = require("../controllers/userController");
const appConfig = require("../../config/appConfig")

const auth = require('./../middlewares/auth')


module.exports.setRouter = (app) => {

    let baseUrl = `${appConfig.apiVersion}/users`;

	app.get(`${baseUrl}/view/all`, auth.isAuthorized,  userController.getAllUser);
    
    app.get(`${baseUrl}/:userId/details/query`,  userController.getSingleUser);
    
    app.post(`${baseUrl}/signup`, userController.signUpFunction);
    
    app.post(`${baseUrl}/login`, userController.loginFunction);

    app.get(`${baseUrl}/loginLists`,  userController.getListOfLoggedInUsers);
    
}
