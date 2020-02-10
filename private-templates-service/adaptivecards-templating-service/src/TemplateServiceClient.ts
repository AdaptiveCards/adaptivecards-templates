import { ClientOptions } from "./IClientOptions";
import express, { Request, Response, NextFunction, Router } from "express";
import { check, validationResult } from "express-validator";
import { AuthenticationProvider } from "."; 
import { TemplateError, ApiError, ServiceErrorMessage } from "./models/errorModels";
import { StorageProvider } from ".";
import { ITemplate, JSONResponse, ITemplateInstance, IUser } from ".";
import { Issuer } from "./models/models";

export class TemplateServiceClient {

    private static storageProvider: StorageProvider;
    private static authProvider: AuthenticationProvider;

    /**
     * @public
     * Initialize database if not already running
     * @param {ClientOptions} clientOptions - storage provider and auth provider options
     */
    public static init(clientOptions: ClientOptions): TemplateServiceClient {
        // TODO: add db setup step once mongo adapter is added

        if (clientOptions.storageProvider === undefined) {
            const error = new Error();
            error.name = "Missing Storage Provider";
            error.message = "Please provide a storage provider.";
            throw error;
        }

        if (clientOptions.authenticationProvider === undefined) {
            const error = new Error();
            error.name = "Missing Authentication Provider";
            error.message = "Please provide an authentication provider";
            throw error;
        }

        this.storageProvider = clientOptions.storageProvider;
        this.authProvider = clientOptions.authenticationProvider;

        return new TemplateServiceClient();
    }
    
    /**
     * @public
     * Deletes user info - can only delete own user
     * @param {string} authId - unique ID from access token, eg. oid for AAD
     * @param {Issuer} issuer - auth provider
     */
    public async removeUser(authId: string, issuer: Issuer) : Promise<JSONResponse<Number>> {
        let owner = TemplateServiceClient.authProvider.getOwner();
        if (!owner){
            return { success: false, errorMessage: ServiceErrorMessage.AuthFailureResponse };
        }
        
        if (authId !== owner) {
            return { success: false, errorMessage: ServiceErrorMessage.UnauthorizedUser };
        }

        const user : IUser = {
            authId: authId,
            issuer: issuer,
        }

        return TemplateServiceClient.storageProvider.removeUser(user);
    }

    /**
     * @private
     * Get user
     * @param {Issuer} issuer - auth provider
     */
    private async _getUser(issuer: Issuer): Promise<JSONResponse<IUser[]>> {
        let owner = TemplateServiceClient.authProvider.getOwner();
        if (!owner){
            return { success: false, errorMessage: ServiceErrorMessage.AuthFailureResponse };
        }

        const user: IUser = {
            authId: owner,
            issuer: issuer
        }

        return TemplateServiceClient.storageProvider.getUser(user);
    }

    /**
     * @private
     * @param {string} id - unique ID from access token, eg. oid for AAD
     * @param {Issuer} issuer - auth provider
     * @param {string} team - user's team within org
     * @param {string} org - user's organization
     */
    private async _postUser(issuer: Issuer, team?: string, org?: string): Promise<JSONResponse<string>> {
        let owner = TemplateServiceClient.authProvider.getOwner();
        if (!owner){
            return { success: false, errorMessage: ServiceErrorMessage.AuthFailureResponse };
        }

        const user: IUser = {
            authId: owner,
            issuer: issuer,
            team: team? [team] : [],
            org: org? [org] : []
        }

        return TemplateServiceClient.storageProvider.insertUser(user);
    }

    /**
     * @public
     * Post templates and checks if user exists
     * @param {JSON} template 
     * @param {string} templateId - unique template id
     * @param {string} version - version number
     * @returns Promise as valid json 
     */
    public async postTemplates(template: JSON, templateId?: string, version?: string): Promise<JSONResponse<string>> {
        let owner = TemplateServiceClient.authProvider.getOwner();
        if (!owner){
            return { success: false, errorMessage: ServiceErrorMessage.AuthFailureResponse };
        }

        let ownerID = "";

        // Check if user exists, if not, create new user
        let userResponse = await this._getUser(TemplateServiceClient.authProvider.issuer);
        if (!userResponse.success || userResponse.result && userResponse.result.length === 0) {
            let newUser = await this._postUser(TemplateServiceClient.authProvider.issuer);
            if (!newUser.success || !newUser.result) {
                return { success: false, errorMessage: ServiceErrorMessage.InvalidUser };
            }
            ownerID = newUser.result;
        } else {
            if (userResponse.result && userResponse.result[0].id) {
                ownerID = userResponse.result[0].id;
            } else {
                return { success: false, errorMessage: ServiceErrorMessage.InvalidUser };
            }
        }

        console.log(ownerID);

        const templateInstance: ITemplateInstance = {
            json: JSON.stringify(template),
            version: version || "1.0" 
        }

        const newTemplate: ITemplate = {
            instances: [templateInstance],
            tags: [],
            owner: owner,
            isPublished: false
        }

        return TemplateServiceClient.storageProvider.insertTemplate(newTemplate);
    }

