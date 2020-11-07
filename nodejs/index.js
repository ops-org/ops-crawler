var Crawler = require("crawler");
var mysql = require("mysql");

var pool = mysql.createPool({
	connectionLimit: 10,
	host: "localhost",
	port: "13306",
	user: "root",
	password: "",
	database: 'ops'
});

var secretarios = function name($, id_deputado, done) {
	$(".secao-conteudo table tbody tr").each(function (i, tr) {
		var children = $(this).children();

		var secretario = {
			id_deputado: id_deputado,
			nome: children.eq(0).text().trim(),
			cargo: children.eq(2).text().trim(),
			periodo: children.eq(3).text().trim(),
			link_remuneracao: children.eq(4).children().attr('href'),
			em_exercicio: $(this).closest('.table').prev().text().trim().toUpperCase() === 'EM EXERCÍCIO',
		}

		crawler.queue({
			priority: 4,
			uri: secretario.link_remuneracao + '?ano=2020&mes=10',
			passo: 'secretario-remuneracao',
			secretario: secretario
		});
	});

	done();
};

var getValue = function ($tbody, text) {
	return parseFloat($tbody.find('td:contains("' + text + '")').next().text().replace('.', '').replace(',', '.'));
}

var remuneracao = function name($, secretario, done) {
	secretario.valor_bruto = 0;
	secretario.valor_liquido = 0;
	secretario.valor_outros = 0;

	var $tables = $(".remuneracao-funcionario__info");

	if ($tables.length > 0) {
		$tables.each(function (i, tbody) {
			var $tbody = $(tbody);
			if ($tbody.parent().find('thead>tr>th').eq(0).text() == "Descrição") {

				// 1 - Remuneração Básica
				var remuneracao_fixa = getValue($tbody, 'Remuneração Fixa');
				var vantagens_natureza_pessoal = getValue($tbody, 'Vantagens de Natureza Pessoal');

				// 2 - Remuneração Eventual/Provisória
				var funcao_ou_cargo_em_comissao = getValue($tbody, 'Função ou Cargo em Comissão');
				var gratificacao_natalina = getValue($tbody, 'Gratificação Natalina');
				var ferias = getValue($tbody, 'Férias (1/3 Constitucional)');
				var outras_remuneracoes = getValue($tbody, 'Outras Remunerações Eventuais/Provisórias');

				secretario.valor_bruto += remuneracao_fixa + vantagens_natureza_pessoal + funcao_ou_cargo_em_comissao + gratificacao_natalina + ferias + outras_remuneracoes;

				// // 3 - Abono Permanência
				// var abono_permanencia = getValue($tbody, 'Abono Permanência');
				
				// // 4 - Descontos Obrigatórios(-)
				// var redutor_constitucional = getValue($tbody, 'Redutor Constitucional');
				// var contribuicao_previdenciaria = getValue($tbody, 'Contribuição Previdenciária');
				// var imposto_renda = getValue($tbody, 'Imposto de Renda');

				//5 - Remuneração após Descontos Obrigatórios
				secretario.valor_liquido += getValue($tbody, 'Remuneração após Descontos Obrigatórios');

				//6 - Outros
				var valor_diarias = getValue($tbody, 'Diárias');
				var valor_auxilios = getValue($tbody, 'Auxílios');
				var valor_vantagens = getValue($tbody, 'Vantagens Indenizatórias');
				secretario.valor_outros += valor_diarias + valor_auxilios + valor_vantagens;
			}
		});

		// Mês/Ano de Referência/Tipo Folha: 01/2020 -FOLHA NORMAL
		// Mês/Ano de Referência/Tipo Folha: 01/2020 -FOLHA DE ADIANTAMENTO GRATIFICAÇÃO NATALINA
		secretario.referencia = '202010';
	} else {
		secretario.referencia = "Sem dados";
	}

	var sqlParams = [
		secretario.id_deputado,
		secretario.nome,
		secretario.cargo,
		secretario.periodo,
		secretario.valor_bruto,
		secretario.valor_liquido,
		secretario.valor_outros,
		secretario.link_remuneracao.replace('https://www.camara.leg.br/transparencia/recursos-humanos/remuneracao/', ''),
		secretario.referencia,
		secretario.em_exercicio
	];
	var sqlInsertSecretario =
		"insert into cf_secretario_temp_2020 " +
		"(id_cf_deputado, nome, cargo, periodo, valor_bruto, valor_liquido, valor_outros, link, referencia, em_exercicio) " +
		"values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
	pool.query(sqlInsertSecretario, sqlParams, function (error, results, fields) {
		if (error) {
			console.log(secretario.link_remuneracao);
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
				secretarios($, res.options.id_deputado, done);
			} else if (res.options.passo == 'secretario-remuneracao') {
				remuneracao($, res.options.secretario, done);
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
var sqlDeputados = "select id, nome_parlamentar from cf_deputado where situacao = 'Exercício'";
pool.query(sqlDeputados, function (error, results, fields) {
	if (error) throw error;

	for (let index = 0; index < results.length; index++) {
		const row = results[index];

		crawler.queue({
			priority: 5,
			uri: 'https://www.camara.leg.br/deputados/' + row['id'] + '/pessoal-gabinete?ano=2020',
			id_deputado: parseInt(row['id']),
			passo: 'lista-secretario'
		});
	}
});
