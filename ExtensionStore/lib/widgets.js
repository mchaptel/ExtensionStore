var Logger = require("logger.js").Logger;
var style = require("style.js");
var log = new Logger("Widgets");

/**
 * A QWebView to display the description
 * @param {QWidget} parent
 */
function DescriptionView(parent){
  var webPreviewsFontFamily = "Arial";
  var webPreviewsFontSize = UiLoader.dpiScale(12);

  QWebView.call(this, parent)

  this.setMinimumSize(0, 0);
  this.setSizePolicy(QSizePolicy.Maximum, QSizePolicy.Maximum);
  var settings = this.settings();
  settings.setFontFamily(QWebSettings.StandardFont, webPreviewsFontFamily);
  settings.setFontSize(QWebSettings.DefaultFontSize, webPreviewsFontSize);
}
DescriptionView.prototype = Object.create(QWebView.prototype)


/**
 * The QTreeWidgetTtem that represents a single extension in the store list.
 * @classdesc
 * @param {storeLib.Extension} extension           the extension which will be represented by this item
 * @param {storelib.LocalExtensionList} localList  the list of extensions installed on this machine
 * @param {QTreeWidget} parent                     the parent widget for this item
 */
function ExtensionItem(extension, localList, parent) {
  this._parent = parent // this is the QTreeWidget
  var newExtensions = localList.getData("newExtensions", []);
  var extensionLabel = extension.name;

  if (newExtensions.indexOf(extension.id) != -1) extensionLabel += " ★new!"

  QTreeWidgetItem.call(this, [extensionLabel, icon], 1024);
  // add an icon in the middle column showing if installed and if update present
  if (localList.isInstalled(extension)) {
    var iconPath = style.ICONS.installed;
    this.setToolTip(1, "Extension is installed correctly.");
    var localExtension = localList.extensions[extension.id];
    if (localExtension.currentVersionIsOlder(extension.version)) {
      iconPath = style.ICONS.update;
      this.setToolTip(1, "Update available:\ncurrently installed version : v" + extension.version);
    } else if (!localList.checkFiles(localExtension)) {
      iconPath = style.ICONS.error;
      this.setToolTip(1, "Some files from this extension are missing.");
    }
  } else {
    iconPath = style.ICONS.notInstalled;
  }
  var icon = new StyledImage(iconPath, 18, 18);
  icon.setAsIcon(this, 1);

  if (extension.iconUrl){
    // set up an icon if one is available
    log.debug("adding icon to extension "+ extension.name + " from url : "+extension.iconUrl)
    this.extensionIcon = new WebIcon(extension.iconUrl);
    this.extensionIcon.setToWidget(this);

  }else{
    // fallback to local icon
    var extensionIcon = new StyledImage(style.ICONS.defaultExtension, 20, 20);
    extensionIcon.setAsIcon(this, 0);
  }

  // store the extension id in the item
  this.setData(0, Qt.UserRole, extension.id);
}
ExtensionItem.prototype = Object.create(QTreeWidgetItem.prototype);


/**
 * A button that can show progress by animating the background stylesheet.
 * @classdesc
 * @constructor
 */
function ProgressButton(color, text, progressText, finishedText){
  if (typeof finishedText === 'undefined') var finishedText = "Done";
  if (typeof progressText === 'undefined') var progressText = "In progress...";

  QToolButton.call(this);
  this.maximumWidth = this.minimumWidth = UiLoader.dpiScale(130);
  this.maximumHeight = this.minimumHeight = UiLoader.dpiScale(30);
  this.backgroundColor = style.COLORS["12DP"]; // get this from stylesheet?
  this.accentColor = color;
  this.defaultText = text;
  this.progressText = progressText;
  this.finishedText = finishedText;
  this.hasFailed = false;
}
ProgressButton.prototype = Object.create(QToolButton.prototype);


/**
 * The accent color used by the button to show the loading and the border.
 * Setting this will apply the corresponding stylesheet.
 */
