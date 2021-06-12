var Logger = require("./logger.js").Logger;
var DescriptionView = require("./widgets.js").DescriptionView;
var appFolder = require("./io.js").appFolder;

log = new Logger("Register")

/**
 * The custom dialog to register a new extension
 * @param {Store} store
 * @param {LocalList} localList
 */
function RegisterExtensionDialog(store, localList){

  this.ui = UiLoader.load(appFolder + "/resources/register.ui");

  this.store = store;
  this.localList = localList;
  this.seller;

  // Setup register panel --------------------------------------------
  this.registerPanel = this.ui.registerForm;
  this.registerDescription = this.registerPanel.descriptionSplitter.widget(0);

  this.extensionList = this.registerPanel.extensionPicker;
  this.authorBox = this.ui.authorBox;
  this.packageBox = this.ui.packageBox;

  this.authorBox.enabled = false;
  this.registerPanel.enabled = false;

  // create the webview programmatically
  this.descriptionPreview = new DescriptionView();

  htmlPreview = this.registerPanel.descriptionSplitter.widget(1);
  htmlPreview.setLayout(new QVBoxLayout());
  htmlPreview.layout().setContentsMargins(0, 0, 0, 0);
  htmlPreview.layout().addWidget(this.descriptionPreview, 0, Qt.AlignTop);

  this.registerPanel.descriptionSplitter.setSizes([this.registerPanel.descriptionSplitter.width, 0]);

  // fill url textfield if previously saved to local preferences
  var repoUrl = this.localList.getData("recentGithubUrl", "");
  log.debug(repoUrl);
  if (repoUrl) this.packageBox.packageUrl.setText(repoUrl);

  // Set up signal connexions ----------------------------------------
  this.registerDescription.textChanged.connect(this, this.updateHtmlPreview);
  this.packageBox.loadPackageButton.clicked.connect(this, this.loadPackage);
  this.packageBox.loadPackageFromFileButton.clicked.connect(this, this.loadPackageFromFile);
  this.packageBox.newPackageButton.clicked.connect(this, this.createNewPackage);

  this.extensionList["currentIndexChanged(int)"].connect(this, this.updatePackageInfo);

  this.registerPanel.versionField.editingFinished.connect(this, this.savePackageInfo);
  this.registerPanel.licenseType.editingFinished.connect(this, this.savePackageInfo);
  this.registerPanel.compatibilityComboBox["currentIndexChanged(int)"].connect(this, this.savePackageInfo);
  this.registerDescription.focusOutEvent = this.savePackageInfo;
  this.registerPanel.isPackageCheckBox.stateChanged.connect(this, this.savePackageInfo);
  this.registerPanel.keywordsPanel.keywordsField.editingFinished.connect(this, this.savePackageInfo);
  this.registerPanel.repoField.editingFinished.connect(this, this.savePackageInfo);

  this.registerPanel.addExtensionButton.clicked.connect(this, this.addExtension);
  this.registerPanel.removeExtensionButton.clicked.connect(this, this.removeExtension);
  this.registerPanel.renameExtensionButton.clicked.connect(this, this.renameExtension);

  this.ui.generateButton.clicked.connect(this, this.generatePackage);

  this.registerPanel.filesPicker.clicked.connect(this, this.selectFiles);

  // block signals when updating is true
  this.updating = false;
}


RegisterExtensionDialog.prototype.show = function(){
  this.ui.show()
}


RegisterExtensionDialog.prototype.htmlFromDescription = function (descriptionString) {
  // converts the line breaks and double line breaks to html so they appear properly
  log.debug("converting string to html")
  var htmlString = "<p>"+descriptionString+"</p>";
  htmlString = htmlString.replace(/\n\n/g, "</p><p>")
                          .replace(/\n/g, "<br>");
  return htmlString;
}

RegisterExtensionDialog.prototype.descriptionStringFromHtml = function (html) {
  log.debug("converting html to string")
  var descriptionString = html.replace(/\\n/g, "")
                              .replace(/\<\/p\>\<p\>/g, "\n\n")
                              .replace(/\<br\>/g, "\n")
                              .replace(/^\<p\>/g, "")
                              .replace(/\<\/p\>$/g, "");

  log.debug(descriptionString);
  return descriptionString;
}

RegisterExtensionDialog.prototype.updateHtmlPreview = function() {
  var descriptionInputText = this.registerDescription.document().toPlainText()
  var html = this.htmlFromDescription(descriptionInputText)
  this.descriptionPreview.setHtml(html);
}


