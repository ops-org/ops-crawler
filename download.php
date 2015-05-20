<?php

    set_time_limit(0);

    require_once "vendor/autoload.php";

    // Carrega uma URL.
    function getUrl($url, $cacheAs) {
        if(is_file($cacheAs)) {
            return file_get_contents($cacheAs);
        }

        // Obtém o arquivo.
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_USERAGENT, "Mozilla/5.0");

        $data = curl_exec($ch);
        curl_close($ch);

        if($cacheAs) {
            file_put_contents($cacheAs, $data);
        }

        return $data;
    }

    // Configurações.
    $base_url            = "http://www.camara.gov.br/proposicoesWeb/";
    $proposition_postfix = "prop_arvore_tramitacoes?idProposicao=562615";
    $page_postfix        = "fichadetramitacao?idProposicao=";
    $download_postfix    = "prop_mostrarintegra?codteor=";

    print("\nCarregando lista de proposicoes.\n");

    // Obtém a URL.
    $proposition_data = getUrl($base_url . $proposition_postfix, "cache/index.html");

    // Carrega o documento.
    $proposition_doc = phpQuery::newDocumentHTML($proposition_data);
    $proposition_pages = $proposition_doc->find(".contentFilhas a");

    print("-> Encontramos " . count($proposition_pages) . " proposicoes.\n\n");

    // Baixando arquivos.
    print("Baixando arquivos de proposicoes.\n");
    foreach($proposition_pages as $proposition_page) {
        preg_match("/idProposicao=(\d+)/", $proposition_page->getAttribute("href"), $page_match);

        if($page_match
        && array_key_exists(1, $page_match)) {
            // Carrega a página.
            $page_id   = $page_match[1];
            $page_data = getUrl($base_url . $page_postfix . $page_id, "cache/page{$page_id}.html");

            // Carrega a página.
            $page_doc = phpQuery::newDocumentHTML($page_data);

            // Nome da preposição.
            $procedure_name = $page_doc->find(".nomeProposicao")->text();
            $procedure_name = str_replace(" MPV59512", null, $procedure_name);
            $procedure_name = str_replace(" => MPV 595/2012", null, $procedure_name);
            $procedure_name = str_replace("/", "-", $procedure_name);

            // Caminho da preposição.
            $procedure_path_base = "files/" . $procedure_name . " arquivo ";

            // Tramitações.
            $procedure_container = $page_doc->find("#tramitacoes");
            if($procedure_container) {
                // Verifica cada linha de tramitação.
                $procedure_items = $procedure_container->find("tr");
                foreach($procedure_items as $procedure_item) {
                    // Encontra a data da tramitação.
                    $procedure_item_date = pq($procedure_item)->find("td")->eq(0)->text();
                    if($procedure_item_date) {
                        $procedure_path = $procedure_path_base . str_replace("/", "-", $procedure_item_date);

                        // Verifica se ela possui links.
                        // Ignora duplicatas.
                        $procedure_item_links = [];
                        $procedure_item_links_href = [];
                        foreach(pq($procedure_item)->find(".linkDownloadTeor") as $procedure_item_link) {
                            $procedure_item_link_href = $procedure_item_link->getAttribute("href");
                            if(!in_array($procedure_item_link_href, $procedure_item_links_href)) {
                                $procedure_item_links[]      = $procedure_item_link;
                                $procedure_item_links_href[] = $procedure_item_link_href;
                            }
                        }

                        // Inicia o processo em cada link.
                        foreach($procedure_item_links as $key => $procedure_item_link) {
                            $procedure_item_link = pq($procedure_item_link);
                            $procedure_item_path = $procedure_path;

                            // Identifica o código do arquivo.
                            $procedure_item_link_href = $procedure_item_link->get(0)->getAttribute("href");
                            preg_match("/codteor=(\d+)/", $procedure_item_link_href, $procedure_item_link_href_match);

                            // Se houver mais que um PDF, anexa ao nome do arquivo.
                            if(count($procedure_item_links) > 1) {
                                $procedure_item_path.= " anexo " . ( $key + 1 );
                            }

                            // Finaliza o nome do arquivo.
                            // Se o arquivo já existir, ignora.
                            $procedure_item_path.= ".pdf";
                            if(is_file($procedure_item_path)) {
                                continue;
                            }

                            // Caso contrário.
                            print("Baixando arquivo " . basename($procedure_item_path) . "... ");

                            // Inicia o download.
                            $procedure_item_download = $base_url . $download_postfix . $procedure_item_link_href_match[1];
                            getUrl($procedure_item_download, $procedure_item_path);

                            print("OK\n");
                        }
                    }
                }
            }
        }
    }

    print("\nFinalizado.");
