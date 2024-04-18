var express = require('express');
var router = express.Router();
const {userModel} = require('../public/middle/models');
const upload = require("multer")();
const bcrypt = require('bcryptjs');

router.get('/', async (req, res) => { 
  await userModel.find().then(users => {
          if (users) {
            var arrResp = [];
            users.forEach((user) => {
              var objUser = { id: user._id, nome: user.user_name, login: user.login, nivel: user.level, ultimo_acesso: user.last_login };
              arrResp.push(objUser);
            });
            return res.status(200).json({ total: users.length, resultData: arrResp });
          }
          else { return res.status(500).send('Não encontrados.'); }
      });   
});

router.post('/', upload.single(''), async (req, res) => { 
    await userModel.findOne({
        login: req.body.login
      }).then(user => {
        if (user) {
          return res.status(500).send('Este usuário já existe.');
        } 
	      var salt = bcrypt.genSaltSync(10);
        req.body.password = bcrypt.hashSync(req.body.password, salt);    
        const newUser = new userModel({
              user_name: req.body.user_name,
              login: req.body.login,
              email: req.body.email,
              password: req.body.password,
              level: req.body.level,
              last_login: req.body.last_login
          });
          newUser.save()
              .then((user) => {
                  var objUser = { id: user._id, nome: user.user_name, login: user.login, nivel: user.level, ultimo_acesso: user.last_login };
                  return res.status(200).json({ total: 1, resultData: objUser });
              }).catch((err) => { res.status(500).send(err);});                   
    });   
});

router.delete('/', async (req, res) => {
    var id = req.query.user_id; //needs id to delete in Mongo Database
    if (!id) { res.status(404).send('id usuário não informado'); }
    await userModel.findByIdAndDelete(id).then(user => {      
      var objUser = { id: user._id, nome: user.user_name, login: user.login, nivel: user.level, ultimo_acesso: user.last_login };
      return res.status(200).json({ total: 1, resultData: objUser });
    }).catch(error => {
      return res.status(500).send(error);
    });        
});

module.exports = router;