RegisterExtensionDialog.prototype.getRepoUrl = function() {
  log.debug("loading package");
  var packageUrl = this.packageBox.packageUrl.text;
  if (packageUrl.slice(-1) != "/") {
    this.packageBox.packageUrl.text += "/";
    this.packageUrl = this.packageBox.packageUrl.text;
  }
  var sellerRe = /https:\/\/github.com\/[^\/]*\/[^\/]*\//i;
  var sellerUrl = sellerRe.exec(packageUrl);
  if (!sellerUrl) {
    MessageBox.information("Enter a valid github repository address.");
    return null;
  }

  // seller created then stored in the above scope
  var repoUrl = sellerUrl[0];
  this.localList.saveData("recentGithubUrl", repoUrl);
  return repoUrl;
}

/**
 * Loading a tbpackage from a github repo url
 */
RegisterExtensionDialog.prototype.loadPackage = function() {
  var url = this.getRepoUrl();
  if (!url) return;

  seller = new storelib.Seller(url);
  this.loadSeller(seller);
}


/**
 * loading a tbpackage from a local json file
 */
RegisterExtensionDialog.prototype.loadPackageFromFile = function () {
  var url = this.getRepoUrl();
  if (!url) return;

  seller = new storelib.Seller(url);
  var packageFile = QFileDialog.getOpenFileName(0, "Open Package File", System.getenv("userprofile"), "tbpackage.json")
  if (!packageFile) return;
  seller.loadFromFile(packageFile);
  this.loadSeller(seller);
}


/**
 * Create a new tbpackage file from scratch
 */
RegisterExtensionDialog.prototype.createNewPackage = function () {
  var url = this.getRepoUrl();
  if (!url) return

  seller = new storelib.Seller(url);
  seller.package = {};
  seller.addExtension("my first extension");
  this.loadSeller(seller);
}


/**
* load the info from the seller into the form
* @param {Seller} seller
*/
RegisterExtensionDialog.prototype.loadSeller = function (seller) {
  if (!seller.package) {
    MessageBox.information("No tbpackage.json found in repository.")
    return;
  }

  this.seller = seller;
  this.resetPanel();

  // update seller info
  this.authorBox.authorField.setText(seller.name);
  this.authorBox.websiteField.setText(seller.package.website);
  this.authorBox.socialField.setText(seller.package.social);

  this.authorBox.enabled = true;
  this.registerPanel.enabled = true;

  var extensions = seller.extensions;
  log.debug("found extensions", Object.keys(extensions));

  // add extensions to the drop down
  for (var i in extensions) {
    log.debug("adding extension " + extensions[i].name)
    this.extensionList.addItem(extensions[i].name, extensions[i].id);
  }
  this.updatePackageInfo(0);
}


/**
 * Clears all values from the register panel
 */
RegisterExtensionDialog.prototype.resetPanel = function() {
  this.updating = true
  this.authorBox.authorField.setText("");
  this.authorBox.websiteField.setText("");
  this.authorBox.socialField.setText("");

  // in case of reloading, first delete all existing items in drop down
  while (this.extensionList.count) {
    this.extensionList.removeItem(0);
  }

  this.registerPanel.versionField.setText("");
  this.registerPanel.compatibilityComboBox.setCurrentIndex(0);
  this.registerDescription.setPlainText("");
  this.registerPanel.isPackageCheckBox.checked = false;
  this.registerPanel.keywordsPanel.keywordsField.setText("");
  this.registerPanel.repoField.setText("");
  this.registerPanel.filesField.setText("");
  this.registerPanel.licenseType.setText("");

  this.updating = false;
}

/**
* @Slot
* Update the information on the form based on the currently selected item in the QComboBox
* @param {int} index    the index of the selected item in the QComboBox to use to update
*/
RegisterExtensionDialog.prototype.updatePackageInfo = function(index) {
 if (this.updating) return;
 this.updating = true;  // tell other functions you're updating

 if (this.extensionList.count == 0) return
 var extensionId = this.extensionList.itemData(index, Qt.UserRole);
 var extension = this.seller.extensions[extensionId];

 log.debug("displaying extension:", extensionId);
 log.debug(JSON.stringify(extension.package, null, " "));

 this.authorBox.authorField.setText(seller.name);
 this.registerPanel.authorName.setText(extension.package.author);
 this.registerPanel.versionField.setText(extension.package.version);

 var compatIndex = this.registerPanel.compatibilityComboBox.findText(extension.package.compatibility);
 this.registerPanel.compatibilityComboBox.setCurrentIndex(compatIndex);
 this.registerDescription.setPlainText(this.descriptionStringFromHtml(extension.package.description));
 this.registerPanel.isPackageCheckBox.checked = extension.package.isPackage;
 this.registerPanel.keywordsPanel.keywordsField.setText(extension.package.keywords.join(", "));
 this.registerPanel.repoField.setText(extension.package.repository);
 this.registerPanel.filesField.setText(extension.package.files.join(", "));
 this.registerPanel.licenseType.setText(extension.package.license)

 this.updating = false;
}

