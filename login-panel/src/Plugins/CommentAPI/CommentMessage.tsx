import { API } from 'Plugins/CommonUtils/API'

export abstract class CommentMessage extends API {
    override serviceName: string = "Comment"
}