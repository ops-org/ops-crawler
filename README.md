# ops-crawler

Diretório para serem armazenados os crawlers que forem sendo criados pela OPS. 
A sugestão é separar os crawlers por linguagens de criação. A descrição dos mesmos segue abaixo: 

1 - Php 

Responsável por baixar todos PDFs das proposições disponíveis no site [camara.org.br](http://www.camara.gov.br/proposicoesWeb/prop_arvore_tramitacoes?idProposicao=562615).

Para executá-lo, simplesmente execute: php download.php

2 - NodeJs 

Responsável por fazer a busca de Secretários Parlamentares por Lotação. Disponíveis no site: 
http://www2.camara.leg.br/transparencia/recursos-humanos/quadro-remuneratorio/consulta-secretarios-parlamentares/layouts_transpar_quadroremuner_consultaSecretariosParlamentares

Para executá-lo, você precisa instalar o nodejs na sua máquina, executar o comando node crawlerFinal e acessar o endereço: http://127.0.0.1:6161/?contador=0&etapa=1 no seu browser  