/**
* gather all the info from the form and save into the extension package
*/
RegisterExtensionDialog.prototype.savePackageInfo = function() {
 if (this.updating) return;  // don't respond to signals while updating
 var extensionId = this.extensionList.itemData(this.extensionList.currentIndex, Qt.UserRole);
 var extension = this.seller.extensions[extensionId];

 var extensionPackage = {};

 extensionPackage.name = this.extensionList.currentText;
 extensionPackage.author = this.registerPanel.authorName.text;
 extensionPackage.version = this.registerPanel.versionField.text;
 extensionPackage.compatibility = this.registerPanel.compatibilityComboBox.currentText;
 extensionPackage.isPackage = this.registerPanel.isPackageCheckBox.checked;
 extensionPackage.keywords = this.registerPanel.keywordsPanel.keywordsField.text.replace(/ /g, "").split(",");
 extensionPackage.repository = this.registerPanel.repoField.text;
 extensionPackage.license = this.registerPanel.licenseType.text;
 extensionPackage.files = this.registerPanel.filesField.text.replace(/(, | ,)/g, ",").split(",");
 extensionPackage.description = this.htmlFromDescription(this.registerDescription.document().toPlainText());
 extensionPackage.website = this.authorBox.websiteField.text;

 log.debug("saving package:");
 log.debug(JSON.stringify(extensionPackage, null, " "));
 extension.package = extensionPackage;
}

/**
* @Slot
* adds a new extension to the seller
*/
RegisterExtensionDialog.prototype.addExtension = function () {
 this.savePackageInfo()
 var newName = Input.getText("Enter new extension name:", "", "Prompt");
 if (!newName) return;
 var extension = this.seller.addExtension(newName);
 this.extensionList.addItem(newName, extension.id);
 this.extensionList.setCurrentIndex(this.extensionList.findText(newName));
}

/**
* @Slot
* removes the extension described by the currently active item of the ComboBox
*/
RegisterExtensionDialog.prototype.removeExtension = function () {
 var extensionId = this.extensionList.itemData(list.currentIndex, Qt.UserRole);
 var name = this.seller.extensions[extensionId].name;
 this.seller.removeExtension[extensionId];
 this.extensionList.removeItem(this.extensionList.findText(name));
}


/**
* @Slot
* Rename the extension when activating the comboBox with a field that isn't part of the existing values
*/
RegisterExtensionDialog.prototype.renameExtension = function () {
 this.savePackageInfo()
 if (this.extensionList.count == 0) return
 var newName = Input.getText("Rename extension:", this.extensionList.currentText, "Prompt");
 if (!newName) return;
 log.debug("renaming to " + newName)

 var extensionId = this.extensionList.itemData(this.extensionList.currentIndex, Qt.UserRole);
 var extension = this.seller.extensions[extensionId];

 this.seller.renameExtension(extensionId, newName);
 this.extensionList.setItemText(this.extensionList.currentIndex, newName);
 this.extensionList.setItemData(this.extensionList.currentIndex, extension.id, Qt.UserRole);
}


