var Logger = require("./logger.js").Logger;
var DescriptionView = require("./widgets.js").DescriptionView;
var appFolder = require("./io.js").appFolder;
var style = require("./style.js")
var StyledImage = style.StyledImage

var log = new Logger ("Register")

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

  this.extensionList = this.registerPanel.extensionPicker;
  this.authorBox = this.ui.authorBox;
  this.packageBox = this.ui.packageBox;

  this.authorBox.enabled = false;
  this.registerPanel.enabled = false;

  // ui elements
  this.mainRepo = this.packageBox.packageUrl;
  this.authorNameBox = this.authorBox.authorField;
  this.websiteBox = this.authorBox.websiteField;
  this.socialBox = this.authorBox.socialField;
  this.extensionList = this.registerPanel.extensionPicker;
  this.licenseBox = this.registerPanel.licenseType;
  this.compatibilityBox = this.registerPanel.compatibilityComboBox;
  this.versionBox = this.registerPanel.versionField;
  this.descriptionSplitter = this.registerPanel.descriptionSplitter;
  this.descriptionField = this.descriptionSplitter.widget(0);
  this.htmlPreview = this.descriptionSplitter.widget(1);
  this.keywordsBox = this.registerPanel.keywordsPanel.keywordsField
  this.extensionAuthorBox = this.registerPanel.authorName;
  this.repoField = this.registerPanel.repoField;
  this.iconField = this.registerPanel.iconField;
  this.iconPicker = this.registerPanel.iconPicker;
  this.filesField = this.registerPanel.filesField;
  this.filesPicker = this.registerPanel.filesPicker;
  this.generateButton = this.reviewPage.generateButton;

  // create the webview programmatically
  this.descriptionPreview = new DescriptionView();

  this.htmlPreview.setLayout(new QVBoxLayout());
  this.htmlPreview.layout().setContentsMargins(0, 0, 0, 0);
  this.htmlPreview.layout().addWidget(this.descriptionPreview, 0, Qt.AlignTop);

  this.descriptionSplitter.setSizes([this.descriptionSplitter.width, 0]);

  // fill url textfield if previously saved to local preferences
  var repoUrl = this.localList.getData("recentGithubUrl", "");
  log.debug(repoUrl);
  if (repoUrl) this.mainRepo.setText(repoUrl);

  // Set up signal connexions ----------------------------------------
  this.descriptionField.textChanged.connect(this, this.updateHtmlPreview);
  this.packageBox.loadPackageButton.clicked.connect(this, this.loadPackage);
  this.packageBox.loadPackageFromFileButton.clicked.connect(this, this.loadPackageFromFile);
  this.packageBox.newPackageButton.clicked.connect(this, this.createNewPackage);

  this.extensionList["currentIndexChanged(int)"].connect(this, this.updatePackageInfo);

  this.versionBox.editingFinished.connect(this, this.savePackageInfo);
  this.licenseBox.editingFinished.connect(this, this.savePackageInfo);
  this.compatibilityBox["currentIndexChanged(int)"].connect(this, this.savePackageInfo);
  this.descriptionField.focusOutEvent = this.savePackageInfo;
  this.keywordsBox.editingFinished.connect(this, this.savePackageInfo);
  this.repoField.editingFinished.connect(this, this.savePackageInfo);

  this.generateButton.clicked.connect(this, this.generatePackage);

  this.filesPicker.clicked.connect(this, this.selectFiles);
  this.iconPicker.clicked.connect(this, this.selectIcon);

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
  var descriptionInputText = this.descriptionField.document().toPlainText()
  var html = this.htmlFromDescription(descriptionInputText)
  this.descriptionPreview.setHtml(html);
}


