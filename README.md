# Harmony Unofficial Extension Store

<img src="https://raw.githubusercontent.com/mchaptel/ExtensionStore/master/logo_readme.png">

This extension is an open source, user curated extension store to help TB Harmony users exchange the scripts they make.

Harmony brings together all kinds of shades of users, all trying to add their own helpful pieces to the experience and help others make the best animations possible. This store makes it easy to share and discover extensions others have made, and to add your own!

### Compatibility
```Harmony Premium 16 and up (requires package support)```

---

## Installation

Download the zip from the [release page](https://github.com/mchaptel/ExtensionStore/releases) and copy the ``packages`` folder from the zip to the folder [specified here.](https://docs.toonboom.com/help/harmony-17/premium/scripting/import-script.html)

Then, from inside Harmony, open the window called **Extension Store** from the new window drop down.

---

## How to use

Once the window has been added to the Harmony interface, extensions can be installed/uninstalled with a simple click. Users get notified if new updates get posted, and can easily update.

To simplify finding extensions, it is possible to search by extension name but also by keyword.

---

## How it works

HUES is a fully decentralized, open-source store which collects information about extensions made available by script makers on their github pages.

The list of script makers which are fetched by the store is [available here](https://github.com/mchaptel/ExtensionStore/blob/master/SELLERSLIST) and new users can ask to be added by making a pull request or getting in touch.

The github accounts will be checked for good faith, but the content of the extensions on it cannot be curated, so users must make sure they understand what they extensions they install.

For this, users can from the store directly access the repositories in one click from the extension description.

---

## Adding your own extensions

In order to share the scripts they make, script makers must have a github account and create a "main" repository on which they will store the tbpackage.json file that describes the extensions they provide.

This repository's address is the one that will be added to the script maker list file.

Extensions can then be stored on other repositories made by the same user, as long as they are described correctly in the json file.

### **Register an extension:**

After the files have been uploaded to github, it is possible to create the tbpackage.json file automatically by opening the **Register new extension** dialog at the bottom of the store interface. 

The information about the new extension can be entered into the form, and files that will be associated to it can be added by selecting them directly from the repository. It is possible to simply specify a folder in order to include all its contents, as well as a filter to only include specific files from the folder (ex: "*.js" to include only javascript files)

The description can include basic html to be shown in the extension description panel. That said, to display images, only jpg are supported at the moment.

Icons will come soon!

Once the information has been filled, the button "Generate Package File" will allow users to generate a tbpackage.json file and upload it to their main repository. 

It is possible to load an existing file in order to make adjustements and additions, either by loading it from the repository directly or by selecting a local version of the file.

### **Important information for script makers:**

For the moment, version numbers are purely indicative and do not allow script makers to point users to a specific version of the code (commit). It only allows to notify users about there being a new version available. Be careful when making commits that break your extensions. This will be rectified in the future.

---

## License

This extension is released under the Mozilla Public License 2.0.

---

## Acknowledgements

 * [Jonathan Fontaine](https://github.com/jonathan-fontaine/TBScripts/) for his help testing the store and designing the logo.
 * [Chris Fourney](https://github.com/cfourney) for his help writing [openHarmony]() and writing the first install script for this library on which this store is based.
 * All the script makers for their trust using this store.