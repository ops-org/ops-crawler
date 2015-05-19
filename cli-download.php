<?php

include_once('./simple_html_dom.php');

// Download usando wget, pois se usar PHP direto o agent é detectado e retorna 403 forbidden

$url = 'prop_arvore_tramitacoes?idProposicao=562615';

function getHTML($url, $outputfile){
	$baseURL = 'http://www.camara.gov.br/proposicoesWeb/';
	$url = $baseURL . $url;

	if(file_exists($outputfile)){
		return file_get_contents($outputfile);
	}

	$dir = dirname($outputfile);
	if(!file_exists($dir)){
		mkdir($dir, 0777, true);
	}

	$cmd = "wget -q \"$url\" -O $outputfile";
	exec($cmd);

	// Create DOM from URL or file
	return file_get_contents($outputfile);
}

// Baixa lista de EMCs
$data = getHTML($url, 'files/index.html');

$html = new simple_html_dom();
$html->load($data);

// Find all images
foreach($html->find('.contentFilhas a') as $element) {
	echo 'Página: ' . $element->href . "\n\r";
	flush();

	preg_match('/=(?:.(?!=))+$/', $element->href, $matches);
	$data = getHTML( $element->href, 'files/' . ltrim($matches[0], '=') . '.html');

	$pageHTML = new simple_html_dom();
	$pageHTML->load($data);

	foreach($pageHTML->find('a.linkDownloadTeor') as $link) {
		echo 'Arquivo:' . $link->href . "\n\r";
		flush();
		preg_match('/=(?:.(?!=))+$/', $link->href, $matches);
		getHTML( $link->href, 'files/' . ltrim($matches[0], '=') . '.pdf');
	}
}

