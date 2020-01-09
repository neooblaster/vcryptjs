<?php

class vcrypt
{
    protected function postCrypt ($process)
    {
        // Traiter toutes les sources
        foreach ($sources as $type => $typeSources) {
            foreach ($typeSources as $idxt => $source) {

                // Récupération du contenu à crypter
                //@TODO: TD1
                switch ($type) {
                    case 'file':
                        if (file_exists($source)) {
                            $inputContent = file_get_contents($source);
                            continue;
                        } else {
                            $this->stderr("File %s does not exist", [$source]);
                            // On met à jour l'index des sorties, car on ne peux pas prendre la décision
                            // de tout décaller ce que l'utilisateur avait prévu dans sa commande
                            $outIndex++;
                            continue;
                        }

                        break;
                }

        //<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
                //@TODO : TD2
                // Mettre le contenu dans la sortie correspondante
                if ($outIndex <= count($outputs) - 1) {
                    $output = $outputs[$outIndex];
                    file_put_contents($outputs[$outIndex], $outputContent);
                    $outIndex++;
                    $message = ($type === 'file') ?
                        "The file %s has been ${process}ed in file %s" :
                        "The text %s has been ${process}ed in file %s";
                    $this->stdout($message, [$source, $output]);
                }
                // Si pas de sortie correspondante en face de cet input,
                // Utilisé le flux standard
                else {
                    $message = ($type === 'file') ?
                        "Please find below the ${process}ed content of file %s :" :
                        "Please find below the ${process}ed result of text %s";
                    $this->stdout($message, [$source]);
                    echo $outputContent . PHP_EOL; // Les caractères spéciaux plante vsprintf
                }
            }
        }
    }

}
