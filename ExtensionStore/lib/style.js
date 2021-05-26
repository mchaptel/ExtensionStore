var Logger = require("./logger.js").Logger;
var io = require("./io.js");

var log = new Logger("Style");
var appFolder = require("./store.js").appFolder;

// Enum to hold dark style palette.
// 4% opacity over Material UI palette.
const ColorsDark = {
    "00DP": "#121115",
    "01DP": "#1E1D21",
    "02DP": "#232226",
    "03DP": "#252428",
    "04DP": "#29282C",
    "06DP": "#2C2B2F",
    "08DP": "#2E2D31",
    "12DP": "#333236",
    "16DP": "#363539",
    "24DP": "#38373B",
    "ACCENT_LIGHT": "#B6B1D8", // Lighter - 50% white screen overlaid.
    "ACCENT_PRIMARY": "#4B3C9E", // Full intensity
    "ACCENT_DARK": "#373061", // Subdued - 50% against D1
    "ACCENT_BG": "#2B283B", // Very subdued - 20% against D1
    "GREEN": "#30D158", // Valid.
    "RED": "#FF453A", // Error
    "YELLOW": "#FFD60A", // New or updated
    "ORANGE": "#FF9F0A", // Notice.
    "BLUE": "#A1CBEC", // Store update.
}

// Enum to hold light style palette.
// TODO: Make dedicated light theme and associated palette.
const ColorsLight = ColorsDark;

const COLORS = isDarkStyle() ? ColorsDark : ColorsLight;

var iconFolder = appFolder + "/resources";
const ICONS = {
    "installed": getImage(iconFolder + "/installed_icon.png"),
    "update": getImage(iconFolder + "/update_icon.png"),
    "error": getImage(iconFolder + "/error_icon.png"),
    "not installed": getImage(iconFolder + "/not_installed_icon.png"),
}

/**
 * Detect the current Harmony application stylesheet.
 * @returns {Boolean} true if dark style active, false if light theme active.
 */
function isDarkStyle() {
    return preferences.getBool("DARK_STYLE_SHEET", "");
}


/**
 * Build and return a final qss string. Incorporate all necessary
 * style-specific overrides.
 */
function getSyleSheet() {
    var styleFile = storelib.appFolder + "/resources/stylesheet_dark.qss";
    var styleSheet = io.readFile(styleFile);

    // Get light-specific style overriddes
    if (!isDarkStyle()) {
        styleFileLight = storelib.appFolder + "/resources/stylesheet_light.qss";
        styleSheet += io.readFile(styleFileLight);
    }

    // Replace template colors with final palettes.
    for (color in COLORS) {
        var colorRe = new RegExp("@" + color, "g");
        styleSheet = styleSheet.replace(colorRe, COLORS[color]);
    }

    log.debug("Final qss stylesheet:\n" + styleSheet);
    return styleSheet;
}


/**
 * Return the appropriate image path based on Harmony style.
 * @param {String} imagePath
 * @returns {String} Path to the correct image for the Harmony style.
 */
function getImage(imagePath) {

    // Images are default themed dark - just return the original image if dark style is active.
    if (isDarkStyle()) {
        return imagePath;
    }

    // Harmony in light theme. Attempt to use @light variant.
    var image = new QFileInfo(imagePath);
    var imageRemapped = new QFileInfo(image.absolutePath() + "/" + image.baseName() + "@light." + image.suffix());
    if (imageRemapped.exists()) {
        log.debug("Using light themed variant of of " + imagePath);
        return imageRemapped.filePath();
    }

    // @light variant not found, fallback to using original image path.
    log.debug("No light styled variant of image, using default.");
    return imagePath;
}

exports.ICONS = ICONS;
exports.COLORS = COLORS;
exports.getImage = getImage;
exports.getSyleSheet = getSyleSheet;