Object.defineProperty(ProgressButton.prototype, "accentColor", {
  get: function(){
    return this._accentColor;
  },
  set: function(newColor){
    this._accentColor = newColor;
    this.setStyleSheet(style.STYLESHEETS.progressButton.replace("@ACCENT", this._accentColor))
  }
})


/**
 * Use the background stylesheet of the widget to act as a progress bar.
 * @param {Int} progress - Value from 0 to 1 that the operation is currently at.
 */
ProgressButton.prototype.setProgress = function (progress, message) {

  // Disable progress updates if the button has failed. hasFailed is Implemented in child classes.
  if (this.hasFailed) {
    return;
  }

  var accentColor = this.accentColor;
  var backgroundColor = this.backgroundColor;

  // Nothing to do.
  if (progress === 0) return;

  // Operation in progress
  if (progress < 1) {
    this.enabled = false;

    // Set stylesheet to act as a progressbar.
    var progressStopR = progress;
    var progressStopL = progressStopR - 0.001;
    var progressStyleSheet = "QToolButton {" +
      "background-color:" +
      "  qlineargradient(" +
      "    spread:pad," +
      "    x1:0, y1:0, x2:1, y2:0," +
      "    stop: " + progressStopL + " " + accentColor + "," +
      "    stop:" + progressStopR + " " + backgroundColor +
      "  );"+
      "  border-color: transparent transparent " + accentColor + " transparent;" +
      "  color: white;" +
      "}";
    // Update widget with the new linear gradient progression.
    this.setStyleSheet(progressStyleSheet);

    // Update text with progress
    this.text = message?message:this.progressText + " " + Math.round((progressStopR * 100)) + "%";

  } else {
    // Configure widget to indicate the operation is complete.
    this.setStyleSheet("QToolButton { border: none; background-color: " + accentColor + "; color: white}");
    this.enabled = true;
    this.text = message?message:this.finishedText;
  }
}


/**
 * ProgressButton child class for Extension installation, uninstallation and updates.
 * @classdesc
 * @constructor
 * @param {String} mode - Default mode to set the button to.
 */
function InstallButton() {
  ProgressButton.call(this);
  this.modes = {
    "INSTALL": {
      "action": new QAction("Install", this),
      "progressText": "Installing...",
      "accentColor": style.COLORS.GREEN,
    },
    "UNINSTALL": {
      "action": new QAction("Uninstall", this),
      "progressText": "Uninstalling...",
      "accentColor": style.COLORS.ORANGE,
    },
    "UPDATE": {
      "action": new QAction("Update", this),
      "progressText": "Updating...",
      "accentColor": style.COLORS.YELLOW,
    },
    "FAIL": {
      "action": new QAction("Failed", this),
      "progressText": "Failed",
      "accentColor": style.COLORS.RED,
    }
  }

  this.mode = "INSTALL";
}
InstallButton.prototype = Object.create(ProgressButton.prototype);


/**
 * Get or Set the button mode.
 * Changing the mode alters the visual appearance as well
 * as exposes a different Action.
 */
Object.defineProperty(InstallButton.prototype, "mode", {
  get: function () {
    return this.modes[this._mode];
  },
  set: function (mode) {
    var mode = mode.toUpperCase();
    var modeDetails = this.modes[mode]
    if (!modeDetails) throw new Error ("Can't set InstallButton mode to "+ mode+ ", mode can only be 'INSTALL', 'UNINSTALL' or 'UPDATE'." )

    if (mode !== this._mode){
      this._mode = mode;
      this.accentColor = modeDetails.accentColor;
      this.progressText = modeDetails.progressText;
      this.removeAction(this.defaultAction());
      this.setDefaultAction(modeDetails.action);
      this.hasFailed = false;
    }
  }
});


/**
 * Disable progress updates on the button, and set the button mode/stylesheet to indicate failure of
 * an extension install.
 */
InstallButton.prototype.setFailState = function() {
   // Only needs to run once.
   if (this.hasFailed) {
     return;
   }

  this.hasFailed = true;
  this.mode = "FAIL";
  this.setProgress(100);
  this.text = "Failed";
}


