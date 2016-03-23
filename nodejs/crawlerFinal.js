/*********************************************************************************************/
var mysql = require("mysql");
var con = mysql.createConnection(
{
  host: "localhost",
  user: "seuUsuario",
  password: "suaSenha",
  database : 'seuDB'
});
// Escopo com o MySQL 
con.connect(function(err)
{
	var contador = 0;
	var contadorNomes = 0; 
	var contadorNaoEncontrados = 0; 
	var contEtapas = 1;
	var vs_UrlScrap = "http://www2.camara.leg.br/transparencia/recursos-humanos/quadro-remuneratorio/consulta-secretarios-parlamentares/layouts_transpar_quadroremuner_consultaSecretariosParlamentares";
	var http = require('http');
	var url = require('url');
	var cheerio = require("cheerio");
	var lst_Parlamentares = [];
	var lst_Secretarios = [];
	var lst_Sec = []; 
	var lst_LinkPaginacoes = []; 
	var lst_NaoEncontrados = []; 
	var listaAnalise;  
	var parlamentar;  
	var secretario; 
	var vs_URL; 
	var queryData; 
	var etapa; 
	var options = null;		
	var xRequest = null; 	
	var lst_NomesErrados = []; 
	if(err)
	{
		console.log('Error connecting to Db');
		return;
	}
	/*********************************************************************************************/
	function gravaParlamentares(dadosHTML)
	{	
		$ = cheerio.load(dadosHTML);		
		$('select > option').each(function()
		{				
			lst_Parlamentares.push({nome:$(this).text() , ideCadastro: $(this).val().split('!')[1]});				
		});				
	}  
	/*********************************************************************************************/
	function atualizaLotacaoSecretarios(dadosHTML)
	{	
		var lotacao = "";
		$ = cheerio.load(dadosHTML);
		var json;  
		var boolAchouNomeIgual = false; 
		$('select > option').each(function()
		{	
			for (var k=0; k < lst_Parlamentares.length; k++)
			{
				parlamentar = lst_Parlamentares[k];			
				if(parlamentar.nome == $(this).text())
				{
					lotacao = $(this).val();
					lst_Sec.push({nome:$(this).text() , ideCadastro: parlamentar.ideCadastro , lotacao : lotacao });				
					boolAchouNomeIgual = true; 
				}   
			}			
			if(!boolAchouNomeIgual)
			{				
				lst_NomesErrados.push({ nome:$(this).text(), lotacao:$(this).val()}); 
			}		
			boolAchouNomeIgual = false;
		});			
		contadorNomes = 0; 
		buscaNoBancoNomeErrado(lst_Sec);
	}  	
	/*********************************************************************************************/
	function buscaNoBancoNomeErrado(aList)
	{			
		var sql = "SELECT ideCadastro FROM parlamentares WHERE txNomeParlamentar like '%"+ lst_NomesErrados[contadorNomes].nome +"%'";						
		con.query(sql,function(err,rows,fields)
		{
			if(err) throw err;						
			
			json = JSON.stringify(rows);																																					
			if(rows[0] == undefined)
			{	
				lst_NaoEncontrados.push({ nome: lst_NomesErrados[contadorNomes].nome, 
										  lotacao : lst_NomesErrados[contadorNomes].lotacao}); 				
			}else{ 				
				aList.push({nome: lst_NomesErrados[contadorNomes].nome, 
				              ideCadastro: JSON.parse(json)[0].ideCadastro, 
						      lotacao : lst_NomesErrados[contadorNomes].lotacao
						     });															
			}
						
			if((contadorNomes  + 1) < lst_NomesErrados.length)
			{
				contadorNomes++; 			
				buscaNoBancoNomeErrado(aList);
			}else{				
				buscaNaoEncontrados(lst_NaoEncontrados,0,aList);				
			} 						  		 								
		});	
				
	} 	
	function buscaNaoEncontrados(aList,aCont,bList)
	{		
		var jsonNaoE = aList[aCont];				
		var vbOcorreuErro = false; 		
		var sql = "SELECT ideCadastro FROM naoencontrados WHERE lotacao ='"+ jsonNaoE.lotacao + "'";				 			
		con.query(sql,function(err,rows,fields)
		{
			if(err) throw err;						
				
			json = JSON.stringify(rows);																																				
			if(rows[0] == undefined)
			{
				console.log('Parlamentares não encontrados:'+ jsonNaoE.nome); 
				vbOcorreuErro = true; 
			}else{
				bList.push({nome: jsonNaoE.nome,ideCadastro: JSON.parse(json)[0].ideCadastro, lotacao : jsonNaoE.lotacao });											
			}  
				
			if((aCont + 1) < aList.length)
			{	
				buscaNaoEncontrados(aList,(parseInt(aCont) + 1),bList);
			}else{
				if(vbOcorreuErro)
				{
					console.log("Ocorrem erros, nao e possivel executar o crawler..."); 
				}else{										
					etapa++; 									
					chamaASiProprio(etapa,contador);												
				}  
			}
		});						 				
	} 	
	/*********************************************************************************************/
	function raspaSecretariosTela(dadosHTML,aLotacao,aIdeCadastro)
	{
		console.log("-----------------------------------------------------------------");		
		$ = cheerio.load(dadosHTML);	
		$('tr').each(function(i, tr)
		{        		
			var children = $(this).children();
			lst_Secretarios.push({ numero:children.eq(0).text().trim(),
								   nome:children.eq(1).text().trim().replace("'",""), 
								   orgao:children.eq(2).text().trim(),
								   data: children.eq(3).text(), 
								   ideCadastro : aIdeCadastro});						
			if(etapa == 3)
			{
				console.log("Nome:" + children.eq(1).text() +  " Ide:" + aIdeCadastro + " Locacao"+ aLotacao);
			}
		});	
		if(etapa < 3)
		{
			console.log("-----------------------------------------------------------------");	
			console.log("Buscando paginacao..."); 
			procuraPaginacao(dadosHTML,aLotacao,aIdeCadastro);
		}else{
			console.log(etapa);		
		} 			
	} 
	/*********************************************************************************************/
	function gravaArquivo(vs_Valor,vs_NomeArquivo)
	{
		var fs = require('fs');
		fs.writeFile(vs_NomeArquivo, vs_Valor, function(err)
		{
			if(err){return console.log(err);}
			console.log("Arquivo!"+ vs_NomeArquivo + " gravado!");
		}); 			
	}
	/*********************************************************************************************/
	function criaSQLSecretarios()
	{
		var vs_SQL = ""; 
		for (var k=0; k < lst_Secretarios.length; k++)
		{		
			secretario = lst_Secretarios[k];
			if(secretario.nome != "Nome")
			{  						
				vs_SQL += "INSERT INTO secretario(numero, nome,orgao, data,deputado) VALUES ('"
					   + secretario.numero  +"','"+ secretario.nome +"','" + secretario.orgao +"','"+ secretario.data +"','"+ secretario.ideCadastro +"');";  			            
				vs_SQL += "\n";		
			}
		}		
		gravaArquivo(vs_SQL,"sqlSecretarios.txt"); 
	} 
	/*********************************************************************************************/
	function requisicaoServidor(url,listaAnalise,callback)
	{
	   http.get(url, function(res)
	   {
			var data = "";
			res.on('data', function (chunk)
			{
				data += chunk;			
			});
			res.on("end", function()
			{			
				callback(data);
			});
		}).on("error", function()
		{        
			callback(null);
		});
	}
	function procuraPaginacao(dadosHTML,aLotacao,aIdeCadastro)
	{
		/*********************************************************************************************/
		$ = cheerio.load(dadosHTML);
		// Verifica se há paginação 
		$('ul[class="pagination"] li').each(function(i, tr)
		{
			var children = $(this).children();						
			if(i == 1)
			{  							
				lst_LinkPaginacoes.push({ valorURL:children.attr('href'), lotacao: aLotacao, ideCadastro:aIdeCadastro});	
				console.log("--------------------------------------");								
				console.log("Paginacao adicionada");							
				console.log(aLotacao + " * " + aIdeCadastro); 
			}
		});		
	} 
	/*********************************************************************************************/
	function chamaASiProprio(contEtapa,aContador)
	{		
		console.log("Chama a si proprio"+ contEtapa); 
		// Começa a realizar a recursividade  			
		options = { host: '127.0.0.1',port: 6161,path:"/?contador="+ contador + "&etapa=" + contEtapa , method: 'GET'}; 			
		xRequest = http.request(options,function(res){	});		
		xRequest.end();				
	}
	/*********************************************************************************************/
	var myserver  = http.createServer(function (req,res)
	{						
		// Sei lá porque o browser faz uma segunda requisição pedindo o ícone  
		if(req.url != "/favicon.ico")
		{	
			queryData = url.parse(req.url, true);
			contador = queryData.query["contador"];
			etapa = queryData.query["etapa"];				
			if(etapa == 1)
			{ 			
				console.log("-----------------------------------------------------------------");
				console.log("Buscando valor de Parlamentares e Secretarios");
				// A página que lista os secretários não possui o id do parlamentar e sim da lotacao dele,
				// é mais recomendavel raspar os parlamentares desta página abaixo.			
				vs_URL = "http://www2.camara.leg.br/transparencia/sispush/indexAtuacao";				
				listaAnalise = lst_Parlamentares;
			}				
			// Se estiver realizando interação entre os deputados.
			if(etapa == 2)
			{ 
				console.log("Contador"+ contador + " de " + lst_Parlamentares.length); 			
				vs_URL = vs_UrlScrap + "?lotacao="+ lst_Sec[contador].lotacao;
				listaAnalise = lst_Sec;		
			}
			// Se estiver realizando a análise das paginações 
			if(etapa == 3)
			{ 
				vs_URL =  lst_LinkPaginacoes[contador].valorURL;
				listaAnalise = lst_LinkPaginacoes;			
			}		
			
			requisicaoServidor(vs_URL,listaAnalise,function(data)
			{				
				// Se for a primeira execução grava uma lista com os parlamentares disponíveis
				if(etapa == 1)
				{					
					console.log("-----------------------------------------------------------------");
					console.log("criando a lista sem o valor de lotacao...");
					gravaParlamentares(data);																																				
					requisicaoServidor("http://www2.camara.leg.br/transparencia/recursos-humanos/quadro-remuneratorio/consulta-secretarios-parlamentares/layouts_transpar_quadroremuner_consultaSecretariosParlamentares",listaAnalise,function(data)
					{	
						console.log("-----------------------------------------------------------------");
						console.log("Atualizando a lotacao...");
						atualizaLotacaoSecretarios(data);															
					});				
				}else{										
					console.log("Contador antes:" + contador); 
					if((parseInt(contador) + 1) < (listaAnalise.length))
					{  					
						console.log("Contador depois:" + contador); 
						console.log("-----------------------------------------------------------------");
						console.log("Raspando secretarios...");
						raspaSecretariosTela(data,listaAnalise[contador].lotacao,listaAnalise[contador].ideCadastro);
						contador++;	
						chamaASiProprio(etapa,contador);
					}else{
						// Se acabaram as etapas e as interações 
						if(etapa < 3)
						{
							contador = 0; 
							etapa++;
							//console.log("Buscando paginacoes..."); 					
							chamaASiProprio(etapa,contador);
						}else{
							criaSQLSecretarios();										
							con.end(function(err)
							{
								console.log('Fim da conexão');
							});	
						} 
					} 
				} 			
			});
		}
		res.end("OK"); 	
	});
	console.log('Servidor pronto para guerra...'); 
	myserver.listen(6161);
});	// Fim do escopo com o Banco de dados.	