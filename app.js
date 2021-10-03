const express = require('express');
const app = express();
const http = require('http');
const appConfig = require('./config/appConfig');
const mongoose = require('mongoose');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');

const morgan = require('morgan')


var helmet = require('helmet')
const logger = require('./app/libs/loggerLib');

const globalErrorMiddleware = require('./app/middlewares/appErrorHandler');
//for loggining which route is called along with ip address(from which ip call is made)
const routeLoggerMiddleware = require('./app/middlewares/routeLogger')

app.listen(appConfig.port, ()=>{
    console.log('Accubites app listening on port 3000!')
    let db = mongoose.connect(appConfig.db.uri)
})

//middlewares
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:false}));
app.use(cookieParser());
app.use(routeLoggerMiddleware.logIp);
app.use(morgan('dev'))
app.use(helmet())
app.use(globalErrorMiddleware.globalErrorHandler)



const modelsPath = './app/models';
const routesPath = './app/routes';

app.all('*', function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE')
    next();
});

//Bootstrap models
fs.readdirSync(modelsPath).forEach(function(file){
    if(~file.indexOf('.js'))
        require(modelsPath+'/'+file)
})

// Bootstrap route
fs.readdirSync(routesPath).forEach(function(file) {
    if (~file.indexOf('.js')) {
      let route = require(routesPath + '/' + file);
      route.setRouter(app);
    }
  });
//end ofbootstrap routes

// calling global 404 handler after route
app.use(globalErrorMiddleware.globalNotFoundHandler)

//creating the server
const server = http.createServer(app);
//console.log(appConfig);
server.listenerCount(appConfig.port);
server.on('error', onError);
server.on('listening', onListening);

/**
 * Event listener for HTTP server "error" event.
 */


function onError(error) {
    if (error.syscall !== 'listen') {
      logger.error(error.code + ' not equal listen', 'serverOnErrorHandler', 10)
      throw error;
    }
  
  
    // handle specific listen errors with friendly messages
    switch (error.code) {
      case 'EACCES':
        logger.error(error.code + ':elavated privileges required', 'serverOnErrorHandler', 10);
        process.exit(1);
        break;
      case 'EADDRINUSE':
        logger.error(error.code + ':port is already in use.', 'serverOnErrorHandler', 10);
        process.exit(1);
        break;
      default:
        logger.error(error.code + ':some unknown error occured', 'serverOnErrorHandler', 10);
        throw error;
    }
  }
  
  /**
   * Event listener for HTTP server "listening" event.
   */
  
  function onListening() {
    
    var addr = server.address();
    var bind = typeof addr === 'string'
      ? 'pipe ' + addr
      : 'port ' + addr.port;
    ('Listening on ' + bind);
    logger.info('server listening on port' + addr.port, 'serverOnListeningHandler', 10);
    let db = mongoose.connect(appConfig.db.uri,{ useMongoClient: true });
  }
  
  process.on('unhandledRejection', (reason, p) => {
    console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
    // application specific logging, throwing an error, or other logic here
  });
  
  
  /**
   * database connection settings
   */
  


mongoose.connection.on('error', function(err){
    console.log('database connection error');
    console.log(err);
})//end mongoose connection error
//handling mongoose success event
mongoose.connection.on('open', function(err){
    if(err){
        console.log('database error');
        console.log(err);
    }
    else{
        console.log('database connection open success');
    }
})//end mongoose connection open handler

module.exports = app;
