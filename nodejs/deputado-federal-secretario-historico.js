var Crawler = require("crawler");
var mysql = require("mysql");

var pool = mysql.createPool({
	connectionLimit: 100,
	host: "localhost",
	port: "13306",
	user: "root",
	password: "",
	database: 'ops'
});


var secretarioAno = function name($, options, done) {
	if($('#anoRemuneracao').length == 0){
		// console.log('1 - ' + $('main script').text().trim().split("'")[1]);
		if(!$('main script').text().trim().split("'")[1]){
			console.log($('.remuneracao-funcionario').text().trim() + ' - ' + options.uri);
			done();
			return;
		}

		crawler.queue({
			priority: 4,
			uri: $('main script').text().trim().split("'")[1],
			chave: options.chave,
			passo: 'secretario-ano'
		});
		done();
	}else{
		var $itens = $('#anoRemuneracao').find('option');
		var length = $itens.length;
		$itens.each(function(i) {
			if ( this.attribs.value.indexOf('?') != -1 ) {
				// console.log('2 - https://www.camara.leg.br/transparencia/recursos-humanos/remuneracao/' + this.attribs.value);

				crawler.queue({
					priority: 3,
					uri: 'https://www.camara.leg.br/transparencia/recursos-humanos/remuneracao/' + this.attribs.value,
					passo: 'secretario-ano-mes',
					chave: options.chave,
					ano: this.children[0].data
				});
			}

			if(i + 1 === length){
				done();
			}
		});
	}
};

var secretarioAnoMes = function name($, options, done) {
	if($('#mesRemuneracao').length == 0){
		// console.log('3 - ' + $('main script').text().trim().split("'")[1]);
		if(!$('main script').text().trim().split("'")[1]){
			var a = 1;
		}

		crawler.queue({
			priority: 2,
			uri: $('main script').text().trim().split("'")[1],
			passo: 'secretario-ano-mes',
			chave: options.chave
		});
	}else{
		var $linhaTempo = $('.linha-tempo .linha-tempo__item');

		var $itens = $('#mesRemuneracao').find('option');
		var length = $itens.length;
		$itens.each(function(i, el) {
			if($linhaTempo.find('.linha-tempo__marco .sr-only:contains("' + this.children[0].data + '")').closest('.linha-tempo__item').css('display') == 'none') {
				if(i + 1 === length){
					done();
				}
				return;
			}

			// console.log('4 - https://www.camara.leg.br/transparencia/recursos-humanos/remuneracao/' + options.chave + '?ano=' + options.ano + '&mes=' + this.attribs.value);
			// if(!(options.chave + '?ano=' + options.ano + '&mes=' + this.attribs.value)){
			// 	var a = 1;
			// }
			
			var mes = this.attribs.value;
			var id_cf_secretario = options.chave;
			var referencia = options.ano + (parseInt(mes) < 10? '0' : '') + mes;
			var sqlParams = [id_cf_secretario, referencia];

			var sqlSecretarios = "SELECT 1 FROM ops.cf_secretario_remuneracao_temp where id_cf_secretario = ? and referencia = ? limit 1";
			pool.query(sqlSecretarios, sqlParams, function (error, results, fields) {
				if (error) throw error;

				if(results.length === 0){
					crawler.queue({
						priority: 1,
						uri: 'https://www.camara.leg.br/transparencia/recursos-humanos/remuneracao/' + options.chave + '?ano=' + options.ano + '&mes=' + mes,
						passo: 'secretario-remuneracao',
						chave: options.chave,
						ano: options.ano,
						mes: mes
					});
				}

				if(i + 1 === length){
					done();
				}
			});
		});
	}
};

var getValue = function ($tbody, text) {
	return parseFloat($tbody.find('td:contains("' + text + '")').next().text().replace('.', '').replace(',', '.'));
}

