const fs = require('fs');
const path = require('path');
const express = require('express');
const htmlescape = require('htmlescape');
const decompress = require('decompress');
const h5pHelper = require('./h5p-helper');
const fileUpload = require('express-fileupload');

const app = express();

app.set('views', `${__dirname}/views`);
app.set('view engine', 'ejs');
app.locals.htmlescape = htmlescape;

app.use('/h5p', express.static(path.join(__dirname, '../h5p')));
app.use('/h5p-library', express.static(path.join(__dirname, '../h5p-library')));
app.use('/static', express.static(path.join(__dirname, '../static')));

app.use(fileUpload());

app.get('/', (req, res) => {
  const availableIds = h5pHelper.getAvailableIds();
  res.render('index', { title: 'The index page!', message: undefined, contentId: undefined, availableIds: availableIds });
});

app.post('/', async (req, res) => {
  const availableIds = h5pHelper.getAvailableIds();
  if (!req.files) return res.render('index', { title: 'The index page!', message: 'Upload failed, no file!', contentId: undefined, availableIds: availableIds });

  const tempDir = path.join(__dirname, `../temp/${Date.now()}/`);
  const unzipDir = path.join(tempDir, './decompressed/');
  const tempFileName = path.join(tempDir, './input.h5p');
  fs.mkdirSync(tempDir);

  try {
    await req.files.h5p.mv(tempFileName);
    await decompress(tempFileName, unzipDir);
    const output = await h5pHelper.install(unzipDir);
    res.render('index', { title: 'The index page!', message: 'Installation successful!', contentId: output.contentId, availableIds: availableIds });
  } catch (err) {
    res.render('index', { title: 'The index page!', message: err.toString(), contentId: undefined, availableIds: availableIds });
  }

});

app.get('/play/:contentId', (req, res) => {
  const contentId = req.params.contentId;
  const integration = h5pHelper.createIntegration(contentId);
  res.render('play', { title: 'Play!', contentId: contentId, integration: integration });
});

app.listen(3000, err => {
  if (err) {
    /* eslint no-console: off */
    console.error(err);
  } else {
    console.log(`Example app listening on http://localhost:3000`);
  }
});
