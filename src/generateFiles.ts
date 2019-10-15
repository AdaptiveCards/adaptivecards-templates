import * as glob from "glob"
import * as fs from "fs"
import * as path from "path"

export function generate() {


    const knownSamples = [];
    const knownTemplates = {};
    const test =
    {
        "schema.org": {
            "templates": [
                {
                    "file": "Restaunt.json",
                    "fullPath": "schema.org/Restaurant.json"
                }
            ]
        }
    }

    try {
        let templatesDir = path.resolve(__filename, "../../../templates");
        glob.sync("**/*/*.json", { cwd: templatesDir, nocase: false }).map(file => {
            try {
                const fileContent = fs.readFileSync(path.resolve(templatesDir, file), "utf8");
                const dirName = path.dirname(file);
                const template = JSON.parse(fileContent);
                if (!knownTemplates[dirName]) {
                    knownTemplates[dirName] = {
                        templates: []
                    };
                }

                knownTemplates[dirName].templates.push({
                    file: path.basename(file),
                    fullPath: file
                });

                let knownSample = {
                    templatePath: file,
                    properties: undefined,
                    odataType: undefined
                };

                if(template["$odata.type"]) {
                    knownSample.odataType = template["$odata.type"];
                }

                if (template["$sampleData"]) {
                    knownSample.properties = Object.getOwnPropertyNames(template["$sampleData"]);
                }

                if(knownSample.properties || knownSample.odataType) {
                    knownSamples.push(knownSample);
                }

            } catch (ex) {
                console.log(`Failed to read file ${file}`);
            }

        });

        fs.writeFileSync(path.resolve(templatesDir, "templates.json"), JSON.stringify(knownTemplates));
        fs.writeFileSync(path.resolve(templatesDir, "templateFields.json"), JSON.stringify(knownSamples));
    }
    catch (err) {
        console.error(err);
    }

}