/**
 * ProgressButton child class for Loading operations.
 * @classdesc
 * @constructor
 */
function LoadButton() {
  ProgressButton.call(this, style.COLORS.ACCENT_PRIMARY, "Load Store", "Loading...");
  this.action = new QAction(this.defaultText, this);
  this.setDefaultAction(this.action);

}
LoadButton.prototype = Object.create(ProgressButton.prototype);


/**
 * A simple button to display a social media link
 * @param {string} url
 */
function SocialButton(url){
  QToolButton.call(this);
  this.toolTip = url;

  this.maximumHeight = this.maximumWidth = UiLoader.dpiScale(24);

  // shadows seem to accumulate? leaving this in the hope to fix it later
  style.addDropShadow(this);

  var icon = new WebIcon(url);
  icon.setToWidget(this);

  this.clicked.connect(this, function(){
    QDesktopServices.openUrl(new QUrl(url));
  })
}
SocialButton.prototype = Object.create(QToolButton.prototype)


/**
 * A Qt like custom signal that can be defined, connected and emitted.
 * As this signal is not actually threaded, the connected callbacks will be executed
 * directly when the signal is emited, and the rest of the code will execute after.
 * @param {type} type - The type of value accepted as argument when calling emit()
 */
 function Signal(type){
  // this.emitType = type;
  this.connexions = [];
  this.blocked = false;
}


/**
 * Register the calling object and the slot.
 * @param {object} context
 * @param {function} slot
 */
Signal.prototype.connect = function (context, slot){
  // support slot.connect(callback) synthax
  if (typeof slot === 'undefined'){
    var slot = context;
    var context = null;
  }
  this.connexions.push ({context: context, slot:slot});
}


/**
 * Remove a connection registered with this Signal.
 * @param {function} slot
 */
Signal.prototype.disconnect = function(slot){
  if (typeof slot === "undefined"){
    this.connexions = [];
    return
  }

  for (var i in this.connexions){
    if (this.connexions[i].slot == slot){
      this.connexions.splice(i, 1);
    }
  }
}


/**
 * Call the slot function using the provided context and and any arguments.
 */
Signal.prototype.emit = function () {
  if (this.blocked) return;

  // if (!(value instanceof this.type)){ // can't make it work for primitives, might try to fix later?
  //   throw new error ("Signal can't emit type "+ (typeof value) + ". Must be : " + this.type)
  // }

  var args = [];
  for (var i=0; i<arguments.length; i++){
    args.push(arguments[i]);
  }

  log.debug("emiting signal with "+ args);

  for (var i in this.connexions){
    var context = this.connexions[i].context;
    var slot = this.connexions[i].slot;
    log.debug("calling slot "+ slot);

    // support connecting signals to each other
    if (slot instanceof Signal){
      slot.emit.apply(context, args)
    }else{
      slot.apply(context, args);
    }
  }
}


Signal.prototype.toString = function(){
  return "Signal";
}


/**
 * Child class QProgressBar to remap the number range used by ProgressButton's QLinearGradient
 * into the range used by the QProgressBar.
 */
function ProgressBar() {
  QProgressBar.call(this);

  // Exclusively using an input percentage from 0 => 100.
  this.value = 0;
  this.maximum = 100;

  // Set the default geometry.
  this.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding);
  this.maximumHeight = 5;

  // Hide progress text.
  this.textVisible = false;
}
ProgressBar.prototype = Object.create(QProgressBar.prototype);


/**
 * Transform the input value from the input range (0=>1) to the range expected
 * by the QProgressBar (0=>100). Set the progressbar value with the remapped value..
 * @param {number} value - Progress as a percentage with a range of 0 => 1.
 */
ProgressBar.prototype.setProgress = function(value) {
  this.setValue(value * 100);
}


exports.Signal = Signal;
exports.ProgressButton = ProgressButton;
exports.LoadButton = LoadButton;
exports.InstallButton = InstallButton;
exports.DescriptionView = DescriptionView;
exports.ExtensionItem = ExtensionItem;
exports.ProgressBar = ProgressBar;
exports.SocialButton = SocialButton;