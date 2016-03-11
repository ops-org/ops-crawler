var contador = 0;
var contEtapas = 1;
var vs_UrlScrap = "http://www2.camara.leg.br/transparencia/recursos-humanos/quadro-remuneratorio/consulta-secretarios-parlamentares/layouts_transpar_quadroremuner_consultaSecretariosParlamentares";
var http = require('http');
var url = require('url');
var cheerio = require("cheerio");
var lst_Parlamentares = [];
var lst_Secretarios = [];
var lst_LinkPaginacoes = []; 
var listaAnalise;  
var parlamentar;  
var secretario; 
var vs_URL; 
var queryData; 
var etapa; 
var options = null;		
var xRequest = null; 	
/*********************************************************************************************/
function gravaParlamentares(dadosHTML)
{
	$ = cheerio.load(dadosHTML);
	$('select > option').each(function()
	{	 
		lst_Parlamentares.push({nome:$(this).text() , lotacao: $(this).val() });				
	});	
}  
/*********************************************************************************************/
function raspaSecretariosTela(dadosHTML,aLotacao)
{
	$ = cheerio.load(dadosHTML);
	$('tr').each(function(i, tr)
	{
        var children = $(this).children();
        lst_Secretarios.push({ numero:children.eq(0).text().trim(),
							   nome:children.eq(1).text().trim().replace("'",""), 
							   orgao:children.eq(2).text().trim(),
							   data: children.eq(3).text(), 
							   lotacao : aLotacao});				
		console.log("-----------------------------------------------------------"); 					   
		console.log("Secretario:" + children.eq(1).text().trim().replace("'","") + 
		            "Lotacao:" +  aLotacao); 					   		
    });	
	if(etapa < 3)
	{
		procuraPaginacao(dadosHTML,aLotacao);
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
				   + secretario.numero  +"','"+ secretario.nome +"','" + secretario.orgao +"','"+ secretario.data +"','"+ secretario.lotacao +"');";  			            
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
function procuraPaginacao(dadosHTML,aLotacao)
{
	/*********************************************************************************************/
	$ = cheerio.load(dadosHTML);
	// Verifica se há paginação 
	$('ul[class="pagination"] li').each(function(i, tr)
	{
		var children = $(this).children();						
		if(i == 1)
		{  							
			lst_LinkPaginacoes.push({ valorURL:children.attr('href'), lotacao: aLotacao });	
			console.log("--------------------------------------");				
			console.log("Paginacao adicionada");							
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
	queryData = url.parse(req.url, true);
	contador = queryData.query["contador"];
	etapa = queryData.query["etapa"];	
	console.log(contador + " - "+ etapa); 	
	// Se for a primeira execução
	if( etapa == 1)
	{ 
		vs_URL = vs_UrlScrap;
		listaAnalise = lst_Parlamentares;
	}
	// Se estiver realizando interação entre os deputados.
	if(etapa == 2)
	{ 
		console.log("Contador"+ contador + " de " + lst_Parlamentares.length); 
		vs_URL = vs_UrlScrap + "?lotacao="+ lst_Parlamentares[contador].lotacao;
		listaAnalise = lst_Parlamentares;		
	}
	// Se estiver realizando a análise das paginações 
	if(etapa == 3)
	{ 
		vs_URL =  lst_LinkPaginacoes[contador].valorURL;
		listaAnalise = lst_LinkPaginacoes;
		console.log("Contador"+ contador + " de " + lst_LinkPaginacoes.length);
	}		
	requisicaoServidor(vs_URL,listaAnalise,function(data)
	{			
		console.log(" Data:"+ data); 
		// Se for a primeira execução grava uma lista com os parlamentares disponíveis
		if(etapa == 1)
		{	
			console.log("gravando parlamentares:" + contador); 
			gravaParlamentares(data);									
			etapa++; 						
			var vs_Parl = ""; 
			for (var k=0; k < lst_Parlamentares.length; k++)
			{
				parlamentar = lst_Parlamentares[k];
				vs_Parl += parlamentar.nome;
				vs_Parl += "\n";				
			}					
			chamaASiProprio(etapa,contador);			
		}else{
			if((parseInt(contador) + 1) < (listaAnalise.length))
			{  
				console.log("Raspando secretários..."); 
				raspaSecretariosTela(data,listaAnalise[contador].lotacao);
				contador++;	
				chamaASiProprio(etapa,contador);
			}else{
				// Se acabaram as etapas e as interações 
				if(etapa < 3)
				{
					contador = 0; 
					etapa++;
					console.log("Buscando paginacoes..."); 					
					chamaASiProprio(etapa,contador);
				}else{
					criaSQLSecretarios();										
				} 
			} 
		} 			
	}); 	 
	res.end("OK"); 
});
console.log('Servidor pronto para guerra...'); 
myserver.listen(6161);

 