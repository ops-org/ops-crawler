var app = require('express')();
var http = require('http').Server(app);
var httpCrawler = require('http');
var io = require('socket.io')(http);
var port = process.env.PORT || 3000;
var strAlgo = "";
/***************************  Socket.io     ************************************/
/*******************************************************************************/
app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html');
});

app.get('/NaoEncontrados', function(req, res)
{
  res.send(JSON.stringify(lst_NomesErrados));  
});

app.get('/GerarBancoDados', function(req, res)
{
  var pg = require('pg');
  var conString = "postgres://rkyunvrvpmiyvf:bKpzxr3AhVgDkn2905wskCb7C0@ec2-50-19-117-114.compute-1.amazonaws.com:5432/dd9ctlbhfv6pr9";
  var client = new pg.Client(conString);
  client.connect();
  
   var query = client.query("SELECT * FROM INFORMATION_SCHEMA.TABLES");
   
    query.on('row', function(row)
    {
	strAlgo += row;       	
    });

    query.on('end', function()
    {
	client.end();	
	res.send(strAlgo);          
    });    
});

app.get('/Secretarios', function(req, res)
{
  res.send(JSON.stringify(lst_Secretarios));  
});

app.get('/Parlamentares', function(req, res)
{
  res.send(JSON.stringify(lst_Parlamentares));  
});

io.on('connection', function(socket){
  socket.on('chat message', function(etapaAtual)
  {	
		mediadorCrawler(etapaAtual);	       
  });
});

http.listen(port, function(){
  console.log('listening on *:'+ port);
});

