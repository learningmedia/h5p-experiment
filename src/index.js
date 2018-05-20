const fs = require('fs');
const path = require('path');
const express = require('express');
const decompress = require('decompress');
const h5pHelper = require('./h5p-helper');
const fileUpload = require('express-fileupload');

const app = express();

app.set('views', `${__dirname}/views`);
app.set('view engine', 'ejs');

app.use('/h5p', express.static(path.join(__dirname, '../h5p')));
app.use('/h5p-library', express.static(path.join(__dirname, '../h5p-library')));

app.use(fileUpload());

app.get('/', (req, res) => {
  res.render('index', { title: 'The index page!', message: undefined, contentId: undefined });
});

app.post('/', async (req, res) => {
  if (!req.files) return res.render('index', { title: 'The index page!', message: 'Upload failed, no file!', contentId: undefined });

  const tempDir = path.join(__dirname, `../temp/${Date.now()}/`);
  const unzipDir = path.join(tempDir, './decompressed/');
  const tempFileName = path.join(tempDir, './input.h5p');
  fs.mkdirSync(tempDir);

  try {
    await req.files.h5p.mv(tempFileName);
    await decompress(tempFileName, unzipDir);
    const output = await h5pHelper.install(unzipDir);
    res.render('index', { title: 'The index page!', message: 'Installation successful!', contentId: output.contentId });
  } catch (err) {
    res.render('index', { title: 'The index page!', message: err.toString(), contentId: undefined });
  }

});

app.get('/play/:contentId', (req, res) => {
  res.render('play', { title: 'Play!', contentId: req.params.contentId });
});

app.listen(3000, err => {
  if (err) {
    /* eslint no-console: off */
    console.error(err);
  } else {
    console.log(`Example app listening on http://localhost:3000`);
  }
});
