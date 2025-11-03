const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const path = require('path');

const PORT = process.env.PORT || 8000;
const code = require('./pair');

// Mete limit event listeners (evite warning)
require('events').EventEmitter.defaultMaxListeners = 500;

// Rasin pwojè a
const __path = process.cwd();

// Middleware pou body parser
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Sèvi dosye statik yo (HTML, CSS, JS, imaj, elatriye)
app.use(express.static(path.join(__path, 'public')));

// Route pou /code (soti nan pair.js)
app.use('/code', code);

// Route pou /pair → voye pair.html
app.get('/pair', (req, res) => {
  res.sendFile(path.join(__path, 'public', 'pair.html'));
});

// Route prensipal (/) → voye main.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__path, 'public', 'index.html'));
});

// Kòmanse server la
app.listen(PORT, () => {
  console.log(`
Don't Forget To Give Star ‼️
Server running on http://localhost:${PORT}
`);
});

module.exports = app;