var remuneracao = function name($, options, done) {
	var secretario = {};
	var $tables = $(".remuneracao-funcionario__info");

	if ($tables.length > 0) {
		var length = $tables.length;

		for (let i = 0; i < $tables.length; i++) {
			let $tbody = $($tables[i]);
			secretario = {};
			secretario.valor_bruto = 0;
			secretario.valor_liquido = 0;
			secretario.valor_outros = 0;

			// 012020 - FOLHA NORMAL
			// 122019 – FOLHA DE GRATIFICAÇÃO NATALINA
			// 012020 - FOLHA DE ADIANTAMENTO GRATIFICAÇÃO NATALINA
			secretario.referencia = options.ano + (parseInt(options.mes) < 10? '0' : '') + options.mes;

			let remuneracao_titulo = $tbody.find('.remuneracao-funcionario__mes-ano').text().split('–');
			secretario.descricao = remuneracao_titulo[1].trim();
			let refrencia = remuneracao_titulo[0].trim();

			if(refrencia != (parseInt(options.mes) < 10? '0' : '') + options.mes + options.ano){
				console.log(secretario.link_remuneracao + " Referencia invalida! " + refrencia + ' != ' + options.mes + options.ano);
				if(length == i+1){
					done();
				}
				return;
			}

			if ($tbody.find('thead>tr>th').eq(0).text() == "Descrição") {

				// 1 - Remuneração Básica
				secretario.remuneracao_fixa = getValue($tbody, 'Remuneração Fixa');
				secretario.vantagens_natureza_pessoal = getValue($tbody, 'Vantagens de Natureza Pessoal');

				// 2 - Remuneração Eventual/Provisória
				secretario.funcao_ou_cargo_em_comissao = getValue($tbody, 'Função ou Cargo em Comissão');
				secretario.gratificacao_natalina = getValue($tbody, 'Gratificação Natalina');
				secretario.ferias = getValue($tbody, 'Férias (1/3 Constitucional)');
				secretario.outras_remuneracoes = getValue($tbody, 'Outras Remunerações Eventuais/Provisórias');

				secretario.valor_bruto += 
					secretario.remuneracao_fixa + 
					secretario.vantagens_natureza_pessoal + 
					secretario.funcao_ou_cargo_em_comissao + 
					secretario.gratificacao_natalina + 
					secretario.ferias + 
					secretario.outras_remuneracoes;

				// 3 - Abono Permanência
				secretario.abono_permanencia = getValue($tbody, 'Abono Permanência');
				
				// 4 - Descontos Obrigatórios(-)
				secretario.redutor_constitucional = getValue($tbody, 'Redutor Constitucional');
				secretario.contribuicao_previdenciaria = getValue($tbody, 'Contribuição Previdenciária');
				secretario.imposto_renda = getValue($tbody, 'Imposto de Renda');

				//5 - Remuneração após Descontos Obrigatórios
				secretario.valor_liquido += getValue($tbody, 'Remuneração após Descontos Obrigatórios');

				//6 - Outros
				secretario.valor_diarias = getValue($tbody, 'Diárias');
				secretario.valor_auxilios = getValue($tbody, 'Auxílios');
				secretario.valor_vantagens = getValue($tbody, 'Vantagens Indenizatórias');
				secretario.valor_outros += secretario.valor_diarias + secretario.valor_auxilios + secretario.valor_vantagens;
			}

			let sqlParams = [
				options.chave,
				secretario.referencia,
				secretario.descricao,
				secretario.remuneracao_fixa,
				secretario.vantagens_natureza_pessoal,
				secretario.funcao_ou_cargo_em_comissao,
				secretario.gratificacao_natalina,
				secretario.ferias,
				secretario.outras_remuneracoes,
				secretario.valor_bruto,
				secretario.abono_permanencia,
				secretario.redutor_constitucional,
				secretario.contribuicao_previdenciaria,
				secretario.imposto_renda,
				secretario.valor_liquido,
				secretario.valor_diarias,
				secretario.valor_auxilios,
				secretario.valor_vantagens,
				secretario.valor_outros
			];
			let sqlInsertSecretario =
				"insert into cf_secretario_remuneracao_temp " +
				"(id_cf_secretario, referencia, descricao, remuneracao_fixa, vantagens_natureza_pessoal, funcao_ou_cargo_em_comissao, gratificacao_natalina, ferias, outras_remuneracoes, valor_bruto, abono_permanencia, redutor_constitucional, contribuicao_previdenciaria, imposto_renda, valor_liquido, valor_diarias, valor_auxilios, valor_vantagens, valor_outros) " +
				"values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
			pool.query(sqlInsertSecretario, sqlParams, function (error, results, fields) {
				if (error) {
					if(error.code !== 'ER_DUP_ENTRY'){
						console.log(options.uri);
						throw error;
					}else{
						console.log('Duplicado ' + options.chave + ' - ' + secretario.referencia + '  - ' + secretario.descricao);
					}
				}else{
					console.log('Inserido ' + options.chave + ' - ' + secretario.referencia + '  - ' + secretario.descricao);
				}
		
				if(length == i+1){
					done();
				}
			});
		}
	} else {
		console.log("Sem dados: " + options.uri);
		done();
		return;
	}
};

var crawler = new Crawler({
	rateLimit: 50,
    maxConnections: 1,
    rotateUA: true,
	callback: function (error, res, done) {
		if (error) {
			console.log(error);
			done();
		} else if (res.statusCode == 200) {
			console.log(res.options.passo + ' - ' +res.options.uri);
			var $ = res.$;

			if (res.options.passo == 'secretario-ano') {
				secretarioAno($, res.options, done);
			} else if (res.options.passo == 'secretario-ano-mes') {
				secretarioAnoMes($, res.options,  done);
			} else if (res.options.passo == 'secretario-remuneracao') {
				remuneracao($, res.options, done);
			}else{
				console.log(res.options.uri);
				console.log('Sem ação definida!');
				done();
			}
		} else {
			console.log(res.options.uri);
			console.log(res.statusCode + res.statusMessage);
			done();
		}
	}
});
crawler.on('request', function (options) {
	//console.log('Request:' + options.uri);
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
var sqlSecretarios = "SELECT distinct link as chave FROM ops.cf_secretario order by link";
pool.query(sqlSecretarios, function (error, results, fields) {
	if (error) throw error;

	for (let index = 0; index < results.length; index++) {
		const row = results[index];

		crawler.queue({
			priority: 5,
			uri: 'https://www.camara.leg.br/transparencia/recursos-humanos/remuneracao/' + row['chave'],
			chave: row['chave'],
			passo: 'secretario-ano'
		});

		// console.log('0 - https://www.camara.leg.br/transparencia/recursos-humanos/remuneracao/' + row['chave']);
	}
});
