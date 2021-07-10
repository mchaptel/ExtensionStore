var Logger = require("logger.js").Logger
var log = new Logger("CURL")
var readFile = require("io.js").readFile

// NetworkConnexionHandler Class --------------------------------------
/**
 * @constructor
 * @classdesc
 * The NetworkConnexionHandler class handles web queries and downloads. It uses curl for communicating with the remote apis. <br>
 * This class extends QObject so it can broadcast signals and be threaded.
 * @extends QObject
 */
function NetworkConnexionHandler() {
}


/**
 * Makes a network request and get the result as a parsed JSON.
 */
NetworkConnexionHandler.prototype.get = function (command) {
  // handle errors
  var curl = new CURLProcess(command)
  var result = curl.get();
  try {
    json = JSON.parse(result);
    if (json.hasOwnProperty("message")) {
      if (json.message == "Not Found") {
        log.error("File not present in repository : " + command);
        return null;
      }
      if (json.message == "Moved Permanently") {
        log.debug("Repository " + command + " has moved to : " + json.url);
        return json;
      }
      if (json.message == "400: Invalid request") {
        log.error("Couldn't reach repository : " + command + ". Make sure it is a valid github address.")
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
  var curl = new CURLProcess(url)
  var result = curl.download(destinationPath, 30000); // 30s timeout
  return result;
}



// WebIcon Class -----------------------------------------------------
function WebIcon(url) {
  this.log = new Logger("Icon");
  this.url = url;
  this.readFile = readFile;
}

/**
 * class member: the location of the cache folder
 */
WebIcon.cacheFolder = specialFolders.temp + "/HUES_iconscache/";

/**
 * class memeber : a caching mechanism to avoid using curl
 * when looking for the same website across several icons
 */
WebIcon.iconsCache = {}

/**
 * the path for the download
 */
Object.defineProperty(WebIcon.prototype, "dlPath", {
  get: function () {
    if (typeof this._dlPath === 'undefined') {
      // first look in the cache for this url
      if (WebIcon.iconsCache[this.url]){
        this._dlPath = WebIcon.iconsCache[this.url];
        return this._dlPath;
      }

      // get the name from the domain of the url...
      var url = this.url.split("/");
      var fileName = url.shift();
      while (!fileName || fileName.indexOf("http")!=-1) fileName = url.shift();

      //... except for images coming from github (avatars/icons)
      var githubIconsRe = /https:\/\/.*github.*\.com\/.*?([^\/]+\.png)$/
      var matches = githubIconsRe.exec(this.url);

      if (matches){
        // we have a github avatar/icon url
        fileName = matches[1];
      } else if (this.url.indexOf(".png") == -1) {
        // dealing with a website, we'll get the favicon
        this.url = "https://www.google.com/s2/favicons?sz=32&domain_url=" + this.url;
        fileName = fileName + ".png";
      }

      this._dlPath = WebIcon.cacheFolder + fileName;
      WebIcon.iconsCache[this.url] = this._dlPath
    }
    return this._dlPath;
  },
  set: function(newPath){
    this._dlPath = newPath;
  }
})


/**
 * Downloads the icon file or returns it from cache then runs the callback
 * @private
 * @param {function} callback  an action to execute once download is finished
 */
WebIcon.prototype.download = function (callback) {
  //only download if file doesn't exist, otherwise run callback directly
  var iconFile = new QFile(this.dlPath);
  var alternatePath = this.dlPath.replace(".png", ".jpeg")
  var alternateIcon = new QFile(alternatePath)
  var fileName = this.dlPath.split("/").pop()

  if (iconFile.exists()) {
    callback.apply(this, []);
  } else if (alternateIcon.exists()){
    // github avatar can be pngs or jpegs
    this.dlPath = alternatePath;
    callback.apply(this, []);
  } else {
    // no cached version, we fetch it
    // we need to save the header from the download to retrieve file type
    var headerPath = WebIcon.cacheFolder + fileName + "header.txt"
    var curl = new CURLProcess(["-D", headerPath, this.url]);
    var p = curl.asyncDownload(this.dlPath);

    // When donwload process completes, find the file type from the downloaded header
    // and rename the file before calling the callback.
    var renameFileExtension = function(){
      var header = this.readFile(headerPath);

      // detect the file format by looking for image/* value in header
      var extensionRe = /image\/(\w+)/
      var match = extensionRe.exec(header);
      if (match && match[1] != "png"){
        // by default, files will be named png, we rename otherwise.
        iconFile.rename(alternateIcon.fileName());
        this.dlPath = alternatePath;
      }

      // delete the saved header file.
      var headerFile = new QFile(headerPath);
      headerFile.remove()

      callback.apply(this, []);
    }
    p["finished(int)"].connect(this, renameFileExtension);
  }
}


/**
 * Call to set the icon to a specific widget.
 * @param {QWidget} widget  a widget that supports icons
 */
WebIcon.prototype.setToWidget = function (widget) {
  this.widget = widget;
  this.download(this.setIcon);
}

/**
 * Sets the icon on the widget once the file is available.
 * @private
 */
WebIcon.prototype.setIcon = function () {
  var icon = new QIcon();
  var iconPixmap = new QPixmap(this.dlPath);
  icon.addPixmap(iconPixmap, QIcon.Normal);
  icon.addPixmap(iconPixmap, QIcon.Selected);
  var size = UiLoader.dpiScale(32)
  icon.size = new QSize(size, size);

  // handle difference between QWidgets and QTreeWidgetItems
  if (this.widget instanceof QWidget) {
    this.widget.icon = icon;
  } else if (this.widget instanceof QTreeWidgetItem) {
    this.widget.setIcon(0, icon);
  }
}


WebIcon.deleteCache = function () {
  WebIcon.iconsCache = {};
  var cache = new Dir(WebIcon.cacheFolder);
  if (cache.exists) {
    cache.rmdirs();
  }
}

// CURLProcess Class -------------------------------------------------

/**
 * This class wraps a CURL Qprocess and handles the outputs.
 * Can perform asynchronous or inline operations without blocking the UI.
 * @param {Array} command
 * @param {string} [bin]   optional, set the bin for this process
 */
function CURLProcess(command, bin) {
  this.log = new Logger("CURL")

  if (typeof bin === 'undefined') {
    var curl = new CURL()
    var bin = curl.bin;
  }

  // The toonboom bundled curl doesn't seem to be equiped for ssh so we have to use unsafe mode
  if (typeof command == "string") var command = [command];
  if (bin.indexOf("bin_3rdParty") != -1) command = ["-k"].concat(command);
  this.command = ["-s", "-S"].concat(command);

  var binPath = bin.split("/");
  this.app = binPath.pop();
  var directory = binPath.join("\\");

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
CURLProcess.prototype.asyncRead = function (readCallback, finishedCallback, asText) {
  this.log.debug("Executing Process with arguments : " + this.app + " " + this.command.join(" "));

  this.process.start(this.app, this.command);
  if (typeof readCallback !== 'undefined' && readCallback) {
    var onRead = function () {
      this.log.debug("readyread")
      var stdout = this.read(asText);
      readCallback(stdout);
    }
    this.process.readyRead.connect(this, onRead);
  }

  if (typeof finishedCallback !== 'undefined' && finishedCallback) {
    var onFinished = function (returnCode) {
      this.log.debug("finished")
      var stdout = this.read(asText);
      finishedCallback(returnCode, stdout);
      if (returnCode) this.log.error("CURL returned with error code " + returnCode);
    }
    this.process["finished(int)"].connect(this, onFinished);
  }

  return this.process;
}


/**
 * Reads and returns the stdout of a curl process. If there is any stderr, it will be thrown as an error.
 * Each read call "empties" the stream from the process, so subsequent reads will be empty unless new output was returned.
 * @param {bool} [asText=true] wether to return the output as text or QByteArray
 * @returns the output from the process, as a string or QByteArray
 */
CURLProcess.prototype.read = function (asText) {
  if (typeof asText === 'undefined' || asText === 'undefined' || asText === null) var asText = true;
  var readOut = this.process.readAllStandardOutput();
  if (asText) {
    var output = new QTextStream(readOut).readAll();
  } else {
    var output = readOut;
  }
  this.log.debug("output:" + output);

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
  var url = this.command.pop();
  url = url.replace(/ /g, "%20");
  destinationPath = destinationPath.replace(/[ :\?\*"\<\>\|][^/\\]/g, "");

  this.log.debug("starting async download of url "+url)

  this.command = ["-L", "-o", destinationPath].concat(this.command);
  this.command.push(url);

  var dest = destinationPath.split("/").slice(0, -1).join("/");
  var dir = new QDir(dest);
  if (!dir.exists()) dir.mkpath(dest);

  return this.asyncRead(null, callback);
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
      throw new Error("Timeout running command " + this.command.join(" "));
    }
  });

  // Start the process and enter an event loop until the QProcess exits.
  this.process["finished(int)"].connect(this, function () { loop.exit() })
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
CURLProcess.prototype.get = function (wait) {
  if (typeof wait === 'undefined') var wait = 5000;

  var output = this.runAndWait(wait, this.asyncRead)
  return output;
}


CURLProcess.prototype.download = function (destinationPath, wait) {
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
// CURL.prototype.query = function (query, wait) {
//   if (typeof wait === 'undefined') var wait = 5000;
//   var bin = this.bin;
//   try {
//     var p = new QProcess();

//     log.debug("starting process :" + bin + " " + command);
//     var command = ["-H", "Authorization: Bearer YOUR_JWT", "-H", "Content-Type: application/json", "-X", "POST", "-d"];
//     query = query.replace(/\n/gm, "\\\\n").replace(/"/gm, '\\"');
//     command.push('" \\\\n' + query + '"');
//     command.push("https://api.github.com/graphql");

//     p.start(bin, command);

//     p.waitForFinished(wait);

//     var readOut = p.readAllStandardOutput();
//     var output = new QTextStream(readOut).readAll();
//     //log ("json: "+output);

//     return output;
//   } catch (err) {
//     log.error("Error with curl command: \n" + command.join(" ") + "\n" + err);
//     return null;
//   }
// }


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
            var p = new CURLProcess("https://github.com/", bin)
            var response = p.get(500);
            if (!response) throw new Error ("https://github.com/ unreachable.")
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