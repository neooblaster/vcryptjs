#!/usr/bin/env node

/**
 * vcrypt.js
 *
 * Script CLI de chiffrage de texte.
 *
 * @author    Nicolas DUPRE
 * @release   24.10.2019
 * @version   0.1.0
 *
 */

/**
 * Règles de gestion :
 *
 *    1. Les shortopt sont traités en priorité sur les longopt
 *       Les shortopt et longopt correspondantes sont appended dans le tableau de shortopt
 *
 *
 *    2. Cas des argument(s) d'entrée (text ou fichier) :
 *      Sans fichier(s) de sortie :
 *          -> Flux standard
 *
 *      Avec fichier(s) de sortie n pour n :
 *          -> Dans le fichier de sortie de même index /!\ attention fichier > text /!\
 *
 *      Avec fichier(s) de sortie n pour z :
 *          -> Dans le fichier de sortie de même index /!\ attention fichier > text /!\
 *          -> Le reste dans le flux standard
 *
 *      Note, en cas de fichier en entré introuvable, la sortie
 *      correspondante est ignoré pour ne pas décaller les sorties n pour n ou n pour z.
 *
 *
 *    3. Règle de prioritaire pour entrées combinées :
 *       - Priorité aux fichiers
 *       - Suivis des texts
 *
 *          exemple : -i file1 -t "text1" -i file2 -t "text2" -o for-file1 -o for-file2 -o for-text1 -o for-text2
 *
 *
 *    4. Une seule instruction -c, --crypt ou -d, --decrypt est permise dans la ligne de commande
 *      l'opération -c, --crypt est prioritaire sur -d,--decrypt
 *
 *
 *    5. Le jeu de clés (-k,--key) passés est combinés pour faire le chiffrage/déchiffrage pour les n entrées à crypter
 *
 *
 */


// @TODO : Ajouter un control sur les arguments avec un mode verbeux pour
//         dire que l'argument est specifié, mais qu'il ne respecte pas
//         la configuration spécifiée

/**
 * Chargement des dépendances.
 */
const fs = require('fs');
const sha1 = require('sha1');
const readline = require('readline');
const colors = {
    Reset: "\x1b[0m",
    Bright: "\x1b[1m",
    Dim: "\x1b[2m",
    Underscore: "\x1b[4m",
    Blink: "\x1b[5m",
    Reverse: "\x1b[7m",
    Hidden: "\x1b[8m",
    fg: {
        Black: "\x1b[30m",
        Red: "\x1b[31m",
        Green: "\x1b[32m",
        Yellow: "\x1b[33m",
        Blue: "\x1b[34m",
        Magenta: "\x1b[35m",
        Cyan: "\x1b[36m",
        White: "\x1b[37m",
        Crimson: "\x1b[38m"
    },
    bg: {
        Black: "\x1b[40m",
        Red: "\x1b[41m",
        Green: "\x1b[42m",
        Yellow: "\x1b[43m",
        Blue: "\x1b[44m",
        Magenta: "\x1b[45m",
        Cyan: "\x1b[46m",
        White: "\x1b[47m",
        Crimson: "\x1b[48m"
    }
};
// Caractères individuels (n'accepte pas de valeur)
// Caractères suivis par un deux-points (le paramètre nécessite une valeur)
// Caractères suivis par deux-points (valeur optionnelle)
const options = {
    separator: ",",
    shortopt: "hi:o:cdt:k:s",
    longopt: [
        "help",
        "in-source:",
        "out-source:",
        "crypt",
        "decrypt",
        "text:",
        "keys:",
        "silent",
    ],
};



/**
 * Déclaration des variables globales.
 */
let PWD = process.env.PWD;
let IFILE = null;
let OFILE = null;
let SHOWHELP = true;



/**
 * Déclaration des fonctions.
 */

/**
 * Traiter les arguments passé au programme
 *
 * @param shortopt  Définition des options courtes.
 * @param longopt   Définition des options longues.
 * @returns {{}}    Options parsées.
 */