RegisterExtensionDialog.prototype.getRepoUrl = function() {
  log.debug("loading package");
  var packageUrl = this.mainRepo.text;
  if (packageUrl.slice(-1) != "/") {
    this.packageBox.packageUrl.text += "/";
    this.packageUrl = this.mainRepo.text;
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
  this.authorNameBox.text = seller.name;
  this.websiteBox.text = seller.package.website;
  this.socialBox.text = seller.package.social;

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
  this.updating = true;
  this.authorNameBox.text = "";
  this.websiteBox.text = "";
  this.socialBox.text = "";

  // in case of reloading, first delete all existing items in drop down
  while (this.extensionList.count) {
    this.extensionList.removeItem(0);
  }

  this.versionBox.text = "";
  this.compatibilityBox.setCurrentIndex(0);
  this.descriptionField.setPlainText("");
  this.keywordsBox.text = "";
  this.repoField.text = "";
  this.filesField.text = "";
  this.licenseBox.text = "";

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

 this.authorNameBox.text = seller.name;
 this.extensionAuthorBox.text = extension.package.author;
 this.versionBox.text = extension.package.version;

 var compatIndex = this.compatibilityBox.findText(extension.package.compatibility);
 this.compatibilityBox.setCurrentIndex(compatIndex);
 this.descriptionField.setPlainText(this.descriptionStringFromHtml(extension.package.description));
 this.keywordsBox.text = extension.package.keywords.join(", ");
 this.repoField.text = extension.package.repository;
 this.iconField.text = extension.package.icon;
 this.filesField.setPlainText(extension.package.files.join(",\n"));
 this.licenseBox.text = extension.package.license;

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
 extensionPackage.author = this.extensionAuthorBox.text;
 extensionPackage.version = this.versionBox.text;
 extensionPackage.compatibility = this.compatibilityBox.currentText;
 extensionPackage.keywords = this.keywordsBox.text.replace(/ /g, "").split(",");
 extensionPackage.repository = this.repoField.text;
 extensionPackage.license = this.licenseBox.text;
 extensionPackage.files = this.filesField.text.replace(/(, | ,)/g, ",").split(",");
 extensionPackage.description = this.htmlFromDescription(this.descriptionField.document().toPlainText());
 extensionPackage.website = this.websiteBox.text;

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
  this.seller.package.name = this.authorNameBox.text;
  this.seller.package.website = this.websiteBox.text;
  this.seller.package.social = this.socialBox.text;
  if (!saveDestination) return;

  var saveFolder = saveDestination.slice(0, saveDestination.lastIndexOf("/"))
  this.localList.saveData("packageLastSaved", saveFolder) // save chosen folder for next time
  this.seller.exportPackage(saveDestination);

  var url = this.mainRepo.text;

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
  var repoUrl = this.repoField.text;
  var includedFiles = this.filesField.plainText.split(",\n");
  var filesPicker = new FilesPicker(repoUrl, includedFiles)
  var includedFiles = filesPicker.exec();

  if (includedFiles){
    this.filesField.setPlainText(includedFiles.join(",\n"));
    this.savePackageInfo();
  }
}

RegisterExtensionDialog.prototype.selectIcon = function (){
  var repoUrl = this.repoField.text;
  var iconFile = this.iconField;
  var filesPicker = new FilesPicker(repoUrl, iconFile)
  var includedFiles = filesPicker.exec();

  if (includedFiles){
    this.iconField.text = includedFiles.join(",");
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


function RegisterWizard(store, localList){
  // RegisterExtensionDialog.call(this, store, localList)
  this.store = store;
  this.localList = localList;
  this.seller;

  this.ui = UiLoader.load(appFolder + "/resources/wizard.ui");
  this.ui.windowTitle = "Register Extension"

  this.PAGES = {
    "MAINREPO":0,
    "PACKAGEFOUND":1,
    "AUTHORINFO":2,
    "EXTENSION":3,
    "DESCRIPTION":4,
    "FILES":5,
    "REVIEW":6
  }

  // add icon
  this.icon = new StyledImage(style.ICONS.headerLogo, 22, 22);
  this.ui.header.logo.setPixmap(this.icon.pixmap);

  this.ui.setStyleSheet(style.getSyleSheet());

  // set dialog geometry
  this.pages = this.ui.pages;

  var width = UiLoader.dpiScale(400)
  var height = UiLoader.dpiScale(550)

  this.pages.minimumWidth = this.pages.maximumWidth = width;
  this.pages.minimumHeight = this.pages.maximumHeight = height;

  this.ui.size = new QSize(width, height);
  var x = QApplication.desktop().width/2-width/2;
  var y = QApplication.desktop().height/2-height/2;
  this.ui.move(x, y);

  // ui elements
  this.progressBar = this.ui.progressBar;
  this.mainRepoPage = this.pages.widget(this.PAGES.MAINREPO);
  this.authorInfoPage = this.pages.widget(this.PAGES.AUTHORINFO);
  this.packageFoundPage = this.pages.widget(this.PAGES.PACKAGEFOUND);
  this.extensionPage = this.pages.widget(this.PAGES.EXTENSION);
  this.descriptionPage = this.pages.widget(this.PAGES.DESCRIPTION);
  this.filesPage = this.pages.widget(this.PAGES.FILES);
  this.reviewPage = this.pages.widget(this.PAGES.REVIEW);

  this.mainRepo = this.mainRepoPage.mainRepoBox;
  this.packageAuthorField = this.packageFoundPage.packageAuthorField;
  this.extensionList = this.packageFoundPage.extensionsList;
  this.packageFoundWarning = this.packageFoundPage.packageFoundWarning;
  this.noPackageWarning = this.authorInfoPage.noPackageWarning;
  this.authorNameBox = this.authorInfoPage.authorNameBox;
  this.websiteBox = this.authorInfoPage.websiteBox;
  this.socialBox = this.authorInfoPage.socialBox;
  this.extensionNameBox = this.extensionPage.extensionNameBox;
  this.licenseBox = this.extensionPage.licenseBox;
  this.compatibilityBox = this.extensionPage.compatibilityBox;
  this.versionBox = this.descriptionPage.versionBox;
  this.descriptionSplitter = this.descriptionPage.descriptionSplitter;
  this.descriptionField = this.descriptionSplitter.widget(0);
  this.htmlPreview = this.descriptionSplitter.widget(1);
  this.keywordsBox = this.descriptionPage.keywordsBox;
  this.extensionAuthorBox = this.descriptionPage.extensionAuthorBox;
  this.repoField = this.filesPage.repoField;
  this.iconField = this.filesPage.iconField;
  this.iconPicker = this.filesPage.iconPicker;
  this.filesField = this.filesPage.filesField;
  this.filesPicker = this.filesPage.filesPicker;
  this.packageField = this.reviewPage.packageField;
  this.mainRepoField = this.reviewPage.mainRepoField;
  this.generateButton = this.reviewPage.generateButton;

  // create the webview programmatically
  this.descriptionPreview = new DescriptionView();

  this.htmlPreview.setLayout(new QVBoxLayout());
  this.htmlPreview.layout().setContentsMargins(0, 0, 0, 0);
  this.htmlPreview.layout().addWidget(this.descriptionPreview, 0, Qt.AlignTop);
  this.descriptionField.textChanged.connect(this, this.updateHtmlPreview);

  // fill url textfield if previously saved to local preferences
  var repoUrl = this.localList.getData("recentGithubUrl", "");
  log.debug(repoUrl);
  if (repoUrl) this.mainRepo.setText(repoUrl);

  // connect navigation buttons
  this.mainRepoPage.page1Next.clicked.connect(this, this.loadPackage)
  this.authorInfoPage.page2Next.clicked.connect(this, function(){this.setCurrentPage(this.PAGES.PACKAGEFOUND);})
  this.extensionPage.page3Next.clicked.connect(this, function(){this.setCurrentPage(this.PAGES.DESCRIPTION);})
  this.descriptionPage.page4Next.clicked.connect(this, function(){this.setCurrentPage(this.PAGES.FILES);})
  this.filesPage.page5Next.clicked.connect(this, function(){this.setCurrentPage(this.PAGES.REVIEW);})
  this.authorInfoPage.page2Back.clicked.connect(this, function(){this.setCurrentPage(this.PAGES.PACKAGEFOUND);})
  this.packageFoundPage.page2bBack.clicked.connect(this, function(){this.setCurrentPage(this.PAGES.MAINREPO);})
  this.extensionPage.page3Back.clicked.connect(this, function(){this.setCurrentPage(this.PAGES.PACKAGEFOUND);})
  this.descriptionPage.page4Back.clicked.connect(this, function(){this.setCurrentPage(this.PAGES.EXTENSION);})
  this.filesPage.page5Back.clicked.connect(this, function(){this.setCurrentPage(this.PAGES.DESCRIPTION);})
  this.reviewPage.page6Back.clicked.connect(this, function(){this.setCurrentPage(this.PAGES.FILES);})

  this.packageFoundPage.addExtensionButton.clicked.connect(this, this.addExtension)
  this.packageFoundPage.editAuthorButton.clicked.connect(this, function(){this.setCurrentPage(this.PAGES.AUTHORINFO);})
  this.packageFoundPage.editExtensionButton.clicked.connect(this, this.editExtension)

  // connect editing fields
  this.extensionList["currentIndexChanged(int)"].connect(this, this.updatePackageInfo);
  this.extensionList["currentIndexChanged(int)"].connect(this, function(){this.extensionNameBox.text = this.extensionList.currentText});

  this.extensionNameBox.editingFinished.connect(this, this.savePackageInfo);
  this.versionBox.editingFinished.connect(this, this.savePackageInfo);
  this.licenseBox.editingFinished.connect(this, this.savePackageInfo);
  this.compatibilityBox["currentIndexChanged(int)"].connect(this, this.savePackageInfo);
  this.descriptionField.focusOutEvent = this.savePackageInfo;
  this.keywordsBox.editingFinished.connect(this, this.savePackageInfo);
  this.repoField.editingFinished.connect(this, this.savePackageInfo);

  this.generateButton.clicked.connect(this, this.generatePackage);

  this.filesPicker.clicked.connect(this, this.selectFiles);
  this.iconPicker.clicked.connect(this, this.selectIcon);

  this.setCurrentPage(this.PAGES.MAINREPO);
}
RegisterWizard.prototype = Object.create(RegisterExtensionDialog.prototype);


RegisterWizard.prototype.setCurrentPage = function (index){
  this.progressBar.value = index;
  this.pages.setCurrentIndex(index);
}


/**
* load the info from the seller into the form
* @param {Seller} seller
*/
RegisterWizard.prototype.loadSeller = function (seller) {
  if (!seller.package) {
    this.setCurrentPage(this.PAGES.AUTHORINFO);
    this.noPackageWarning.visible = true;
    this.packageFoundWarning.visible = false;
    return;
  }

  this.noPackageWarning.visible = false;
  this.packageFoundWarning.visible = true;

  this.seller = seller;
  this.resetPanel();

  // update seller info
  this.packageAuthorField.text = seller.name;

  // edit page
  this.authorNameBox.text = seller.name;
  this.websiteBox.text = seller.package.website;
  this.socialBox.text = seller.package.social;

  var extensions = seller.extensions;
  log.debug("found extensions", Object.keys(extensions));

  // add extensions to the drop down
  for (var i in extensions) {
    log.debug("adding extension " + extensions[i].name);
    this.extensionList.addItem(extensions[i].name, extensions[i].id);
  }
  this.updatePackageInfo(0);

  this.setCurrentPage(this.PAGES.PACKAGEFOUND);
}


RegisterWizard.prototype.editExtension = function(){
  this.updatePackageInfo(this.extensionList.currentIndex);
  this.setCurrentPage(this.PAGES.EXTENSION);
}

RegisterWizard.prototype.addExtension = function(){
  this.savePackageInfo()
  var newName = "New Extension";
  var extension = this.seller.addExtension(newName);
  this.extensionList.addItem(newName, extension.id);
  this.extensionList.setCurrentIndex(this.extensionList.findText(newName));
  this.setCurrentPage(this.PAGES.EXTENSION);
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
exports.RegisterWizard = RegisterWizard