function comunicaAoCliente(msg)
{
	io.emit('chat message', msg);
} 
/********************** Funções HTTP *************************************/
function requisicaoServidor(url,listaAnalise,callback)
{
	httpCrawler.get(url, function(res)
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
/***************************** Específicas do Crawler *****************************/
var listaAnalise; 
var contador = 0;
var vs_URL; 
var lst_Parlamentares = [];
var lst_Sec = []; 
var lst_NomesErrados = []; 
var cheerio = require("cheerio");
function mediadorCrawler(etapa)
{
	console.log(etapa); 
	if(etapa == "etapa0")
	{
		buscaListaParlamentares();	
	}
	if(etapa == "etapa1")
	{
		comparaNomesComValorLotacao();
	}		
	if(etapa == "etapa2")
	{
		listaAnalise = lst_Sec;
		contador = 0; 
		analisaSecretarios();		
	}
} 
function buscaListaParlamentares()
{ 	
	vs_URL = "http://www2.camara.leg.br/transparencia/sispush/indexAtuacao";				
	listaAnalise = lst_Parlamentares;
	comunicaAoCliente("Buscando valor de Parlamentares e Secretarios");
	requisicaoServidor(vs_URL,listaAnalise,function(data)
	{				
		// Se for a primeira execução grava uma lista com os parlamentares disponíveis							
		comunicaAoCliente("criando a lista sem o valor de lotacao...");
		gravaParlamentares(data);		
	});	
}
function gravaParlamentares(dadosHTML)
{	
	$ = cheerio.load(dadosHTML);		
	$('select > option').each(function()
	{	
		if($(this).text() !== 'Escolha o deputado')
		{
			lst_Parlamentares.push({nome:$(this).text() , ideCadastro: $(this).val().split('!')[1]});				
		}
	});	
	comunicaAoCliente('Lista de parlamentares carregada');	
	comunicaAoCliente('proxima');	
}
function comparaNomesComValorLotacao()
{
	requisicaoServidor("http://www2.camara.leg.br/transparencia/recursos-humanos/quadro-remuneratorio/consulta-secretarios-parlamentares/layouts_transpar_quadroremuner_consultaSecretariosParlamentares",listaAnalise,function(data)
	{			
		comunicaAoCliente('Atualizando a lotacao de secretarios...');
		atualizaLotacaoSecretarios(data);															
	});	
}
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
				if($(this).text() !== 'Selecione o Deputado')
				{
					lotacao = $(this).val();
					lst_Sec.push({nome:$(this).text() , ideCadastro: parlamentar.ideCadastro , lotacao : lotacao });				
					boolAchouNomeIgual = true; 
				}
			}   
		}			
		if(!boolAchouNomeIgual)
		{				
			lst_NomesErrados.push({ nome:$(this).text(), lotacao:$(this).val()}); 
		}		
		boolAchouNomeIgual = false;
	});			
	contadorNomes = 0;
    comunicaAoCliente('Busca de nomes concluída');	
	comunicaAoCliente('proxima');		
}
/***************************** Analisando os dados dos secretários  *****************************************************************/ 	
var vs_UrlScrap = "http://www2.camara.leg.br/transparencia/recursos-humanos/quadro-remuneratorio/consulta-secretarios-parlamentares/layouts_transpar_quadroremuner_consultaSecretariosParlamentares";
var lst_Secretarios = []; 
var lst_LinkPaginacoes = [];
function analisaSecretarios()
{	
	requisicaoServidor(vs_URL,listaAnalise,function(data)
	{
		vs_URL = vs_UrlScrap + "?lotacao="+ lst_Sec[contador].lotacao;				
		if((parseInt(contador) + 1) < (listaAnalise.length)) 
		{  					
			comunicaAoCliente("Raspando secretarios...Contador:" + contador + " de "+ listaAnalise.length);
			if(contador > 0) 
			   raspaSecretariosTela(data,listaAnalise[contador -1].lotacao,listaAnalise[contador -1].ideCadastro,true);												
			
			contador++;								
			analisaSecretarios();
		}else{					
			if(lst_LinkPaginacoes.length > 0)
			{
				comunicaAoCliente('analisando paginações');			
			    contador = 0; 			
				listaAnalise = lst_LinkPaginacoes;	
				analisaPaginacoes();	
			}else{
				comunicaAoCliente('fim');					
			}  			
		}
	});	
}
/*********************************************************************************************/
function raspaSecretariosTela(dadosHTML,aLotacao,aIdeCadastro, paginacao)
{	 
	$ = cheerio.load(dadosHTML);	
	$("tbody tr").each(function(i, tr)
	{   	 
		var children = $(this).children();
		lst_Secretarios.push(
		                    { numero:children.eq(0).text().trim(),
							   nome:children.eq(1).text().trim().replace("'",""), 
							   orgao:children.eq(2).text().trim(),
							   data: children.eq(3).text(), 
							   ideCadastro : aIdeCadastro
							});									 
		comunicaAoCliente('Contador' + contador +' - Secretario: '+ children.eq(1).text().trim().replace("'","") + ' ideCadastro:'+ aIdeCadastro);					 
	});				
	if(paginacao)
	{ 
		procuraPaginacao(dadosHTML,aLotacao,aIdeCadastro);
		comunicaAoCliente("Buscando paginacao..."); 
    }else{							 
		if((parseInt(contador) + 1) < (listaAnalise.length))
		{			
			contador++;
			analisaPaginacoes(contador);			
		}else{
			comunicaAoCliente('fim');	
		} 		
	} 	
}
function procuraPaginacao(dadosHTML,aLotacao,aIdeCadastro)
{
	$ = cheerio.load(dadosHTML);
	// Verifica se há paginação 
	$('ul[class="pagination"] li').each(function(i, tr)
	{
		var children = $(this).children();						
		if(i == 1)
		{  							
			lst_LinkPaginacoes.push({ valorURL:children.attr('href'), lotacao: aLotacao, ideCadastro:aIdeCadastro});															
		}
	});		
}   
function analisaPaginacoes()
{
	vs_URL =  listaAnalise[contador].valorURL;	
	requisicaoServidor(vs_URL,listaAnalise,function(data)
	{
		console.log("Raspando paginação" + contador +" de " + listaAnalise.length); 		
		raspaSecretariosTela(data,listaAnalise[contador].lotacao,listaAnalise[contador].ideCadastro,false);					
	});
} 