function getopt(shortopt, longopt = []) {
    checkShortopt(shortopt);

    let processedArg = 0;
    let implicitArg = 1;
    let procOptions = {};  // .optarg, .opt, .optval
    let runWithoutError = true;

    process.argv.forEach(function(arg) {
        processedArg++;

        // Skip Interpreter (node.exe) and it self (mdmerge.js)
        if (processedArg < 3) return;


        // Check if it is a explicit argument (longopt).
        if (/^--/.test(arg)) {
            let splitOpt = arg.match(/^--([a-zA-Z0-9._-]+)=?(.*)/);
            if (!splitOpt) return;
            let opt = splitOpt[1];
            let optVal = splitOpt[2];

            for(let i = 0; i < longopt.length; i++) {
                let lgOpt = longopt[i].match(/([a-zA-Z0-9._-]+)(:*)/);
                let lgOptName = lgOpt[1];
                let lgOptConfig = lgOpt[2];

                if (opt === lgOptName) {
                    if (lgOptConfig === ':' && !optVal) {
                        log(`Option %s require a value`, 1, [opt]);
                        runWithoutError = false;
                    }

                    if (procOptions[opt]) {
                        procOptions = appendOption(procOptions, arg, opt, optVal);
                    } else {
                        procOptions[opt] = createOption(arg, opt, optVal);
                    }
                }
            }
        }

        // Check if it is a explicit argument (shortopt).
        else if (/^-/.test(arg)) {
            let opt = arg.substr(1, 1);
            let optIdx = shortopt.indexOf(opt);
            let optVal = arg.match(/^-(.+)=(.*)/);
            if (optVal) optVal = optVal[2];

            if (optIdx < 0 ) return;

            let nextOptChar1 = shortopt.substr(optIdx +1, 1);
            let nextOptChar2 = shortopt.substr(optIdx +2, 1);

            if (nextOptChar1 === ':' && nextOptChar2 !== ':' && !optVal) {
                log(`Option %s require a value`, 1, [opt]);
                runWithoutError = false;
            }

            if (procOptions[opt]) {
                procOptions = appendOption(procOptions, arg, opt, optVal);
            } else {
                procOptions[opt] = createOption(arg, opt, optVal);
            }
        }

        // This is an implicit argument.
        else {
            switch (implicitArg) {
                // First implicit goes to Input File IFILE.
                case 1:
                    IFILE = arg;
                    break;
                // Second implicit goes to Output File OFILE.
                case 2:
                    OFILE = arg;
                    break;
            }

            implicitArg++;
        }
    });

    if (runWithoutError) {
        return procOptions;
    } else {
        process.exit();
    }
}

// @TODO validation de la chaine shortopt pour limiter les doublons
function checkShortopt () {

}

/**
 *  Créer une option parsée pour utilisation ultérieure.
 *
 * @param optarg    Option d'origine passée en argument.
 * @param opt       Option isolée.
 * @param optval    Valeur de l'option.
 *
 * @returns {{optarg: *, opt: *, optval: *}}
 */
function createOption(optarg, opt, optval) {
    return {
        "arg": optarg,
        "opt": opt,
        "val": optval
    };
}

/**
 * Aggregate value under a option when user use multiple times the same options.
 *
 * @param {Object}  optstack
 * @param {String}  optagr     Entered option (short or long)
 * @param {String}  opt        Option Name
 * @param {String}  optval     Option Value
 *
 * @returns {Array}  Return aggregated value for the option.
 */
function appendOption(optstack, optagr, opt, optval) {
    if (!(optstack[opt].val instanceof Array)) {
        optstack[opt].val = [optstack[opt].val];
    }

    optstack[opt].val.push(optval);

    return optstack;
}

/**
 * Afficher un message dans le stream.
 *
 * @param message Message à afficher.
 * @param level   Niveau de message. 0=OK,1=KO,2=WARN.
 * @param args    Arguments which will replace placeholder in message.
 */
