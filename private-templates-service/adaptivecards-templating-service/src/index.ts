import mongoose from "mongoose";
import { Template as mTemplate } from "./models/Template" 
import { ClientOptions } from "./IClientOptions";
import express, { Request, Response, NextFunction, Router } from "express";
import { check, validationResult } from "express-validator";
import { AuthenticationProvider } from './authproviders/IAuthenticationProvider'; 
import { TemplateError, ApiError } from './api/TemplateError';

export class TemplateServiceClient {

    //private static provider : StorageProvider;
    private static authProvider : AuthenticationProvider;

    // Temporary until storage provider is up
    private static async _run() : Promise<void> {
        // TODO: move db initialization to a separate class once adapter done
        const url = "mongodb://localhost:27017/test";
        mongoose.connect(url);
        // await mongoose.connection.dropDatabase();
    }

    /**
     * @public
     * Initialize database if not already running, authenticate owner
     * @param {ClientOptions} clientOptions - storage provider and auth provider options
     */
    public static async init(clientOptions : ClientOptions) : Promise<TemplateServiceClient> {
        // Initialize db / check if initialized and documents are valid
        // Check storage provider is valid
        // if (options.storageProvider === undefined) {
        //     const error = new Error();
        //     error.name = "Invalid Storage Provider";
        //     error.message = "Please provide a storage provider.";
        //     throw error;
        // }
        await this._run()

        if (clientOptions.authenticationProvider === undefined) {
            const error = new Error();
            error.name = "Missing Authentication Provider";
            error.message = "Please provide an authentication provider";
            throw error;
        }

        TemplateServiceClient.authProvider = clientOptions.authenticationProvider;

        // Authenticate
        return new TemplateServiceClient();
    }

    /**
     * @public
     * Post templates
     * @param {JSON} template 
     * @param {string} templateId - unique template id
     * @param {string} version - version number
     * @returns Promise as valid json 
     */
    public async postTemplates(template: JSON, templateId?: string, version?: string) : Promise<any> {
        let owner = TemplateServiceClient.authProvider.getOwner();
        if (!owner){
            return new Error("No owner specified, please authenticate.");
        }

        let ver = version;
        if (!version) {
            ver = '1.0';
        }

        return mTemplate.create({
                _id: mongoose.Types.ObjectId(),
                template: template,
                ownerOID: owner,
                isPublished: false,
                version: ver,
        })
    }

    /**
     * @public
     * Get entry point. 
     * @param {string} templateId - unique template id
     * @param {string} templateName - name to query for
     * @param {string} version - version number
     * @returns Promise as valid json 
     */
    public async getTemplates(templateId?: string, templateName?: string, version?: number) : Promise<any> {
        if (!templateId) {
            return await mTemplate.find();
        }

        if (!version) {
            return mTemplate.findById(templateId, (err, template) => {
                if (err || !template) return new Error("No template with such id.");
                return template;
            });
        } 

        // TODO: add search by version case
        // TODO: add search by template name
    }

    /**
     * @public 
     * Sets up endpoints for template service api. 
     * Use as app.use("/template", TemplateServiceClient.expressMiddleware())
     * @returns express router 
     */
    public expressMiddleware() : Router {
        var router = express.Router();

        // Verify signature of access token before requests.
        router.all("/", async (req : Request, res: Response, next: NextFunction) => {
            if (!req.headers.authorization) {
                const err = new TemplateError(ApiError.InvalidAuthenticationToken, "Missing credentials.");
                return res.status(401).json({ error: err });
            }
            
            let valid = await TemplateServiceClient.authProvider.isValid(req.headers.authorization);

            if (!valid){
                const err = new TemplateError(ApiError.InvalidAuthenticationToken, "Token given is not a valid access token issued by Azure Active Directory.");
                return res.status(401).json({ error: err });
            }
            next();
        })

        router.get("/", (req : Request, res : Response, _next : NextFunction) => {
            if (req.params.name) {
                return res.status(501);
            }

            this.getTemplates().then(
                (templates) => {
                    res.status(200).json(templates); 
                })
        })
        
        router.get("/:id?", (req : Request, res : Response, _next : NextFunction) => {
            this.getTemplates(req.params.id, undefined).then(
                (template) => {
                    if (!template) {
                        const err = new TemplateError(ApiError.TemplateNotFound, `Template with id ${req.params.id} does not exist.`);
                        return res.status(404).json({ error: err });
                    }
                    res.json(template);
                }
            )
        })

        router.post("/", async (req : Request, res : Response, _next: NextFunction) => {
            await check("template", "Template is not valid JSON.").isJSON().run(req);
            const errors = validationResult(req);

            if (!errors.isEmpty()) {
                const err = new TemplateError(ApiError.InvalidTemplate, "Template is incorrectly formatted.");
                return res.status(400).json({ error: err });
            }

            let template = await this.postTemplates(req.body.template, undefined, undefined);
            if (template){
                return res.status(201).json(template);
            }
            const err = new TemplateError(ApiError.InvalidTemplate, "Failed to create template.");
            res.status(400).json({ error: err });
        })

        return router;
    }

    private constructor() {}
}

export * from "./authproviders/IAuthenticationProvider";
export * from "./authproviders/AzureADProvider";