    /**
     * @public
     * Get entry point. 
     * @param {string} templateId - unique template id
     * @param {boolean} isPublished 
     * @param {string} templateName - name to query for
     * @param {string} version - version number
     * @returns Promise as valid json 
     */
    public async getTemplates(templateId?: string, isPublished?: boolean, templateName?: string, version?: number): Promise<JSONResponse<ITemplate[]>> {
        let owner = TemplateServiceClient.authProvider.getOwner();
        if (!owner){
            return { success: false, errorMessage: ServiceErrorMessage.AuthFailureResponse };
        }

        let user = await this._getUser(TemplateServiceClient.authProvider.issuer);
        if (!user.success || user.result.length === 0) {
            return { success: false, errorMessage: ServiceErrorMessage.InvalidUser };
        }

        const templateQuery: ITemplate = {
            id : templateId,
            instances: [],
            tags: [],
            owner: user[0].id,
            isPublished: isPublished,
        }

        return TemplateServiceClient.storageProvider.getTemplate(templateQuery);        
    }

    /**
     * @public 
     * Sets up endpoints for template service api. 
     * Use as app.use("/template", TemplateServiceClient.expressMiddleware())
     * @returns express router 
     */
    public expressMiddleware(): Router {
        var router = express.Router();

        // Verify signature of access token before requests.
        router.all("/", async (req: Request, res: Response, next: NextFunction) => {
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

        router.get("/", (req: Request, res: Response, _next: NextFunction) => {
            if (req.params.name) {
                return res.status(501);
            }

            this.getTemplates().then(
                (response) => {
                    if (!response.success) {
                        const err = new TemplateError(ApiError.TemplateNotFound, "Unable to find any templates.");
                        return res.status(404).json({ error: err });
                    } 
                    res.status(200).json({ "templates": response.result });
                })
        })
        
        router.get("/:id?", (req: Request, res: Response, _next: NextFunction) => {
            this.getTemplates(req.params.id).then(
                (response) => {
                    if (!response.success || response.result && response.result.length === 0 ) {
                        const err = new TemplateError(ApiError.TemplateNotFound, `Template with id ${req.params.id} does not exist.`);
                        return res.status(404).json({ error: err });
                    }
                    res.status(200).json({ "templates": response.result });
                }
            )
        })

        router.post("/", async (req: Request, res: Response, _next: NextFunction) => {
            await check("template", "Template is not valid JSON.").isJSON().run(req);
            const errors = validationResult(req);

            if (!errors.isEmpty()) {
                const err = new TemplateError(ApiError.InvalidTemplate, "Template is incorrectly formatted.");
                return res.status(400).json({ error: err });
            }

            let response = await this.postTemplates(req.body.template);
            if (!response.success){
                const err = new TemplateError(ApiError.InvalidTemplate, "Unable to create given template.");
                return res.status(400).json({ error: err })
            }
            
            return res.status(201).json(response.result);
        })

        return router;
    }

    public userExpressMiddleware() : Router {
        var router = express.Router();

        // Verify signature of access token before requests.
        router.all("/", async (req: Request, res: Response, next: NextFunction) => {
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

        router.get("/", (req: Request, res: Response, _next: NextFunction) => {
            this._getUser(TemplateServiceClient.authProvider.issuer).then(
                (response) => {
                    if (!response.success) {
                        const err = new TemplateError(ApiError.UserNotFound, "Unable to find user information.");
                        return res.status(404).json({ error: err });
                    } 
                    res.status(200).json({ "user": response.result });
                })
        })

        return router;
    }

    private constructor() {}

}
