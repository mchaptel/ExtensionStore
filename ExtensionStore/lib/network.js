var Logger = require("logger.js").Logger

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
    return json;
  }
  catch (error) {
    var message = ("command " + command + " did not return a valid JSON : " + result);
    this.curl.log.error(error + " : " + message);
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


// CURL Class --------------------------------------------------------
/**
 * Curl class to launch curl queries
 * @classdesc
 * @constructor
 * @param {string[]} command
 */
function CURL() {
  this.log = new Logger("CURL");
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

    this.log.debug("starting process :" + bin + " " + command);
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
    this.log.error("Error with curl command: \n"+command.join(" ")+"\n"+err);
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
    message = "Error with curl command: \n"+command.join(" ")+"\n"+err
    this.log.error(message);
    throw new Error (message);
  }
}


CURL.prototype.runCommand = function (bin, command, wait, test){
  if (typeof test === 'undefined') var test = false; // test will not print the output, just the errors

  var loop = new QEventLoop();

  var p = new QProcess();
  p["finished(int,QProcess::ExitStatus)"].connect(this, function () {
    loop.exit();
  });

  // Use a timer to kill the QProcess after the wait period.
  var timer = new QTimer();
  timer.singleShot = true;
  timer["timeout"].connect(this, function() {
    if (loop.isRunning()) {
      p.kill();
      loop.exit();
      throw new Error("Timeout updating extension.");
    }
  });

  // The toonboom bundled curl doesn't seem to be equiped for ssh so we have to use unsafe mode
  if (bin.indexOf("bin_3rdParty") != -1) command = ["-k"].concat(command);
  command = ["-s", "-S"].concat(command);

  // Start the process and enter an event loop until the QProcessx exits.
  this.log.debug("starting process :" + bin + " " + command.join(" "));
  p.start(bin, command);
  timer.start(wait);
  loop.exec();

  var readOut = p.readAllStandardOutput();
  var output = new QTextStream(readOut).readAll();
  if (!test) this.log.debug("curl output: " + output);

  var readErr = p.readAllStandardError();
  var errors = new QTextStream(readErr).readAll();
  if (errors){
    this.log.error("curl errors: " + errors.replace("\r", ""));
    throw new Error(errors)
  }

  return output;
}

/**
 * find the curl executable
 */
Object.defineProperty(CURL.prototype, "bin", {
  get: function () {
    this.log.debug("getting curl bin")

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
          try{
            this.log.info("testing connexion by connecting to github.com")
            this.runCommand(bin, ["https://www.github.com/"], 500, true);
            this.log.info("CURL bin found, using: "+curl[i])
            CURL.__proto__.bin = bin;
            return bin;
          }catch(err){
            this.log.error(err);
            var message = "ExtensionStore: Couldn't establish a connexion.\nCheck that "+bin+" has internet access.";
            this.log.error(message);
          }
        }
      }
      var error = "ExtensionStore: a valid CURL install wasn't found. Install CURL first.";
      this.log.error(error)
      throw new Error(error)
    } else {
      return CURL.__proto__.bin;
    }
  }
})


exports.CURL = CURL
exports.NetworkConnexionHandler = NetworkConnexionHandler