function log(message, level = 0, args = []){
    // 0 = Success
    // 1 = Error
    // 2 = Warn
    // 3 = Info
    let levels = [
        {color: "Green", name: "SUCCESS", return: 0},
        {color: "Red", name: "ERROR", return: 1},
        {color: "Yellow", name: "WARNING", return: 0},
        {color: "Cyan", name: "INFO", return: 0},
    ];

    // Replace Placeholders.
    let argi = 0;
    args.map(function (arg) {
        argi++;
        arg = colors.fg.Yellow + arg + colors.Reset;
        if (/%[1-9]+\$s/.test(message)) {
            let regexp = new RegExp(`%${argi}\\$s`);
            message = message.replace(regexp, arg)
        } else {
            message = message.replace(/%s/, arg);
        }
    });

    console.log(
        "[ " +
        colors.fg[levels[level].color] +
        levels[level].name +
        colors.Reset +
        " ] : " +
        message
    );

    return levels[level].return;
}

/**
 * Vérifie si le fichier demandé existe.
 *
 * @param path   Emplacement du fichier à contrôller.
 * @param level  Niveau d'erreur à retourner en cas d'échec.
 *
 * @returns {boolean}
 */
function fileExists(path, level) {
    try {
        fs.accessSync(path, fs.constants.F_OK | fs.constants.W_OK, (err) => {
            if (err) {
                throw err;
            }
        });

        return true;
    } catch(err) {
        log(err, level);
        process.exit();
    }
}

/**
 * Get the file content of the provided file path.
 *
 * @param {String}   file Path to the file we want to get the content.
 *
 * @return {String}  File content
 */
function getFileContent (file) {
    return fs.readFileSync(file, 'utf-8');
}

/**
 * Affiche le manuel d'aide.
 *
 * @param {Number} level  If we display the help next to an invalid command.
 *
 * @return void
 */
function help(level = 0) {
    let name = 'vcryptjs';
    let helpText = `
Usage : ${name} [OPTIONS]

Description here

-h, --help      Display this text.
-o, --out-file  Write in this out-file.
-c, --crypt     Crypt the input.
-d, --decrypt   Uncrypt the input.
-i, --in-file   Input file to (un)crypt.
-t, --text      Input text to (un)crypt.
-k, --keys      Input one or more key to encrypt your input.
                Use separator: ${options.separator}
-s, --silent    Hide INFO message

Details :

  1. Short options have the priority on long options although they are not skipped.
     E.g.: --keys 123 -k 456 (meaning two encryptions are made)
     Key 456 will be used first, then 123 will be used after.
  
  2. Combined sources :
     Files are processed before texts
     E.g.: --in-source file1 -t text1 -i file2 --text text2
     will be process in this order
       1. file2
       2. file1
       3. text1
       4. text2     
  
  3. Inputs & Outputs :
     • Without outputs : Results are displayed in STDOUT
     • With n outpus for n inputs : 
        - Results are redirected in corresponding specified outputs
        - /!\\ Don't forget files are processed before texts /!\\
     • With n outputs for z inputs :
        - Results are redirected in corresponding specified outputs
        - Last results are displayed in STDERR
     • /!\\ When a source file failed, the corresponding output is skipped /!\\
     
  4. Only one process can be done at once :
     Crypting (-c,--crypt) have the priority on uncryption (-d, --decrypt).
     
  5. Keys used for encryption must be used in the reverse order to uncryption
     E.g.: -c -k key1 -k key2  ==> -d -k key2 -k key1
    `;

    console.log(helpText);
    if (level) process.exit();
}

/**
 * Vérifie si l'on peu effectuer une opération de chiffrage ou déchiffrage.
 *
 * @return boolean.
 */
function canRun() {
    return (
        isOption(["i", "in-source", "t", "text"])
        && isOption(["k", "keys"])
    );
}

