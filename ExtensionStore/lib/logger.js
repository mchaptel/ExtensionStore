
// log a series of values to the messageLog and command line window. Can pass as many arguments as necessary.

// Logger class -------------------------------------------------------
/**
 * @constructor
 * @classdesc
 * The Logger class allows to output messages to the log with different levels
 * @param {string} [name]
 */
 function Logger(name) {
  if (typeof name === 'undefined') var name = "";
  this.name = name;
  // by default will only output errors and log
  this.LEVEL = { "ERROR": 0, "LOG": 1, "DEBUG": 2 };
  if (typeof Logger.level === 'undefined') Logger.level = this.LEVEL.LOG;
  if (MessageLog.isDebug()) Logger.level = this.LEVEL.DEBUG;
}


/**
 * Outputs a message only if the logger is set to output a level of verbosity equal to LOG
 */
Logger.prototype.info = function () {
  if (Logger.level >= this.LEVEL.LOG) this.trace([].slice.call(arguments));
}

/**
 * Outputs a message only if the logger is set to output a level of verbosity equal to DEBUG
 */
Logger.prototype.debug = function () {
  if (Logger.level >= this.LEVEL.DEBUG) this.trace([].slice.call(arguments));
}


/**
 * Outputs a message only if the logger is set to output a level of verbosity equal to ERROR
 */
Logger.prototype.error = function () {
  if (Logger.level >= this.LEVEL.ERROR) this.trace([].slice.call(arguments));
}


/**
 * Outputs the given message. Used internally.
 */
Logger.prototype.trace = function (message) {
  // handling printing out errors properly
  for (var m in message){
    if (message[m] instanceof Error){
      var error = message[m];
      message[m] = "Error: "+error.message+" (line " + error.lineNumber + " in file '" + error.fileName + "')";
    }
  }
  if (this.name) var message = this.name + ": " + message.join(" ");
  try {
    MessageLog.trace(message);
    System.println(message);
  } catch (err) {
    for (var i in message) {
      try{
        MessageLog.trace(message);
      }catch(err){
        MessageLog.trace(i);
      }
    }
  }
}

exports.Logger = Logger