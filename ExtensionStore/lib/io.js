
// reads a local file and return the contents
function readFile(filename) {
  var file = new File(filename);

  try {
    if (file.exists) {
      file.open(FileAccess.ReadOnly);
      var string = file.read();
      file.close();
      return string;
    }
  } catch (err) { }
  return null;
}


// writes the contents to the specified filename.
function writeFile(filename, content, append) {
  var log = new Logger("helpers");
  if (typeof append === 'undefined') var append = false;

  log.debug("writing file " + filename);

  var file = new File(filename);
  try {
    if (append) {
      file.open(FileAccess.Append);
    } else {
      file.open(FileAccess.WriteOnly);
    }
    file.write(content);
    file.close();
    return true;
  } catch (err) { return false; }
}


// gets the list of files in the folder that match the filter
function listFiles(folder, filter) {
  if (typeof filter === 'undefined') var filter = "*"

  var dir = new QDir;
  dir.setPath(folder);
  dir.setNameFilters([filter]);
  dir.setFilter(QDir.Files);
  var files = dir.entryList();

  return files;
}


// recursive copy of folders content
function recursiveFileCopy(folder, destination) {
  var log = new Logger("helpers")
  log.debug("copying files from folder " + folder + " to destination " + destination);
  try {
    var p = new QProcess();

    if (about.isWindowsArch()) {
      var bin = "robocopy";
      var command = ["/E", "/TEE", "/MOV", folder, destination];
    } else {
      var bin = "cp";
      var command = ["-Rv", folder + "/.", destination];
    }

    log.debug("starting process :"+bin+" "+command);
    p.start(bin, command);

    p.waitForFinished(-1);

    var readOut = p.readAllStandardOutput();
    var output = new QTextStream(readOut).readAll();
    log.debug("copy results: " + output);

    return output;
  } catch (err) {
    log.error(err);
    return null;
  }
}


// returns the folder of this file
var appFolder = __file__.split("/").slice(0, -2).join("/");
if (appFolder.indexOf("repo") == -1) Logger.level = 1;   // disable logging if extension isn't in a repository


exports.listFiles = listFiles
exports.writeFile = writeFile
exports.readFile = readFile
exports.recursiveFileCopy = recursiveFileCopy
exports.appFolder = appFolder