/**
 * Check the option/list of options are provided in the command line.
 *
 * @param {String|Array} opts  Option/List of options
 * @param {String}       op    or|and operator telling if all option are require
 *                             or at least one.
 * @returns {boolean}
 */
function isOption(opts, op = "or") {
    otps = (opts instanceof Array) ? [].push(opts) : opts;

    let returnOp = (op.toLowerCase() !== 'or');

    for (let i = 0; i < opts.length; i++) {
        let opt = opts[i];

        if (OPTS[opt]) {
            if (op.toLowerCase() === 'or') {
                return true;
            }
        } else {
            if (op.toLowerCase() === 'and') {
                return false;
            }
        }
    }

    return returnOp;
}

/**
 * Get all values under a unique list for provided options.
 *
 * @param {Array}  opts   List of options names.
 *
 * @returns {Array} List of values.
 */
function getOpts(opts) {
    let outputArray = [];

    for (let i in opts) {
        let opt = opts[i];

        if (isOption([opt])) {
            outputArray = optToArray(OPTS, opt, outputArray);
        }
    }

    return outputArray;
}

/**
 * Get all entered input files.
 *
 * @returns {Array}  List of input files.
 */
function getInputs() {
    return getOpts(['i', 'in-source']);
}

/**
 * Get all entered output files.
 *
 * @returns {Array}  List of output files.
 */
function getOutpus() {
    return getOpts(['o', 'out-source']);
}

/**
 * Get all entered texts.
 *
 * @returns {Array} List of texts to crypt.
 */
function getTexts() {
    return getOpts(['t', 'text']);
}

/**
 * Aggregate values of specified options to list of value (merge shortopt and longopt)
 *
 * @param {Array}  optpool       Program options data.
 * @param {String} name          Name of this option (short or long).
 * @param {Array}  outputArray   Existing data list to aggregate in.
 *
 * @returns {Array}  List of values.
 */
function optToArray(optpool, name, outputArray) {
    if (optpool[name]) {
        if (optpool[name].val instanceof Array) {
            outputArray = outputArray.concat(optpool[name].val);
        } else {
            outputArray = outputArray.concat([optpool[name].val])
        }
    }

    return outputArray;
}

/**
 * Return all differents keys to used to perform crypting.
 *
 * @returns {Array}  List of keys.
 */
function getKeys() {
    // Retrieve entered keys
    let allKeys = [];
    let keys = OPTS['keys'] || OPTS['k'];
    keys = keys.val;

    if (!(keys instanceof Array)) {
        keys = [keys];
    }

    // For unique key where user used comma as separator
    // Split them in different key :
    keys.map(function (key) {
        allKeys = allKeys.concat(key.split(options.separator));
    });

    // Perform crypting on key for further processing.
    keys = allKeys.map(function (key) {
        return sha1(key);
    });

    return keys;
}

/**
 * Request the crypting process.
 */
function crypt () {
    postCrypt('crypt');
}

/**
 * Request the uncrypt process.
 */
function decrypt() {
    postCrypt('decrypt');
}

/**
 * Perform the char processing to crypt/uncrypt.
 *
 * @param process
 */
