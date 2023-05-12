const axios = require('axios');
const readline = require('readline');
const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config();

const natural = require('natural');
const tokenizer = new natural.WordTokenizer();
const stemmer = natural.PorterStemmer;

const apiKey = process.env.OPENAI_API_KEY
const orgId = process.env.OPENAI_ORG_ID

const model = "gpt-3.5-turbo";

async function askGPT(prompt, temperature, maxTokens) {

    const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
            "model": `${model}`,
            "messages": [{
                "role": "user", "content": `${prompt}`
            }],
            "temperature": temperature,
            "max_tokens": maxTokens,
        },

        {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                organization: `${orgId}`,
                'Content-Type': 'application/json',
            },
        }
    );

    const gptresponse = response.data.choices[0].message.content

    return gptresponse;
}

async function main() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    function promptForImprovements(filePath) {
        rl.question('What would you like me to do with this code? (\x1b[93m1\x1b[0m: Refactor, \x1b[93m2\x1b[0m: Optimize, \x1b[93m3\x1b[0m: Improve, \x1b[93m4\x1b[0m: All) ', (input) => {
            if (!isNaN(input)) {
                const improvements = parseInt(input);

                if (improvements >= 1 && improvements <= 4) {

                    rl.question('Would you like to recursively update this code? (Y/N) ', (answer) => {
                        if (answer.toLowerCase() === ('y')) {
                            answer = true;

                            rl.close();

                            getCode(filePath, input, answer);

                        } else if (answer.toLowerCase() === ('n')) {
                            answer = false;

                            rl.close();

                            getCode(filePath, input, answer);
                        } else {
                            console.log('\x1b[31m%s\x1b[0m', `Invalid input. Please input Y for yes or N for no.\x1b[0m`);
                            promptForImprovements(filePath);
                        }
                    });
                } else {
                    console.log('\x1b[31m%s\x1b[0m', `Invalid input. Please enter a number between \x1b[93m1\x1b[0m \x1b[31mand\x1b[0m \x1b[93m4\x1b[0m\x1b[31m.\x1b[0m`);
                    promptForImprovements(filePath);
                }
            } else {
                console.log('\x1b[31m%s\x1b[0m', 'Invalid input. Please enter a number.');
                promptForImprovements(filePath);
            }
        });
    }

    rl.question('\x1b[34mWhat is the file path for the code you want to improve? \x1b[0m', (filePath) => {
        promptForImprovements(filePath);
    });

    async function getCode(filePath, input, mode) {
        fs.readFile(filePath, 'utf8', async (err, data) => {
            if (err) {
                console.error(err);
            } else {
                // console.log('\x1b[33m%s\x1b[0m \x1b[37m%s\x1b[0m', 'SYSTEM:', 'Compressing Code...');

                let thiscode = data.replace(/[\s\r\n]+/g, "");

                let words = tokenizer.tokenize(thiscode);
                let stemmed = words.map(word => stemmer.stem(word));
                thiscode = stemmed.join('');

                // Determine the code language
                const codeLanguage = await askGPT(`What language is this script in? ONLY PRINT THE LANGUAGE AND NOTHING ELSE. THERE SHOULD BE NO ADDITIONAL CONTEXT WHATSOEVER YOUR RESPONSE SHOULD ONLY BE THE LANGUAGE: \`\`\`${thiscode}\`\`\` `, 0, 25);

                console.log('\x1b[92m%s\x1b[0m \x1b[37m%s\x1b[0m', 'GPT:', 'Code written in', codeLanguage);

                const codePurpose = await askGPT(`Your task is to determine the purpose of the provided code and respond with a brief description of its purpose in four sentences or less while also adding an idea that could improve this code, beginning with "Which is". CODE: \`\`\`${codeLanguage.replace(/\s/g, "")} ${thiscode}\`\`\` `, 0, 250);

                console.log('\x1b[92m%s\x1b[0m \x1b[37m%s\x1b[0m', 'GPT:', 'Detecting Code Purpose...');

                // console.log(codePurpose);

                updateCode(filePath, codeLanguage, codePurpose, input, mode);

            }
        });
    }

    async function updateCode(filePath, codeLanguage, codePurpose, input, mode) {
        fs.readFile(filePath, 'utf8', async (err, data) => {
            if (err) {
                console.error(err);
            } else {

                console.log('\x1b[33m%s\x1b[0m \x1b[37m%s\x1b[0m', 'SYSTEM:', 'Compressing Code...');

                let thiscode = data.replace(/[\s\r\n]+/g, "");

                let words = tokenizer.tokenize(thiscode);
                let stemmed = words.map(word => stemmer.stem(word));
                thiscode = stemmed.join('');

                let inputtype = 'Improve, Refactor, and Optimize';

                switch (input) {
                    case '1':
                        inputtype = 'Refactor';
                        break;
                    case '2':
                        inputtype = 'Optimize';
                        break;
                    case '3':
                        inputtype = 'Improve';
                        break;
                    default:
                        break;
                }

                console.log('\x1b[92m%s\x1b[0m \x1b[37m%s\x1b[0m', 'GPT:', `I Will ${inputtype} The Code... (This may take awhile)`);

                // Generate improved code
                const codeBotPrompt = `As ${codeLanguage} Code Bot, your primary task is to ${inputtype} existing ${codeLanguage} code while preserving its original Purpose and also not changing things that already work, ${codePurpose}. If you determine that the code doesnt need to be improved further respond with exactly: "IMPROVEDMAX" and nothing more. However, if you can identify areas where the code can be ${inputtype}, please provide only the full code without any additional context. Your ultimate goal is to make the code more efficient and maintainable while making sure everthing will still be functional and work as intended. You have been given the following code to improve: \`\`\`${codeLanguage} ${thiscode} \`\`\` After updating the code, output the complete code."`;  //Finally, please include a list of short changes made at the end of your response exactly like so surrounded by 3 asterisks: "***newchanges: list of changes here***
                const improvedCode = await askGPT(`${codeBotPrompt}`, 0, 2048);

                let code = improvedCode.match(/```(?:[^\r\n]+)?\r?\n([\s\S]+?)\r?\n```|^`{3}([\s\S]+?)`{3}$/m);
                code = code ? (code[1] || code[2]) : improvedCode;

                console.log(improvedCode);

                if (improvedCode.includes('IMPROVEDMAX')) {
                    console.log('\x1b[92m%s\x1b[0m \x1b[37m%s\x1b[0m', 'GPT:', `Code cannot be improved any further.`);
                    return;
                }

                if (mode) {
                    saveCode();
                } else {
                    const newrl = readline.createInterface({
                        input: process.stdin,
                        output: process.stdout
                    });

                    askToSave(newrl, filePath);
                }

                function askToSave(newrl, filePath) {
                    newrl.question('\x1b[34mWould you like me to save the updated code to the file path? (Y/N) \x1b[0m', (response) => {
                        if (response.toUpperCase() === 'Y') {
                            console.log('Saving updated code to file path...');
                            saveCode();
                            newrl.close();
                            rl.close();
                        } else if (response.toUpperCase() === 'N') {
                            console.log('Exiting without saving...');
                            newrl.close();
                            rl.close();
                        } else {
                            console.log('\x1b[31m%s\x1b[0m', 'Invalid input. Please enter either Y or N. (Y for Yes, N for No) ');
                            askToSave(newrl, filePath);
                        }
                    });
                }

                function saveCode() {
                    fs.writeFile(filePath, code, (err) => {
                        if (err) {
                            console.error(err);
                        } else {
                            console.log('\x1b[33m%s\x1b[0m \x1b[92m%s\x1b[0m', 'SYSTEM:', 'The file has been saved with the improved code!');

                            if (mode) {
                                updateCode(filePath);
                            }
                        }
                    });
                }

            }
        });
    }
}

main();

