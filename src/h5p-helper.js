const path = require('path');
const glob = require('glob');
const shell = require('shelljs');
const shortid = require('shortid');

const libraryDir = path.join(__dirname, '../h5p/libraries');
const contentDir = path.join(__dirname, '../h5p/content');

async function install(unzipDirectory) {
  const contentId = shortid();
  copyLibraries(unzipDirectory);
  copyContent(unzipDirectory, contentId);
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

module.exports = {
  install
};
