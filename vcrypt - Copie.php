<?php

//echo ord("A");
//echo chr(65);
//echo hexdec("F");


class vcrypt
{
    protected function postCrypt ($process)
    {
        $options = $this->argv;
        $keys = $this->getKeys(); //<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<

        $inputs = $this->getInputs();
        $texts = $this->getTexts();
        $outputs = $this->getOutputs();
        $outIndex = 0;
        $outputContent = null;

        // Regroupement en array pour unifier le process de cryptage
        $sources = [
            // Fichiers en premiers
            "file" => $inputs,
            // Texts en second lieux
            "text" => $texts
        ];

        // Traiter toutes les sources
        foreach ($sources as $type => $typeSources) {
            foreach ($typeSources as $idxt => $source) {
                $inputContent = null;

                // Récupération du contenu à crypter
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
                    case 'text':
                        $inputContent = $source;
                        break;
                }

                // Chiffrage du contenu (avec RAZ de la variable)
                $outputContent = null;

                foreach ($keys as $idx => $key) {
                    // Si $outputContent n'est pas null
                    // On est dans une étape de surchiffrage
                    // l'inputContent doit être celui de l'outputContent
                    // Remize à zéro de l'output content
                    if ($outputContent !== null) {
                        $inputContent = $outputContent;
                        $outputContent = null;
                    }

                    $keyLen = strlen($key);
                    $textLen = strlen($inputContent);

                    for ($p = 0; $p < $textLen; $p++) {
                        $kp = $p % $keyLen;
                        $outputContent .= chr(ord($inputContent[$p]) + ( $factor * ord($key[$kp])));
                    }
                }

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

    protected function getOpts (Array $opts)
    {
        $outputArray = [];

        foreach ($opts as $idx => $opt) {
            if ($this->isOption([$opt])) $this->optToArray($this->argv, $opt, $outputArray);
        }

        return $outputArray;
    }

    protected function optToArray ($optpool, $name, &$array)
    {
        // Est-ce que l'option existe
        if (isset($optpool[$name])) {
            if (is_array($optpool[$name])) {
                $array = array_merge($array, $optpool[$name]);
            } else {
                $array = array_merge($array, [$optpool[$name]]);
            }
            return true;
        } else {
            return false;
        }
    }

    /**
     * Regroupe les matches au sein du même tableau au lieu du regroupement par défaut.
     *
     * @param array $array Référence à inverser.
     *
     * @return bool
     */
    protected function preg_match_reverse_grouping (Array &$array)
    {
        if (!count($array)) return false;

        if (!is_array($array[0]) || !count($array[0])) return false;

        $matches = count($array);
        $reversed = [];

        foreach ($array[0] as $index => $match) {
            $instance = [];
            $instance[0] = $match;

            for ($i = 1; $i < $matches; $i++) {
                $instance[$i] = $array[$i][$index];
            }

            $reversed[$index] = $instance;
        }

        $array = $reversed;

        return true;
    }


}
