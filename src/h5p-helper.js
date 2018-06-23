const fs = require('fs');
const path = require('path');
const glob = require('glob');
const shortid = require('shortid');
const toposort = require('toposort');
const decompress = require('decompress');

const rootDir = path.join(__dirname, '../h5p');


async function install(h5pFileName) {
  const contentId = shortid();
  const applicationDir = path.join(rootDir, `./${contentId}`);

  await decompress(h5pFileName, applicationDir);

  createDependencies(applicationDir);

  return {
    contentId
  };

  function createDependencies(applicationDir) {
    const manifestPath = path.join(applicationDir, './h5p.json');
    const manifest = loadJson(manifestPath);
    const preloadedLibs = (manifest.preloadedDependencies || []).map(dependencyToDirName);

    const libMap = new Map();
    preloadedLibs.forEach(lib => addLibraryToMap(lib, libMap, applicationDir));

    const nodes = Array.from(libMap.keys());
    const edges = [];
    libMap.forEach((value, key) => {
      value.preloadedDependencies.forEach(dep => {
        edges.push([dep, key]);
      });
    });

    const orderedLibNames = toposort.array(nodes, edges);

    const preloadedJs = [];
    const preloadedCss = [];
    orderedLibNames.map(libName => libMap.get(libName)).forEach(lib => {
      preloadedJs.push(...lib.preloadedJs);
      preloadedCss.push(...lib.preloadedCss);
    });

    const depsFileName = path.join(applicationDir, './_deps.json');
    writeJson(depsFileName, { preloadedJs, preloadedCss });
  }

  function addLibraryToMap(libName, map, applicationDir) {
    if (map.has(libName)) return;

    const libFileName = path.join(applicationDir, `./${libName}/library.json`);
    const libFile = loadJson(libFileName);
    const preloadedJs = [];
    const preloadedCss = [];
    const preloadedDependencies = [];

    preloadedJs.push(...(libFile.preloadedJs || []).map(dep => path.relative(applicationDir, path.join(applicationDir, libName, dep.path))));
    preloadedCss.push(...(libFile.preloadedCss || []).map(dep => path.relative(applicationDir, path.join(applicationDir, libName, dep.path))));
    preloadedDependencies.push(...(libFile.preloadedDependencies || []).map(dependencyToDirName));
    map.set(libName, { preloadedJs, preloadedCss, preloadedDependencies });

    preloadedDependencies.forEach(dep => addLibraryToMap(dep, map, applicationDir));
  }
}


function getAvailableIds() {
  return glob.sync('./h5p/*/h5p.json').map(f => {
    const manifestPath = path.dirname(f);
    const parentDirName = path.basename(manifestPath);
    return parentDirName;
  });
}


function createIntegration(contentId) {
  const deps = loadDeps(contentId);
  const content = loadContent(contentId);
  const manifest = loadManifest(contentId);
  return {
    baseUrl: 'http://localhost:3000', // No trailing slash
    url: '/whatever',          // Relative to web root
    postUserStatistics: false,
    siteUrl: 'http://localhost:3000/', // Only if NOT logged in!
    l10n: {},
    loadedJs: [], // Only required when Embed Type = div
    loadedCss: [],
    core: {
      scripts: [
        "http://localhost:3000/h5p-library/js/jquery.js",
        "http://localhost:3000/h5p-library/js/h5p.js",
        "http://localhost:3000/h5p-library/js/h5p-event-dispatcher.js",
        "http://localhost:3000/h5p-library/js/h5p-x-api-event.js",
        "http://localhost:3000/h5p-library/js/h5p-x-api.js",
        "http://localhost:3000/h5p-library/js/h5p-content-type.js",
        "http://localhost:3000/h5p-library/js/h5p-confirmation-dialog.js",
        "http://localhost:3000/h5p-library/js/h5p-action-bar.js"
      ],
      styles: [
        "http://localhost:3000/h5p-library/styles/h5p.css",
        "http://localhost:3000/h5p-library/styles/h5p-confirmation-dialog.css",
        "http://localhost:3000/h5p-library/styles/h5p-core-button.css"
      ]
    },
    contents: {
      [`cid-${contentId}`]: {
        library: getMainLibraryForContent(manifest),
        jsonContent: JSON.stringify(content),
        fullScreen: false, // No fullscreen support
        mainId: contentId,
        url: `http://localhost:3000/h5p/${contentId}`,
        title: manifest.title,
        contentUserData: null,
        displayOptions: {
          frame: false, // Show frame and buttons below H5P
          export: false, // Display download button
          embed: false, // Display embed button
          copyright: true, // Display copyright button
          icon: false // Display H5P icon
        },
        styles: deps.preloadedCss.map(p => `http://localhost:3000/h5p/${contentId}/${p}`),
        scripts: deps.preloadedJs.map(p => `http://localhost:3000/h5p/${contentId}/${p}`)
      }
    }
  };
}

function getMainLibraryForContent(manifest) {
  const libName = manifest.mainLibrary;
  const mainDep = manifest.preloadedDependencies.find(dep => dep.machineName === libName);
  return dependencyToClientSideName(mainDep);
}

function loadManifest(contentId) {
  const manifestPath = path.join(rootDir, `./${contentId}/h5p.json`);
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

function loadDeps(contentId) {
  const depsPath = path.join(rootDir, `./${contentId}/_deps.json`);
  return JSON.parse(fs.readFileSync(depsPath, 'utf8'));
}

function loadContent(contentId) {
  const contentPath = path.join(rootDir, `./${contentId}/content/content.json`);
  return JSON.parse(fs.readFileSync(contentPath, 'utf8'));
}

// Returns in library Directory format, e.g. 'H5P.Blanks-1.8'
function dependencyToDirName(dep) {
  return `${dep.machineName}-${dep.majorVersion}.${dep.minorVersion}`;
}

// Returns in format as used for content integration, e.g. 'H5P.Blanks 1.8'
function dependencyToClientSideName(dep) {
  return `${dep.machineName} ${dep.majorVersion}.${dep.minorVersion}`;
}



function loadJson(fileName) {
  return JSON.parse(fs.readFileSync(fileName, 'utf8'));
}

function writeJson(fileName, content) {
  fs.writeFileSync(fileName, JSON.stringify(content), 'utf8');
}



module.exports = {
  install,
  getAvailableIds,
  createIntegration
};
