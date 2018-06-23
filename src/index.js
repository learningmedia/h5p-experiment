const os = require('os');
const path = require('path');
const express = require('express');
const htmlescape = require('htmlescape');
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

app.get('/', async (req, res) => {
  const availableIds = await h5pHelper.getAvailableIds();
  res.render('index', { title: 'The index page!', message: undefined, contentId: undefined, availableIds: availableIds });
});

app.post('/', async (req, res) => {
  const availableIds = await h5pHelper.getAvailableIds();
  if (!req.files) return res.render('index', { title: 'The index page!', message: 'Upload failed, no file!', contentId: undefined, availableIds: availableIds });

  try {
    const tempFileName = path.join(os.tmpdir(), `./h5p-${Date.now()}`);
    await req.files.h5p.mv(tempFileName);
    const output = await h5pHelper.install(tempFileName);
    res.render('index', { title: 'The index page!', message: 'Installation successful!', contentId: output.contentId, availableIds: availableIds });
  } catch (err) {
    console.error(err);
    res.render('index', { title: 'The index page!', message: err.toString(), contentId: undefined, availableIds: availableIds });
  }

});

app.get('/play/:contentId', async (req, res) => {
  const contentId = req.params.contentId;
  const integration = await h5pHelper.createIntegration(contentId);
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
