const fs = require('fs');
const path = require('path');
const util = require('util');
const glob = require('glob');
const shortid = require('shortid');
const toposort = require('toposort');
const decompress = require('decompress');

const rootDir = path.join(__dirname, '../h5p');


async function install(h5pFileName) {
  const contentId = shortid();
  const applicationDir = path.join(rootDir, `./${contentId}`);
  const elmuInfoPath = path.join(applicationDir, './_elmu-info.json');

  await decompress(h5pFileName, applicationDir);

  const elmuInfo = await createElmuInfo(applicationDir);
  await writeJson(elmuInfoPath, elmuInfo);

  return {
    contentId
  };
}

async function createElmuInfo(applicationDir) {
  const manifestPath = path.join(applicationDir, './h5p.json');
  const contentPath = path.join(applicationDir, './content/content.json');

  const manifest = await loadJson(manifestPath);
  const content = await loadJson(contentPath);
  const dependencies = await collectDependencies(applicationDir, manifest.preloadedDependencies || []);

  return {
    manifest,
    content,
    dependencies
  };
}

async function collectDependencies(applicationDir, preloadedDependencies) {
  const preloadedLibs = preloadedDependencies.map(dependencyToDirName);

  const libMap = new Map();
  await Promise.all(preloadedLibs.map(lib => addLibraryToMap(lib, libMap, applicationDir)));

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

  return { preloadedJs, preloadedCss };
}

async function addLibraryToMap(libName, map, applicationDir) {
  if (map.has(libName)) return;

  const libFileName = path.join(applicationDir, `./${libName}/library.json`);
  const libFile = await loadJson(libFileName);
  const preloadedJs = [];
  const preloadedCss = [];
  const preloadedDependencies = [];

  preloadedJs.push(...(libFile.preloadedJs || []).map(dep => path.join(libName, dep.path)));
  preloadedCss.push(...(libFile.preloadedCss || []).map(dep => path.join(libName, dep.path)));
  preloadedDependencies.push(...(libFile.preloadedDependencies || []).map(dependencyToDirName));
  map.set(libName, { preloadedJs, preloadedCss, preloadedDependencies });

  await Promise.all(preloadedDependencies.map(lib => addLibraryToMap(lib, map, applicationDir)));
}

async function getAvailableIds() {
  const files = await util.promisify(glob)(path.join(rootDir, './*/_elmu-info.json'));
  return files.map(f => {
    const manifestPath = path.dirname(f);
    const parentDirName = path.basename(manifestPath);
    return parentDirName;
  });
}


async function createIntegration(contentId) {
  const elmuInfoFile = path.join(rootDir, `./${contentId}/_elmu-info.json`);
  const { dependencies, content, manifest } = await loadJson(elmuInfoFile);
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
        styles: dependencies.preloadedCss.map(p => `http://localhost:3000/h5p/${contentId}/${p}`),
        scripts: dependencies.preloadedJs.map(p => `http://localhost:3000/h5p/${contentId}/${p}`)
      }
    }
  };
}

function getMainLibraryForContent(manifest) {
  const mainLibName = manifest.mainLibrary;
  const mainDep = manifest.preloadedDependencies.find(dep => dep.machineName === mainLibName);
  return dependencyToClientSideName(mainDep);
}


// Returns in library Directory format, e.g. 'H5P.Blanks-1.8'
function dependencyToDirName(dep) {
  return `${dep.machineName}-${dep.majorVersion}.${dep.minorVersion}`;
}

// Returns in format as used for content integration, e.g. 'H5P.Blanks 1.8'
function dependencyToClientSideName(dep) {
  return `${dep.machineName} ${dep.majorVersion}.${dep.minorVersion}`;
}

async function loadJson(fileName) {
  return JSON.parse(await util.promisify(fs.readFile)(fileName, 'utf8'));
}

async function writeJson(fileName, content) {
  return await util.promisify(fs.writeFile)(fileName, JSON.stringify(content), 'utf8');
}



module.exports = {
  install,
  getAvailableIds,
  createIntegration
};
