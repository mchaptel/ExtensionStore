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
function WebIcon(url, widget) {
  log.debug("new icon : "+url)
  this.url = url;
  this.widget = widget;

  // start the download
  this.download(this.setIcon);
}

WebIcon.prototype.download = function (callback) {
  log.debug("starting download of icon "+this.url)
  var curl = new CURLProcess(this.url)
  curl.launchAndRead(callback, null, false);
}


WebIcon.prototype.setIcon = function (byteArray) {
  log.debug("download finished, setting icon")
  // log.debug(new QTextStream(byteArray).readAll())
  var image = QImage.load(byteArray)
  var pixmap = QPixmap.convertFromImage(image)
  var icon = new QIcon(pixmap);
  this.widget.setIcon(icon);
}


// CURLProcess Class -------------------------------------------------

function CURLProcess (command) {
  this.curl = new CURL()
  this.log = new Logger("CURL")

  if (typeof command == "string") var command = [command];
  if (this.curl.bin.indexOf("bin_3rdParty") != -1) command = ["-k"].concat(command);
  this.command = ["-s", "-S"].concat(command);

  var bin = this.curl.bin.split("/");
	this.app = bin.pop();
	var directory = bin.join("\\");

  this.process = new QProcess();
	this.process.setWorkingDirectory(directory);
}


CURLProcess.prototype.launchAndRead = function (readCallback, finishedCallback, asText){
  this.log.debug("Executing Process with arguments : "+this.app+" "+this.command.join(" "));
  if (typeof asText=== 'undefined') var asText = true;

  this.process.start(this.app, this.command);
  if (typeof readCallback !== 'undefined' && readCallback){
    var onRead = function(){
      var stdout = this.read(asText);
      readCallback(stdout);
    }
    this.process.readyRead.connect(this, onRead);
  }
  if (typeof finishedCallback !== 'undefined' && finishedCallback) this.process["finished(int)"].connect(this, finishedCallback);
}


CURLProcess.prototype.read = function (asText){
  this.log.debug("readyread")
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


// CURL Class --------------------------------------------------------
/**
 * Curl class to launch curl queries
 * @classdesc
 * @constructor
 * @param {string[]} command
 */
function CURL() {
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
  if (typeof wait === 'undefined') var wait = 5000;
  try {
    var bin = this.bin;
    return this.runCommand(bin, command, wait);
  } catch (err) {
    message = "Error with curl command: \n" + command.join(" ") + "\n" + err
    log.error(message);
    throw new Error(message);
  }
}



CURL.prototype.runCommand = function (bin, command, wait, test) {
  if (typeof test === 'undefined') var test = false; // test will not print the output, just the errors

  // The toonboom bundled curl doesn't seem to be equiped for ssh so we have to use unsafe mode
  if (bin.indexOf("bin_3rdParty") != -1) command = ["-k"].concat(command);
  command = ["-s", "-S"].concat(command);

  var loop = new QEventLoop();

  var p = new QProcess();
  p["finished(int,QProcess::ExitStatus)"].connect(this, function () {
    loop.exit();
  });

  // Use a timer to kill the QProcess after the wait period.
  var timer = new QTimer();
  timer.singleShot = true;
  timer["timeout"].connect(this, function () {
    if (loop.isRunning()) {
      p.kill();
      loop.exit();
      throw new Error("Timeout updating extension.");
    }
  });


  // Start the process and enter an event loop until the QProcessx exits.
  log.debug("starting process :" + bin + " " + command.join(" "));
  p.start(bin, command);
  timer.start(wait);
  loop.exec();

  var readOut = p.readAllStandardOutput();
  var output = new QTextStream(readOut).readAll();
  if (!test) log.debug("curl output: " + output);

  var readErr = p.readAllStandardError();
  var errors = new QTextStream(readErr).readAll();
  if (errors) {
    log.error("curl errors: " + errors.replace("\r", ""));
    throw new Error(errors)
  }

  return output;
}

/**
 * find the curl executable
 */
Object.defineProperty(CURL.prototype, "bin", {
  get: function () {
    log.debug("getting curl bin")

    if (typeof CURL.__proto__.bin === 'undefined') {
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
            this.runCommand(bin, ["https://www.github.com/"], 500, true);
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