function postCrypt(process) {
    let factor = 1;
    let outIndex = 0;
    let outputContent = null;
    let message = '';

    switch (process) {
        case 'decrypt':
            factor = -1;
            break;
        case 'crypt':
        default:
            factor = 1;
            break;
    }

    let keys = getKeys();
    let inputs = getInputs();
    let texts = getTexts();
    let outputs = getOutpus();

    // Regroupe kind of input to perform the same process :
    let sources = ['file', 'text'];
    sources['file'] = inputs;
    sources['text'] = texts;

    sources.map(function (sourceType) {
        this[sourceType].map(function (source) {
            let inputContent = null;

            switch (sourceType) {
                case 'file':
                    fileExists(source, 1);
                    inputContent = getFileContent(source);
                    break;
                case 'text':
                    inputContent = source;
                    break;
            }

            // Perform crypting
            outputContent = '';

            keys.map(function (key) {
                // When outputContent is not null,
                // We perform once again a crypting over already crypted content
                // So the inputcontent must be those of outputContent
                // Then reset outputContent
                if (outputContent !== '') {
                    inputContent = outputContent;
                    outputContent = '';
                }

                let keyLen = key.length;
                let textLen = inputContent.length;

                for (p = 0; p < textLen; p++) {
                    let kp = p % keyLen;

                    outputContent += String.fromCharCode(
                        inputContent.charCodeAt(p)
                        + (factor * key.charCodeAt(kp))
                    );
                }
            });


            // Return crypted input in corresponding outputs :
            if (outIndex <= (outputs.length - 1)) {
                let output = outputs[outIndex];
                let outputStream = fs.createWriteStream(output, {});
                outputStream.write(outputContent);
                outIndex++;

                message = (sourceType === 'file') ?
                    `The file %s has been ${process}ed in file %s` :
                    `The text %s has been ${process}ed in file %s` ;

                log(message, 0, [source, output]);
            }
            // If no corresponding in front of this input
            // use standard output stream
            else {
                message = (sourceType === 'file') ?
                    `Please find below the ${process}ed content of file %s :` :
                    `Please find below the ${process}ed result of text %s :` ;

                log(message, 0, [source]);
                console.log(outputContent)
            }
        });
    }.bind(sources));
}





/**
 * Lecture des arguments du script.
 */
let OPTS = getopt(options.shortopt, options.longopt);

// console.log(OPTS);



/**
 * Traitement des options
 */
IFILE = OPTS.in ? OPTS.in.val : OPTS.i ? OPTS.i.val : IFILE;
OFILE = OPTS.out ? OPTS.out.val : OPTS.o ? OPTS.o.val : OFILE;

if (OPTS.w || OPTS.write) {
    OFILE = IFILE;
}


/**
 * Traitement en fonction des options
 */
// Afficher l'aide si demandée
if (OPTS.h || OPTS.help) {
    help();
    return true;
}

// Effectuer l'opération de chiffrage.
if (OPTS.c || OPTS.crypt) {
    if (!canRun()) {
        log("Missing option %s and/or %s and %s", 1, ["-i", "-t", "-k"]);
        return false
    }
    crypt();
    return true;
}

// Effectuer l'opération de chiffrage.
if (OPTS.d || OPTS.decrypt) {
    if (!canRun()) {
        log("Missing option %s and/or %s and %s.", 1, ["-i", "-t", "-k"]);
        return false;
    }
    decrypt();
    return true;
}

// Si demandé
if (SHOWHELP) {
    help();
    return true;
}





































//
// /**
//  * Vérifier qu'on à spécifier un fichier à traiter
//  */
// if (!IFILE) {
//     log("No specified file to process", 1);
//     return false;
// }
//
//
// /**
//  * Vérification de l'existance du fichier.
//  */
// //fileExists(IFILE, 1);
//
//
// /**
//  * Création d'un fichier temporaire
//  */
// let TMP_FILE = `${IFILE}.tmp`;
// let tmpFile = fs.createWriteStream(TMP_FILE, {});
//
//
// /**
//  * Traitement en fonction des options
//  */
// CLEAR = OPTS.clear ? true : !!OPTS.c;
//
// // Traitement du fichier
// //readFile(IFILE, '', tmpFile, CLEAR);
//
//
// /**
//  * Mise à jour du fichier
//  */
// Si le fichier de sortie n'est pas spécifié,
// Utiliser <FILE>.merged.md par défaut
// if (!OFILE) {
//     OFILE = IFILE;
//     OFILE = OFILE.replace(/\.md$/, '.merged.md');
// }
// fs.rename(TMP_FILE, OFILE, function(err) {
//     if (err) throw err;
// });