RegisterExtensionDialog.prototype.generatePackage = function () {
  this.savePackageInfo()

  var saveFolder = this.localList.getData("packageLastSaved", System.getenv("userprofile")); // start from folder chosen last time
  var saveDestination = QFileDialog.getSaveFileName(0, "Save Package", saveFolder, "tbpackage.json");
  this.seller.package.name = this.authorBox.authorField.text;
  this.seller.package.website = this.authorBox.websiteField.text;
  this.seller.package.social = this.authorBox.socialField.text;
  if (!saveDestination) return;

  var saveFolder = saveDestination.slice(0, saveDestination.lastIndexOf("/"))
  this.localList.saveData("packageLastSaved", saveFolder) // save chosen folder for next time
  this.seller.exportPackage(saveDestination);

  var url = this.packageBox.packageUrl.text;

  var message = '<html><head /><body>'
  message += '<p>Export succesful.</p><p>Upload the file: '
  message += '<a href="' + saveFolder + '"><span style=" text-decoration: underline; color:#55aaff;">' + saveDestination + '</span></a>'
  message += ' to the root of the repository: '
  message += '<a href="' + url + '"><span style=" text-decoration: underline; color:#55aaff;">' + url + '</span></a>'
  message += ' to register your extensions.</p>'
  message += '<p>Make sure your repository is present in the list at this address:<br>'
  message += '<a href="https://github.com/mchaptel/TBScripts/blob/master/ExtensionStore/packages/ExtensionStore/SELLERSLIST"><span style=" text-decoration: underline; color:#55aaff;">https://github.com/mchaptel/TBScripts/blob/master/ExtensionStore/packages/ExtensionStore/SELLERSLIST</span></a></p>'
  message += "</body></html>"

  MessageBox.information(message)
}


RegisterExtensionDialog.prototype.selectFiles = function (){
  var repoUrl = this.registerPanel.repoField.text;
  var includedFiles = this.registerPanel.filesField.text.split(",");
  var filesPicker = new FilesPicker(repoUrl, includedFiles)
  var includedFiles = filesPicker.exec();

  if (includedFiles){
    this.registerPanel.filesField.text = includedFiles.join(",");
    this.savePackageInfo();
  }
}

/**
 * A Dialog to select files from a github repository.
 * @class
 *
 */
function FilesPicker(url, includedFiles){
  // get a Repository object to fetch the content
  this.repository = new storelib.Repository(url);
  this.files = this.repository.contents;
  this.includedFiles = includedFiles;

  if (!this.files) {
    MessageBox.information("Repository url is not valid.");
    return;
  }
  log.debug(JSON.stringify(this.files, null, " "));

  // stylesheets for files items
  this.folderIcon = specialFolders.resource + "/icons/old/oldfolder.png";
  this.selectedFileBackground = new QBrush(new QColor(Qt.darkCyan), Qt.SolidPattern);
  this.unselectedFileBackground = new QBrush(new QColor(Qt.transparent), Qt.SolidPattern);
  this.includedFileBackground = new QBrush(new QColor(Qt.darkRed), Qt.SolidPattern);

  // load and setup the dialog
  this.ui = UiLoader.load(appFolder + "/resources/pickFiles.ui");
  this.filesPanel = this.ui.filesSplitter.widget(0);
  this.fileList = this.filesPanel.repoContents;
  this.filterField = this.filesPanel.filterField;
  this.addFilesButton = this.filesPanel.addFilesButton;
  this.includedPanel = this.ui.filesSplitter.widget(1);
  this.includedFilesList = this.includedPanel.includedFiles;
  this.removeFilesButton = this.includedPanel.removeFiles;

  this.ui.repoName.text = url;

  // Setting the appearance of the splitter
  this.ui.filesSplitter.setSizes([this.ui.filesSplitter.height * 0.8, this.ui.filesSplitter.height * 0.2]);

  this.displayFiles();

  // Setting up widgets signals
  this.filterField.textChanged.connect(this, this.highlightFiles);
  this.fileList.itemSelectionChanged.connect(this, this.highlightFiles);
  this.addFilesButton.clicked.connect(this, this.addFiles);
  this.removeFilesButton.clicked.connect(this, this.removeFiles);
  this.ui.confirmButton.clicked.connect(this, this.confirmDialog)
  this.ui.cancelButton.clicked.connect(this, this.cancelDialog)
}


FilesPicker.prototype.show = function(){
  this.ui.show()
}


FilesPicker.prototype.exec = function (){
  this.accepted = false;
  this.cancelled = false;

  this.show();

  // since we can't make a widget created with UiLoader modal, we fake it here with a while loop
  while(true){
    if (this.accepted){
      log.debug("accepted")
      return this.includedFiles;
    }
    if (this.cancelled){
      return null
    }
  }
}


