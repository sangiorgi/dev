require('express-async-errors');
const express = require('express');
const path = require('path');
const https = require('https');
const cors = require('cors');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const app = express();


const options = {
    key: fs.readFileSync(path.join(__dirname, 'cert', 'privateNew.key')),
    cert: fs.readFileSync(path.join(__dirname, 'cert', 'sanmodas_com_br.crt')),
    ca: fs.readFileSync(path.join(__dirname, 'cert', 'ca_sanmodas_com_br.crt'))
};

let portHTTPS = process.env.PORT || 3443;
let rorders = require('./routes/orders');
let rshipments = require('./routes/shipments');
let {ritems} = require('./routes/items');
let rquestions = require('./routes/questions');
let rclaims = require('./routes/claims');
let rask = require('./routes/ask');
let renewml = require('./routes/renew');
let mess = require('./routes/messages');

app.engine('html', require('ejs').renderFile);
app.set('views', path.join(__dirname, '/pages'));
app.set('view engine', 'html');
//app.use(cors({origin: ['https://sanmodas.com.br:3443']}));
app.use(cors({origin: '*'}));
app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use('/public', express.static(path.join(__dirname, 'public')));

app.get('/', function(req, res, next) { 	
    res.render('\home');     	
});

const authenticateToken = (req, res, next) => {
    let authHeader = req.headers['authorization'];
    let token = authHeader && authHeader.split(' ')[1];  
    if (token == null) { return res.status(401).send('acesso não autorizado'); };
    jwt.verify(token, process.env.LINUX_TOKEN_SECRET, (err, user) => {          
        if (err) { return res.status(403).send('token inválido'); };
        next();
    });
};

app.post('/api/v1/post_ml', (req, res, next) => {
    let objs = ['items', 'orders_v2', 'shipments', 'questions', 'claims'];
    let topic = req.body.topic;       
	res.sendStatus(200); 	
    //if (objs.includes(topic) && req.body.user_id != 371764921) {		
    if (objs.includes(topic)) {		
        req.url = `/${topic}`;
        next();
    }
    else { 	
		res.end();
	};	
});

app.use('/orders_v2', rorders);
app.use('/shipments', rshipments);
app.use('/items', ritems);
app.use('/questions', rquestions);
app.use('/claims', rclaims);
app.use('/api/v1/ask_ml', rask);
app.use('/api/v1/renew_ml', authenticateToken, renewml);
app.use('/api/v1/messages', mess);


const server = https.createServer(options, app).listen(portHTTPS, () => {
  HOST: 0.0.0.0
  console.clear();
  console.info('server escutando na porta ' + portHTTPS + "!");
});

server.keepAliveTimeout = (180 * 1000) + 1000;
server.headersTimeout = (180 * 1000) + 2000;
server.setTimeout(120_000);
server.addListener('clientError', (err, socket) => socket.destroy(err));
server.addListener('sessionError', (err, session) => socket.destroy(err));
server.addListener('session', session => session.setTimeout(60_000, () => session.destroy(new Error('TIMEOUT'))));
server.addListener('stream', (stream) => stream.addListener('error', (err) => stream.destroy(err)));

module.exports = app;
