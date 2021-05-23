var Logger = require("logger.js").Logger
var log = new Logger("CURL")

// NetworkConnexionHandler Class --------------------------------------
/**
 * @constructor
 * @classdesc
 * The NetworkConnexionHandler class handles web queries and downloads. It uses curl for communicating with the remote apis. <br>
 * This class extends QObject so it can broadcast signals and be threaded.
 * @extends QObject
 */
function NetworkConnexionHandler() {
  this.curl = new CURL();
}


/**
 * Makes a network request and get the result as a parsed JSON.
 */
NetworkConnexionHandler.prototype.get = function (command) {
  // handle errors
  var result = this.curl.get(command);
  try {
    json = JSON.parse(result);
    if (json.hasOwnProperty("message")) {
      if (json.message == "Not Found") {
        log.error("File not present in repository : " + this._url);
        return null;
      }
      if (json.message == "Not Found") {
        log.error("File not present in repository : " + this._url);
        return null;
      }
      if (json.message == "Moved Permanently") {
        log.error("Repository " + this._url + " has moved to : " + json.url);
        return json;
      }
      if (json.message == "400: Invalid request") {
        log.error("Couldn't reach repository : " + this._url + ". Make sure it is a valid github address.")
        return null;
      }
    }
    return json;
  } catch (error) {
    var message = ("command " + command + " did not return a valid JSON : " + result);
    log.error(message, error);
    throw new Error(message);
  }
}


/**
 * Makes a download request for the given file url, and downloads it to the chosen location
 */