FilesPicker.prototype.displayFiles = function(){
  // add a repo "root" item
  var root = new QTreeWidgetItem(this.fileList, ["/"], 2048);
  root.setData(0, Qt.UserRole, "/");
  root.setIcon(0, new QIcon(this.folderIcon));
  root.setExpanded(true);

  // add items from repo to files list
  this.items = { "/": root };

  for (var i in this.files) {
    // get the file/folder name and the parent folder
    var filePath = this.files[i].path;
    var isFolder = (filePath.slice(-1) == "/");
    if (isFolder) filePath = filePath.slice(0, -1); // remove the last slash for the split

    log.debug(filePath)

    var path = filePath.split("/");
    log.debug(path)
    var fileName = path.pop() + (isFolder ? "/" : "")// add a slash at the end of folders
    var folder = path.join("/") + "/";

    filePath = folder + fileName;
    var parent = this.items[folder];

    log.debug(folder)
    log.debug(fileName)

    var item = new QTreeWidgetItem(parent, [fileName], 2048);
    if (isFolder) item.setIcon(0, new QIcon(this.folderIcon));
    item.setData(0, Qt.UserRole, filePath);
    item.setExpanded(true);
    this.items[filePath] = item;
  }

  // add the list of files included in the extension in the bottom list
  for (var i in this.includedFiles) {
    if (this.includedFiles[i] == "") continue;
    var fileItem = new QTreeWidgetItem(this.includedFilesList, [this.includedFiles[i]], 2048);
    // colorise the included files
    this.colorizeFiles(searchToRe("/" + this.includedFiles[i]), this.includedFileBackground);
  }

}

/**
* colorise items based on regex
* @param {RegExp} search   items that pass the filter will be colored
* @param {QBrush} color    a QBrush object that defines a background brush for QTreeWidgetItem
*/
FilesPicker.prototype.colorizeFiles = function (search, color) {
  for (var i in this.items) {
    if (!(this.items[i] instanceof QTreeWidgetItem)) continue;
    if (i.match(search)) this.items[i].setBackground(0, color);
  }
}


/**
* highlight files with colors for included files and files that pass the filter when editing
*/
FilesPicker.prototype.highlightFiles = function () {
 // remove all colors
 this.colorizeFiles(/.*/, this.unselectedFileBackground);

 // colorised files included by searches in includedFilesList
 for (var i = 0; i < this.includedFilesList.topLevelItemCount; i++) {
   var includedFiles = "/" + this.includedFilesList.topLevelItem(i).text(0);
   this.colorizeFiles(searchToRe(includedFiles), this.includedFileBackground);
 }

 // colorise files currently searched for
 var search = this.filterField.text;
 if (search == "") search = "*";

 var selection = this.fileList.selectedItems();
 for (var i in selection) {
   var baseFolder = selection[i].data(0, Qt.UserRole);
   this.colorizeFiles(searchToRe(baseFolder + search), this.selectedFileBackground);
 }
}

/**
 * add result from file search to list
 */
FilesPicker.prototype.addFiles = function () {
  var selection = this.fileList.selectedItems();
  for (var i in selection) {
    var fileSearch = selection[i].data(0, Qt.UserRole) + this.filterField.text;
    var fileItem = new QTreeWidgetItem(this.includedFilesList, [fileSearch.slice(1)], 2048);  // we remove the first "/" before saving
  }

  for (var i = selection.length - 1; i >= 0; i--) {
    selection[i].setSelected(false);
  }

  this.filterField.text = "";
}


FilesPicker.prototype.removeFiles = function(){
  var selection = this.includedFilesList.selectedItems();
  for (var i = selection.length - 1; i >= 0; i--) {
    var selectedItem = this.includedFilesList.indexOfTopLevelItem(selection[i]);
    this.includedFilesList.takeTopLevelItem(selectedItem);
  }
  this.highlightFiles();
}


FilesPicker.prototype.confirmDialog = function (){
  this.includedFiles = [];
  for (var i = 0; i < this.includedFilesList.topLevelItemCount; i++) {
    this.includedFiles.push(this.includedFilesList.topLevelItem(i).text(0));
  }
  this.accepted = true;
  this.ui.close();
}


FilesPicker.prototype.cancelDialog = function (){
  this.cancelled = true;
  this.ui.close();
}


/**
 * converts a file search string with wildcard and extensions to a regex search
 * @param {string} search  the string to convert to a valid regex
 */
function searchToRe(search) {
  if (search.slice(-1) == "/") search += "*";

  // sanitize input to prevent broken regex
  search = search.replace(/\./g, "\\.")
    // .replace(/\*/g, "[^/]*")   // this is to avoid selecting subfolders contents but do we want that?
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");

  var searchRe = new RegExp("^" + search + "$", "i");

  return searchRe;
}

exports.RegisterExtensionDialog = RegisterExtensionDialog