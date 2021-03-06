var Crawler = require("crawler");
var mysql = require("mysql");

var pool = mysql.createPool({
	connectionLimit: 10,
	host: "localhost",
	port: "23306",
	user: "ops",
	password: "",
	database: 'ops'
});

var secretarios = function name($, id_senador, done) {

	var $trs = $("#conteudo_transparencia").find("#todos, #efetivos, #comissionados, #terceirizados, #estagiarios").find('tbody tr');
	var length = $trs.length;
	if (length > 0) {

		for (let i = 0; i < length; i++) {
			var children = $trs.eq(i).find('td');

			var secretario = {
				id_senador: id_senador,
				nome: children.eq(0).text().trim(),
				funcao: children.eq(1).text().trim(),
				nome_funcao: children.eq(2).text().trim(),
				link: children.eq(0).find('a').attr('href')
			}

			crawler.queue({
				priority: 4,
				uri: secretario.link,
				id_senador: id_senador,
				secretario: secretario,
				passo: 'secretario-remuneracao'
			});
		}
	}else{
		console.log(id_deputado);
	}

	done();
};

var remuneracao = function name($, secretario, done) {

	var $trs = $(".tabela_identifica td.coldados_identifica");

	var i = 0;
	secretario.vinculo = $trs.eq(++i).text().trim();
	secretario.situacao = $trs.eq(++i).text().trim();
	secretario.admissao = $trs.eq(++i).text().trim();
	secretario.cargo = $trs.eq(++i).text().trim();

	if(secretario.vinculo == 'EFETIVO'){
		secretario.padrao = $trs.eq(++i).text().trim();
		secretario.especialidade = $trs.eq(++i).text().trim();
		if(secretario.funcao != $trs.eq(++i).text().trim()){
			secretario.funcao = $trs.eq(i).text().trim();
		}
		if(secretario.nome_funcao != $trs.eq(++i).text().trim()){
			secretario.nome_funcao = $trs.eq(i).text().trim();
		}
		secretario.lotacao = $trs.eq(++i).text().trim();
	}else{
		secretario.funcao = $trs.eq(++i).text().trim();
		secretario.nome_funcao = $trs.eq(++i).text().trim();
		secretario.lotacao = $trs.eq(++i).text().trim();
	}

	if(secretario.funcao == secretario.lotacao){
		var a = 1;
	}

	var sqlParams = [
		secretario.link.replace('http://www.senado.leg.br/transparencia/rh/servidores/detalhe.asp?fcodigo=', ''),
		secretario.id_senador,
		secretario.nome,
		secretario.funcao,
		secretario.nome_funcao,	
		secretario.vinculo,
		secretario.situacao,
		secretario.admissao,
		secretario.cargo,
		secretario.padrao,
		secretario.especialidade,
		secretario.lotacao,			
	];
	var sqlInsertSecretario =
		"insert into sf_secretario_temp " +
		"(id, id_senador, nome, funcao, nome_funcao, vinculo, situacao, admissao, cargo, padrao, especialidade, lotacao) " +
		"values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
	pool.query(sqlInsertSecretario, sqlParams, function (error, results, fields) {
		if (error) {
			console.log(secretario.link);
			throw error;
		}

		done();
	});
};

var crawler = new Crawler({
	maxConnections: 1,
	// This will be called for each crawled page
	rateLimit: 50,
	callback: function (error, res, done) {
		if (error) {
			console.log(error);
			done();
		} else if (res.statusCode == 200) {
			var $ = res.$;

			if (res.options.passo == 'lista-secretario') {
				secretarios($, res.options.id_senador, done);
			} else if (res.options.passo == 'secretario-remuneracao') {
				remuneracao($, res.options.secretario, done);
			}
		} else if(res.statusCode != 404){
			console.log(res.options.uri);
			console.log(res.statusCode + res.statusMessage);
			done();
		}else{
			done();
		}
	}
});
crawler.on('request', function (options) {
	// console.log('Request:' + options.uri);
});
crawler.on('drain', function () {
	console.log(new Date().toJSON() + ' - Done!');
	process.exit();
	// pool.query(sqlInsertSecretario, sqlParams, function (error, results, fields) {
	// 	if (error) throw error;

	// 	done();
	// });

	// // For example, release a connection to database.
	// db.end();// close connection to MySQL
});

console.log(new Date().toJSON() + ' - Start!');
var sqlDeputados = "SELECT id, nome FROM sf_senador WHERE ativo = 'S'";
pool.query(sqlDeputados, function (error, results, fields) {
	if (error) throw error;

	for (let index = 0; index < results.length; index++) {
		const row = results[index];

		crawler.queue({
			priority: 5,
			uri: 'https://www6g.senado.leg.br/transparencia/sen/' + row['id'] + '/pessoal/?local=gabinete&ano=2020',
			id_senador: parseInt(row['id']),
			passo: 'lista-secretario'
		});
	}
});
