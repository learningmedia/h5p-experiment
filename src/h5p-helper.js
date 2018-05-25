const fs = require('fs');
const path = require('path');
const glob = require('glob');
const shell = require('shelljs');
const shortid = require('shortid');

const rootDir = path.join(__dirname, '..');
const libraryDir = path.join(__dirname, '../h5p/libraries');
const contentDir = path.join(__dirname, '../h5p/content');

async function install(unzipDirectory) {
  const contentId = shortid();
  copyLibraries(unzipDirectory);
  copyContent(unzipDirectory, contentId);
  copyManifest(unzipDirectory, contentId);
  createDependencies(contentId);
  return {
    contentId
  };
}

function copyLibraries(unzipDirectory) {
  glob.sync(`${unzipDirectory}/**/library.json`).forEach(f => {
    const sourcePath = path.dirname(f);
    const libraryName = path.basename(sourcePath);
    const destPath = path.join(libraryDir, libraryName);
    shell.cp('-R', sourcePath, destPath);
  });
}

function copyContent(unzipDirectory, contentId) {
  const sourcePath = path.join(unzipDirectory, './content');
  const destPath = path.join(contentDir, `./${contentId}`);
  shell.cp('-R', sourcePath, destPath);
}

function copyManifest(unzipDirectory, contentId) {
  const sourcePath = path.join(unzipDirectory, './h5p.json');
  const destPath = path.join(contentDir, `./${contentId}/h5p.json`);
  shell.cp(sourcePath, destPath);
}

function createDependencies(contentId) {
  const manifestPath = path.join(contentDir, `./${contentId}/h5p.json`);
  const manifest = loadJson(manifestPath);
  const preloadedLibs = (manifest.preloadedDependencies || []).map(dep => `${dep.machineName}-${dep.majorVersion}.${dep.minorVersion}`);
  const preloadedJs = [];
  const preloadedCss = [];
  preloadedLibs.forEach(lib => {
    const libFileName = path.join(libraryDir, `./${lib}/library.json`);
    const libFile = loadJson(libFileName);
    preloadedJs.push(...(libFile.preloadedJs || []).map(dep => path.relative(rootDir, path.join(libraryDir, lib, dep.path))));
    preloadedCss.push(...(libFile.preloadedCss || []).map(dep => path.relative(rootDir, path.join(libraryDir, lib, dep.path))));
  });
  const depsFileName = path.join(contentDir, `./${contentId}/deps.json`);
  writeJson(depsFileName, { preloadedJs, preloadedCss });
}

function loadJson(fileName) {
  return JSON.parse(fs.readFileSync(fileName, 'utf8'));
}

function writeJson(fileName, content) {
  fs.writeFileSync(fileName, JSON.stringify(content), 'utf8');
}



function createIntegration(contentId) {
  const deps = loadDeps(contentId);
  const content = loadContent(contentId);
  const manifest = loadManifest(contentId);
  return {
    baseUrl: 'http://localhost:3000', // No trailing slash
    url: '/h5p',          // Relative to web root
    postUserStatistics: false,
    siteUrl: 'http://localhost:3000/', // Only if NOT logged in!
    l10n: { // Text string translations
      H5P: {
        fullscreen: 'Fullscreen',
        disableFullscreen: 'Disable fullscreen',
        download: 'Download',
        copyrights: 'Rights of use',
        embed: 'Embed',
        size: 'Size',
        showAdvanced: 'Show advanced',
        hideAdvanced: 'Hide advanced',
        advancedHelp: 'Include this script on your website if you want dynamic sizing of the embedded content:',
        copyrightInformation: 'Rights of use',
        close: 'Close',
        title: 'Title',
        author: 'Author',
        year: 'Year',
        source: 'Source',
        license: 'License',
        thumbnail: 'Thumbnail',
        noCopyrights: 'No copyright information available for this content.',
        downloadDescription: 'Download this content as a H5P file.',
        copyrightsDescription: 'View copyright information for this content.',
        embedDescription: 'View the embed code for this content.',
        h5pDescription: 'Visit H5P.org to check out more cool content.',
        contentChanged: 'This content has changed since you last used it.',
        startingOver: 'You\'ll be starting over.',
        by: 'by',
        showMore: 'Show more',
        showLess: 'Show less',
        subLevel: 'Sublevel'
      }
    },
    loadedJs: [], // Only required when Embed Type = div
    loadedCss: [],
    core: {
      scripts: [
        "/h5p-library/js/jquery.js",
        "/h5p-library/js/h5p.js",
        "/h5p-library/js/h5p-event-dispatcher.js",
        "/h5p-library/js/h5p-x-api-event.js",
        "/h5p-library/js/h5p-x-api.js",
        "/h5p-library/js/h5p-content-type.js",
        "/h5p-library/js/h5p-confirmation-dialog.js",
        "/h5p-library/js/h5p-action-bar.js"
      ],
      styles: [
        "/h5p-library/styles/h5p.css",
        "/h5p-library/styles/h5p-confirmation-dialog.css",
        "/h5p-library/styles/h5p-core-button.css"
      ]
    },
    contents: {
      [`cid-${contentId}`]: {
        library: getMainLibraryForContent(manifest),
        jsonContent: JSON.stringify(content),
        fullScreen: false, // No fullscreen support
        exportUrl: "/path/to/download.h5p",
        embedCode: "<iframe src=\"https://mysite.com/h5p/1234/embed\" width=\":w\" height=\":h\" frameborder=\"0\" allowfullscreen=\"allowfullscreen\"></iframe>",
        resizeCode: "<script src=\"https://mysite.com/h5p-resizer.js\" charset=\"UTF-8\"></script>",
        mainId: contentId,
        url: `http://localhost:3000/h5p/content/${contentId}`,
        title: "How long is a rope?",
        contentUserData: null,
        displayOptions: {
          frame: true, // Show frame and buttons below H5P
          export: true, // Display download button
          embed: true, // Display embed button
          copyright: true, // Display copyright button
          icon: true // Display H5P icon
        },
        styles: deps.preloadedCss.map(p => `/${p}`),
        scripts: deps.preloadedJs.map(p => `/${p}`)
      }
    }
  };
}

function getMainLibraryForContent(manifest) {
  const libName = manifest.mainLibrary;
  const mainDep = manifest.preloadedDependencies.find(dep => dep.machineName === libName);
  return `${mainDep.machineName} ${mainDep.majorVersion}.${mainDep.minorVersion}`; // Library name + major version.minor version
}

function loadManifest(contentId) {
  const manifestPath = path.join(contentDir, `./${contentId}/h5p.json`);
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

function loadDeps(contentId) {
  const depsPath = path.join(contentDir, `./${contentId}/deps.json`);
  return JSON.parse(fs.readFileSync(depsPath, 'utf8'));
}

function loadContent(contentId) {
  const contentPath = path.join(contentDir, `./${contentId}/content.json`);
  return JSON.parse(fs.readFileSync(contentPath, 'utf8'));
}

module.exports = {
  install,
  createIntegration
};