NetworkConnexionHandler.prototype.download = function (url, destinationPath) {
  url = url.replace(/ /g, "%20");
  destinationPath = destinationPath.replace(/[ :\?\*"\<\>\|][^/\\]/g, "");

  var command = ["-L", "-o", destinationPath, url];
  var result = this.curl.get(command, 30000); // 30s timeout
  return result;
}



// WebIcon Class -----------------------------------------------------
function WebIcon(url) {
  this.log = new Logger("Icon")
  if (url.indexOf(".png") == -1){
    // dealing with a website, we'll get the favicon
    url = "https://www.google.com/s2/favicons?sz=32&domain_url=" + url;
  }

  this.log.debug("new icon : "+url)
  this.url = url;

  var fileName = url.split("/").pop()
  this.dlUrl = specialFolders.temp + "/HUES_iconscache/" + fileName + ".png"
}

WebIcon.prototype.download = function (callback) {
  this.log.debug(this.dlUrl);
  var icon = new QFile(this.dlUrl);
  if (icon.exists()){
    this.log.debug("file exists")
    callback.apply(this, []);
  } else {
    this.log.debug("starting download of icon "+this.url);
    var curl = new CURLProcess(this.url);
    var p = curl.asyncDownload(this.dlUrl);
    p["finished(int)"].connect(this, callback)
  }
}

WebIcon.prototype.setToWidget = function(widget){
  this.widget = widget;
  this.log.debug(widget)
  this.download(this.setIcon)
}


WebIcon.prototype.setIcon = function () {
  this.log.debug("download finished, setting icon")
  this.log.debug("icon url : "+this.dlUrl)
  var icon = new QIcon(this.dlUrl);
  this.widget.icon = icon;
}


// CURLProcess Class -------------------------------------------------

/**
 * This class wraps a CURL Qprocess and handles the outputs.
 * Can perform asynchronous or inline operations without blocking the UI.
 * @param {*} command
 */
function CURLProcess (command) {
  this.curl = new CURL()
  this.log = new Logger("CURL")

  // The toonboom bundled curl doesn't seem to be equiped for ssh so we have to use unsafe mode
  if (typeof command == "string") var command = [command];
  if (this.curl.bin.indexOf("bin_3rdParty") != -1) command = ["-k"].concat(command);
  this.command = ["-s", "-S"].concat(command);

  var bin = this.curl.bin.split("/");
	this.app = bin.pop();
	var directory = bin.join("\\");

  this.process = new QProcess();
	this.process.setWorkingDirectory(directory);
}

/**
 * Launches a curl process, and optionally connects callbacks to the readyRead and finished signals.
 * The callbacks will be passed the output from the process, as well as the returncode for finishedCallback.
 * @param {function} readCallback  the callback attached to the 'readyRead' signal, if valid. Signature must be readCallback(QString/QBytesArray)
 * @param {function} finishedCallback  the callback attached to the 'finished' signal, if valid. Signature must be finishedCallback(QProcess.ExitCode, QString/QBytesArray)
 * @param {bool} asText  wether to parse the output as text or QByteArray in the callbacks.
 * @returns {QProcess} the launched process.
 */
CURLProcess.prototype.asyncRead = function (readCallback, finishedCallback, asText){
  this.log.debug("Executing Process with arguments : "+this.app+" "+this.command.join(" "));

  this.process.start(this.app, this.command);
  if (typeof readCallback !== 'undefined' && readCallback){
    var onRead = function(){
      this.log.debug("readyread")
      var stdout = this.read(asText);
      readCallback(stdout);
    }
    this.process.readyRead.connect(this, onRead);
  }

  if (typeof finishedCallback !== 'undefined' && finishedCallback){
    var onFinished = function(returnCode){
      this.log.debug("finished")
      var stdout = this.read(asText);
      finishedCallback(returnCode, stdout);
      if (returnCode) this.log.error("CURL returned with error code "+returnCode)
    }
    this.process["finished(int)"].connect(this, onFinished);
  }

  return this.process
}


/**
 * Reads and returns the stdout of a curl process. If there is any stderr, it will be thrown as an error.
 * Each read call "empties" the stream from the process, so subsequent reads will be empty unless new output was returned.
 * @param {bool} [asText=true] wether to return the output as text or QByteArray
 * @returns the output from the process, as a string or QByteArray
 */
CURLProcess.prototype.read = function (asText){
  if (typeof asText === 'undefined' || asText === 'undefined' || asText === null) var asText = true;
  var readOut = this.process.readAllStandardOutput();
  if (asText){
    var output = new QTextStream(readOut).readAll();
  }else{
    var output = readOut;
  }
  this.log.debug("output:" + output)

  var readErr = this.process.readAllStandardError();
  var errors = new QTextStream(readErr).readAll();
  if (errors) {
    this.log.error("curl errors: " + errors.replace("\r", ""));
    throw new Error(errors)
  }
  return output;
}


/**
 * Launches a download without waiting for the end.
 * @param {str} destinationPath  the path to which the download will be saved
 * @param {function} callback  a function to execute once download has finished. Signature: callback(QProcess.returnCode, QString)
 * @returns {QProcess}  the process launched.
 */
CURLProcess.prototype.asyncDownload = function (destinationPath, callback) {
  var url = this.command.pop()
  url = url.replace(/ /g, "%20");
  destinationPath = destinationPath.replace(/[ :\?\*"\<\>\|][^/\\]/g, "");

  this.command = ["-L", "-o", destinationPath].concat(this.command)
  this.command.push(url)

  var dest = destinationPath.split("/").slice(0, -1).join("/")
  var dir = new QDir(dest);
  if (!dir.exists()) dir.mkpath(dest);

  return this.asyncRead(null, callback)
}


/**
 * Run the process and wait for result while running the UI event loop to update progress
 * @param {int} wait The amount of milliseconds before the process will be considered failed.
 * @param {function} runMethod the CURLProcess method launched (ex: asyncRead, asyncDownload).
 * @param {Array} [args] optionally, pass some arguments to the runMethod.
 * @returns the output as text.
 */
CURLProcess.prototype.runAndWait = function (wait, runMethod, args) {
  if (typeof args === 'undefined') var args = [];

  var loop = new QEventLoop();

  // Use a timer to kill the QProcess after the wait period.
  var timer = new QTimer();
  timer.singleShot = true;
  timer["timeout"].connect(this, function () {
    if (loop.isRunning()) {
      this.process.kill();
      loop.exit();
      throw new Error("Timeout running command "+this.command.join(" "));
    }
  });

  // Start the process and enter an event loop until the QProcess exits.
  this.process["finished(int)"].connect(this, function(){loop.exit()})
  runMethod.apply(this, args);
  timer.start(wait);
  loop.exec();

  var output = this.read();
  return output;
}


/**
 * Performs a CURL get query, and returns the result when ready. Blocks execution of the code but not the event loop.
 * @param {int} [wait=5000]   optional, the timeout for the query.
 * @returns {string}
 */
CURLProcess.prototype.get = function(wait){
  if (typeof wait === 'undefined') var wait = 5000;

  var output = this.runAndWait(wait, this.asyncRead)
  return output;
}


/**
 * Performs a download through curl. The result of the operation will be returned as well.
 * @param {str} destinationPath  The location to which the download will be saved.
 * @param {int} [wait=30000]   optional, the timeout for the query (for downloads, 30s by default)
 * @returns
 */
CURLProcess.prototype.download = function(destinationPath, wait){
  if (typeof wait === 'undefined') var wait = 30000;

  var output = this.runAndWait(wait, this.asyncDownload, [destinationPath])
  return output;
}


// CURL Class --------------------------------------------------------
/**
 * Curl class to launch curl queries
 * @classdesc
 * @constructor
 * @param {string[]} command
 */
function CURL() {
  this.log = new Logger("CURL")
}


/**
 * Queries the GraphQL Github API V4 with a curl process (requires authentication)
 * @param {string}  query     a query object that will be wrapped in an object and converted to JSON.
 * @example
 * // query the files list
 *  var query = "\"query\" : \"{ repository(name: $repoName) { commit(rev: \"HEAD\") { tree(path: \"$folder\", recursive: true) { entries { path isDirectory url } } } } }\""
 *
 * // query a file content
 *  var query = query "{ repository(name: $repoName) { defaultBranch { target { commit { blob(path: "$path") { content } } } } } }"
 *
 * // more : https://docs.sourcegraph.com/api/graphql/examples
 * // more info about authentication : https://developer.github.com/apps/building-github-apps/authenticating-with-github-apps/
 */
CURL.prototype.query = function (query, wait) {
  if (typeof wait === 'undefined') var wait = 5000;
  var bin = this.bin;
  try {
    var p = new QProcess();

    log.debug("starting process :" + bin + " " + command);
    var command = ["-H", "Authorization: Bearer YOUR_JWT", "-H", "Content-Type: application/json", "-X", "POST", "-d"];
    query = query.replace(/\n/gm, "\\\\n").replace(/"/gm, '\\"');
    command.push('" \\\\n' + query + '"');
    command.push("https://api.github.com/graphql");

    p.start(bin, command);

    p.waitForFinished(wait);

    var readOut = p.readAllStandardOutput();
    var output = new QTextStream(readOut).readAll();
    //log ("json: "+output);

    return output;
  } catch (err) {
    log.error("Error with curl command: \n" + command.join(" ") + "\n" + err);
    return null;
  }
}


/**
 * Queries the REST Github API v3 with a curl process
 */
CURL.prototype.get = function (command, wait) {
  if (typeof command == "string") command = [command]
  var curl = new CURLProcess(command);
  return curl.get(wait);
}


CURL.prototype.download = function (url, wait) {
  var curl = new CURLProcess(url);
  return curl.download(wait);
}


CURL.prototype.runCommand = function (command, wait, test) {
  if (typeof test === 'undefined') var test = false; // test will not print the output, just the errors

  var curl = new CURLProcess(command);
  var output = curl.runAndWait(wait)

  if (!test) return output;
}

/**
 * find the curl executable
 */
Object.defineProperty(CURL.prototype, "bin", {
  get: function () {
    if (typeof CURL.__proto__.bin === 'undefined') {
      log.debug("getting curl bin")
      if (about.isWindowsArch()) {
        var curl = [System.getenv("windir") + "/system32/curl.exe",
        System.getenv("ProgramFiles") + "/Git/mingw64/bin/curl.exe",
        specialFolders.bin + "/bin_3rdParty/curl.exe"];
        // var curl = [specialFolders.bin + "/bin_3rdParty/curl.exe"]; // testing Harmony curl bin
      } else {
        var curl = ["/usr/bin/curl",
          "/usr/local/bin/curl",
          specialFolders.bin + "/bin_3rdParty/curl"];
      }

      for (var i in curl) {
        if ((new File(curl[i])).exists) {
          // testing connection
          var bin = curl[i];
          try {
            log.info("testing connexion by connecting to github.com")
            this.get("https://www.github.com/", 500);
            log.info("CURL bin found, using: " + curl[i])
            CURL.__proto__.bin = bin;
            return bin;
          } catch (err) {
            log.error(err);
            var message = "ExtensionStore: Couldn't establish a connexion.\nCheck that " + bin + " has internet access.";
            log.error(message);
          }
        }
      }
      var error = "ExtensionStore: a valid CURL install wasn't found. Install CURL first.";
      log.error(error)
      throw new Error(error)
    } else {
      return CURL.__proto__.bin;
    }
  }
})

exports.WebIcon = WebIcon
exports.NetworkConnexionHandler = NetworkConnexionHandler